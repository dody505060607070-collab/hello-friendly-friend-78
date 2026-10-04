DROP POLICY IF EXISTS "view reservations" ON public.reservations;
DROP POLICY IF EXISTS "create reservations" ON public.reservations;
DROP POLICY IF EXISTS "edit reservations" ON public.reservations;
DROP POLICY IF EXISTS "delete reservations" ON public.reservations;
DROP POLICY IF EXISTS "staff view reservations" ON public.reservations;
CREATE POLICY "staff view reservations" ON public.reservations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff create reservations" ON public.reservations;
CREATE POLICY "staff create reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "staff edit reservations" ON public.reservations;
CREATE POLICY "staff edit reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff delete reservations" ON public.reservations;
CREATE POLICY "staff delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_reservation(_property_id uuid, _employee_id uuid, _contact_id uuid DEFAULT NULL, _duration_hours integer DEFAULT 24, _notes text DEFAULT NULL)
RETURNS public.reservations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE created public.reservations;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  IF _duration_hours NOT IN (24, 48, 72, 168) THEN RAISE EXCEPTION 'RESERVATION_INVALID_DURATION'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _employee_id AND is_active) THEN RAISE EXCEPTION 'RESERVATION_EMPLOYEE_REQUIRED'; END IF;
  INSERT INTO public.reservations (property_id, employee_id, contact_id, starts_at, ends_at, notes, status, created_by)
  VALUES (_property_id, _employee_id, _contact_id, now(), now() + make_interval(hours => _duration_hours), NULLIF(btrim(_notes), ''), 'active', auth.uid())
  RETURNING * INTO created;
  RETURN created;
END;
$$;
CREATE OR REPLACE FUNCTION public.extend_reservation(_reservation_id uuid)
RETURNS public.reservations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE changed public.reservations;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  UPDATE public.reservations SET ends_at = ends_at + interval '24 hours', extended_count = extended_count + 1, updated_at = now()
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now() RETURNING * INTO changed;
  IF changed.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  RETURN changed;
END;
$$;
CREATE OR REPLACE FUNCTION public.cancel_reservation(_reservation_id uuid)
RETURNS public.reservations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE changed public.reservations;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  UPDATE public.reservations SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), updated_at = now()
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now() RETURNING * INTO changed;
  IF changed.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  RETURN changed;
END;
$$;
CREATE OR REPLACE FUNCTION public.convert_reservation_to_contract(_reservation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  reservation_row public.reservations;
  property_row public.properties;
  new_contract_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'RESERVATION_FORBIDDEN'; END IF;
  PERFORM public.expire_reservations();
  SELECT * INTO reservation_row FROM public.reservations WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now() FOR UPDATE;
  IF reservation_row.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  SELECT * INTO property_row FROM public.properties WHERE id = reservation_row.property_id;
  INSERT INTO public.contracts (contract_number, contract_type, owner_id, tenant_id, property_id, unit_id, start_date, status, source, created_by)
  VALUES ('RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), CASE WHEN property_row.purpose = 'sale' THEN 'sale' ELSE 'rent' END, property_row.owner_id, reservation_row.contact_id, reservation_row.property_id, reservation_row.unit_id, current_date, 'draft', 'reservation', auth.uid())
  RETURNING id INTO new_contract_id;
  UPDATE public.reservations SET status = 'converted', contract_id = new_contract_id, converted_by = auth.uid(), converted_at = now(), updated_at = now() WHERE id = reservation_row.id;
  RETURN new_contract_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    IF NEW.org IS DISTINCT FROM OLD.org OR NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'Security-sensitive profile fields may only be changed by a super administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_security_fields_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();
REVOKE EXECUTE ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_security_fields() TO service_role;

DROP POLICY IF EXISTS "staff read property media" ON storage.objects;
CREATE POLICY "staff read property media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'property-media' AND public.has_perm(auth.uid(), 'properties', 'view'));
DROP POLICY IF EXISTS "public read visible properties" ON public.properties;
DROP POLICY IF EXISTS "auth read visible properties" ON public.properties;
DROP POLICY IF EXISTS "staff view properties" ON public.properties;
CREATE POLICY "staff view properties" ON public.properties FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'properties', 'view'));
REVOKE SELECT ON public.properties FROM anon;

CREATE OR REPLACE FUNCTION public.bootstrap_current_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  uname text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.user_id = uid) THEN RETURN; END IF;
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) INTO uemail, uname FROM auth.users WHERE id = uid;
  INSERT INTO public.profiles (id, full_name, email, is_active, org)
  VALUES (uid, COALESCE(uname, 'مستخدم'), uemail, true, 'mithraa')
  ON CONFLICT (id) DO NOTHING;
END;
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, is_active, org)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, NEW.raw_user_meta_data->>'phone', true, 'mithraa')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rent_period text;
CREATE OR REPLACE FUNCTION public.get_public_properties(_purpose text DEFAULT NULL::text, _code text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(result_row) ORDER BY result_row.is_featured DESC, result_row.sort_order ASC, result_row.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT p.id, p.code, p.name, p.purpose, p.rent_period, p.property_type, p.city, p.district, p.price_text, p.price_value, p.description,
      p.is_featured, p.sort_order, p.map_url, p.latitude, p.longitude, p.whatsapp_number, p.link_youtube, p.link_tiktok, p.link_instagram,
      p.link_snapchat, p.link_x, p.link_facebook, p.link_tour, p.created_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order) ORDER BY pi.is_cover DESC, pi.sort_order ASC)
        FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb) AS property_images
    FROM public.properties p
    WHERE p.is_visible AND p.status <> 'archived' AND (_purpose IS NULL OR p.purpose = _purpose) AND (_code IS NULL OR p.code = _code)
    ORDER BY p.is_featured DESC, p.sort_order ASC, p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS result_row;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(to_jsonb(s), '{}'::jsonb)
  FROM (SELECT company_name, phone, whatsapp_number, email, address, about, stats, social_links FROM public.app_settings WHERE id = true LIMIT 1) s;
$$;

DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_activity(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_reservation_to_contract(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_properties(text, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "public read settings" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;