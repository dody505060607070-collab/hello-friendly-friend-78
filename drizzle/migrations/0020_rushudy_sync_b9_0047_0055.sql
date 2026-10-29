ALTER TABLE public.property_images ADD COLUMN IF NOT EXISTS display_url text;

CREATE OR REPLACE FUNCTION public.get_public_buildings(_code text DEFAULT NULL::text, _purpose text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order ASC, r.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT b.id, b.code, b.name, b.city, b.district, b.address, b.description,
      b.purpose, b.floors_count, b.cover_url, b.sort_order, b.created_at,
      b.latitude, b.longitude, b.map_url,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'code', p.code, 'name', p.name, 'floor', p.floor,
          'purpose', p.purpose, 'rent_period', p.rent_period, 'property_type', p.property_type,
          'status', p.status, 'price_text', p.price_text, 'price_value', p.price_value,
          'description', p.description, 'whatsapp_number', p.whatsapp_number,
          'city', p.city, 'district', p.district, 'link_tour', p.link_tour,
          'latitude', p.latitude, 'longitude', p.longitude,
          'images', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'display_url', pi.display_url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order)
                   ORDER BY pi.is_cover DESC, pi.sort_order ASC)
            FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb)
        ) ORDER BY p.floor NULLS LAST, p.name)
        FROM public.properties p
        WHERE p.building_id = b.id AND p.is_visible AND p.status <> 'archived'
      ), '[]'::jsonb) AS units
    FROM public.buildings b
    WHERE b.is_visible
      AND (_code IS NULL OR b.code = _code)
      AND (_purpose IS NULL OR b.purpose = _purpose)
    ORDER BY b.sort_order ASC, b.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS r;
$function$;

ALTER TABLE public.tasks ALTER COLUMN assigned_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "staff create activities for colleagues" ON public.employee_activities;
CREATE POLICY "staff create activities for colleagues" ON public.employee_activities FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "creator updates own activities" ON public.employee_activities;
CREATE POLICY "creator updates own activities" ON public.employee_activities FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.owner_followup_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  template text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.owner_followup_config TO authenticated;
GRANT ALL ON public.owner_followup_config TO service_role;
ALTER TABLE public.owner_followup_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read owner followup config" ON public.owner_followup_config;
CREATE POLICY "staff read owner followup config" ON public.owner_followup_config FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owners editors write owner followup config" ON public.owner_followup_config;
CREATE POLICY "owners editors write owner followup config" ON public.owner_followup_config FOR ALL TO authenticated USING (public.has_perm(auth.uid(), 'owners', 'edit')) WITH CHECK (public.has_perm(auth.uid(), 'owners', 'edit'));
INSERT INTO public.owner_followup_config (id, enabled) VALUES (true, true) ON CONFLICT DO NOTHING;

ALTER TABLE public.message_log ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
ALTER TABLE public.message_log ADD COLUMN IF NOT EXISTS kind text;
CREATE INDEX IF NOT EXISTS message_log_kind_contact_idx ON public.message_log (kind, contact_id, created_at desc);
DROP POLICY IF EXISTS "owners viewers read owner followup log" ON public.message_log;
CREATE POLICY "owners viewers read owner followup log" ON public.message_log FOR SELECT TO authenticated USING (kind = 'owner_biweekly' AND public.has_perm(auth.uid(), 'owners', 'view'));

DROP POLICY IF EXISTS tasks_delete_by_creator ON public.tasks;
CREATE POLICY tasks_delete_by_creator ON public.tasks FOR DELETE TO authenticated USING (assigned_by = auth.uid());

CREATE OR REPLACE FUNCTION public.set_top_sort_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'properties' THEN
    SELECT COALESCE(MIN(sort_order), 0) - 1 INTO NEW.sort_order FROM public.properties;
  ELSE
    SELECT COALESCE(MIN(sort_order), 0) - 1 INTO NEW.sort_order FROM public.buildings;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_top_sort_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS properties_new_on_top ON public.properties;
CREATE TRIGGER properties_new_on_top BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_top_sort_order();
DROP TRIGGER IF EXISTS buildings_new_on_top ON public.buildings;
CREATE TRIGGER buildings_new_on_top BEFORE INSERT ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.set_top_sort_order();

UPDATE public.properties p SET sort_order = o.rn FROM (
  SELECT id, row_number() OVER (ORDER BY is_featured DESC, CASE WHEN is_featured THEN sort_order END ASC NULLS LAST, created_at DESC) AS rn FROM public.properties
) o WHERE o.id = p.id;
UPDATE public.buildings b SET sort_order = o.rn FROM (
  SELECT id, row_number() OVER (ORDER BY sort_order ASC, created_at DESC) AS rn FROM public.buildings
) o WHERE o.id = b.id;

CREATE OR REPLACE FUNCTION public.get_public_properties(_purpose text DEFAULT NULL::text, _code text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(jsonb_agg(to_jsonb(result_row) ORDER BY result_row.sort_order ASC NULLS LAST, result_row.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT p.id, p.code, p.name, p.purpose, p.rent_period, p.property_type, p.city, p.district,
      p.price_text, p.price_value, p.description, p.is_featured, p.sort_order, p.map_url,
      p.latitude, p.longitude, p.whatsapp_number, p.link_youtube, p.link_tiktok,
      p.link_instagram, p.link_snapchat, p.link_x, p.link_facebook, p.link_tour, p.created_at,
      p.floor, p.building_id,
      CASE WHEN p.status = 'available' AND EXISTS (
          SELECT 1 FROM public.reservations r
          WHERE r.property_id = p.id AND r.status IN ('hold', 'active') AND r.ends_at > now()
        ) THEN 'reserved' ELSE p.status END AS status,
      (SELECT b.code FROM public.buildings b WHERE b.id = p.building_id AND b.is_visible) AS building_code,
      (SELECT b.name FROM public.buildings b WHERE b.id = p.building_id AND b.is_visible) AS building_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'display_url', pi.display_url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order, 'focal_x', pi.focal_x, 'focal_y', pi.focal_y) ORDER BY pi.is_cover DESC, pi.sort_order ASC) FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb) AS property_images
    FROM public.properties p
    WHERE p.is_visible AND p.status <> 'archived'
      AND (_purpose IS NULL OR p.purpose = _purpose)
      AND (_code IS NULL OR lower(btrim(p.code)) = lower(btrim(_code)))
    ORDER BY p.sort_order ASC NULLS LAST, p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 1000)
  ) AS result_row;
$function$;

CREATE OR REPLACE FUNCTION public.sync_unit_status_from_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE live boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id
     AND NEW.property_id IS NOT DISTINCT FROM OLD.property_id THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('active', 'holdover') THEN
    IF NEW.unit_id IS NOT NULL THEN
      UPDATE public.units SET status = 'rented' WHERE id = NEW.unit_id AND status IS DISTINCT FROM 'rented';
    END IF;
    IF NEW.property_id IS NOT NULL THEN
      UPDATE public.properties SET status = 'rented' WHERE id = NEW.property_id AND status IN ('available', 'reserved');
    END IF;
  ELSIF NEW.status IN ('expired', 'terminated') THEN
    IF NEW.unit_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.contracts c WHERE c.unit_id = NEW.unit_id AND c.id <> NEW.id AND c.status IN ('active', 'holdover')) INTO live;
      IF NOT live THEN UPDATE public.units SET status = 'vacant' WHERE id = NEW.unit_id AND status = 'rented'; END IF;
    END IF;
    IF NEW.property_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.contracts c WHERE c.property_id = NEW.property_id AND c.id <> NEW.id AND c.status IN ('active', 'holdover')) INTO live;
      IF NOT live THEN UPDATE public.properties SET status = 'available' WHERE id = NEW.property_id AND status = 'rented'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_unit_status_from_contract() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS contracts_sync_unit_status ON public.contracts;
CREATE TRIGGER contracts_sync_unit_status AFTER UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.sync_unit_status_from_contract();

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_one_asset CHECK (num_nonnulls(building_id, property_id, unit_id) <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;