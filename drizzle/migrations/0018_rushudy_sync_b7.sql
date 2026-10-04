CREATE TABLE IF NOT EXISTS public.service_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, name text NOT NULL, category text NOT NULL,
  description text, whatsapp_number text, email text, image_key text,
  video_urls text[] NOT NULL DEFAULT '{}', services text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partners TO authenticated;
GRANT ALL ON public.service_partners TO service_role;
ALTER TABLE public.service_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view active service partners" ON public.service_partners;
CREATE POLICY "Authenticated users view active service partners" ON public.service_partners FOR SELECT TO authenticated USING (is_active OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff manage service partners" ON public.service_partners;
CREATE POLICY "Staff manage service partners" ON public.service_partners FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.service_partner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.service_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE, login_email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(partner_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partner_accounts TO authenticated;
GRANT ALL ON public.service_partner_accounts TO service_role;
ALTER TABLE public.service_partner_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partners view own account" ON public.service_partner_accounts;
CREATE POLICY "Partners view own account" ON public.service_partner_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff manage partner accounts" ON public.service_partner_accounts;
CREATE POLICY "Staff manage partner accounts" ON public.service_partner_accounts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.current_service_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_id FROM public.service_partner_accounts WHERE user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_service_partner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_service_partner_id() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.service_partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT ('SR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  partner_id uuid NOT NULL REFERENCES public.service_partners(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  customer_name text NOT NULL, customer_phone text NOT NULL, customer_identity text,
  address text NOT NULL, service_type text NOT NULL, details text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','in_progress','completed','cancelled')),
  partner_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partner_requests TO authenticated;
GRANT ALL ON public.service_partner_requests TO service_role;
ALTER TABLE public.service_partner_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients create own service requests" ON public.service_partner_requests;
CREATE POLICY "Clients create own service requests" ON public.service_partner_requests FOR INSERT TO authenticated WITH CHECK (requester_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.user_id = auth.uid()));
DROP POLICY IF EXISTS "Clients view own service requests" ON public.service_partner_requests;
CREATE POLICY "Clients view own service requests" ON public.service_partner_requests FOR SELECT TO authenticated USING (requester_user_id = auth.uid());
DROP POLICY IF EXISTS "Partners view assigned requests" ON public.service_partner_requests;
CREATE POLICY "Partners view assigned requests" ON public.service_partner_requests FOR SELECT TO authenticated USING (partner_id = public.current_service_partner_id());
DROP POLICY IF EXISTS "Partners update assigned requests" ON public.service_partner_requests;
CREATE POLICY "Partners update assigned requests" ON public.service_partner_requests FOR UPDATE TO authenticated USING (partner_id = public.current_service_partner_id()) WITH CHECK (partner_id = public.current_service_partner_id());
DROP POLICY IF EXISTS "Staff manage service requests" ON public.service_partner_requests;
CREATE POLICY "Staff manage service requests" ON public.service_partner_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.service_partner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('SPI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  request_id uuid NOT NULL REFERENCES public.service_partner_requests(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.service_partners(id) ON DELETE RESTRICT,
  customer_user_id uuid NOT NULL, amount numeric(14,2), description text, image_path text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','paid','cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partner_invoices TO authenticated;
GRANT ALL ON public.service_partner_invoices TO service_role;
ALTER TABLE public.service_partner_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients view own partner invoices" ON public.service_partner_invoices;
CREATE POLICY "Clients view own partner invoices" ON public.service_partner_invoices FOR SELECT TO authenticated USING (customer_user_id = auth.uid());
DROP POLICY IF EXISTS "Partners view own invoices" ON public.service_partner_invoices;
CREATE POLICY "Partners view own invoices" ON public.service_partner_invoices FOR SELECT TO authenticated USING (partner_id = public.current_service_partner_id());
DROP POLICY IF EXISTS "Partners create own invoices" ON public.service_partner_invoices;
CREATE POLICY "Partners create own invoices" ON public.service_partner_invoices FOR INSERT TO authenticated WITH CHECK (partner_id = public.current_service_partner_id() AND EXISTS (SELECT 1 FROM public.service_partner_requests r WHERE r.id = request_id AND r.partner_id = public.current_service_partner_id() AND r.requester_user_id = customer_user_id));
DROP POLICY IF EXISTS "Partners update own invoices" ON public.service_partner_invoices;
CREATE POLICY "Partners update own invoices" ON public.service_partner_invoices FOR UPDATE TO authenticated USING (partner_id = public.current_service_partner_id()) WITH CHECK (partner_id = public.current_service_partner_id());
DROP POLICY IF EXISTS "Staff manage partner invoices" ON public.service_partner_invoices;
CREATE POLICY "Staff manage partner invoices" ON public.service_partner_invoices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.property_deal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('rent','sale','available')),
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  amount numeric(14,2), event_date date NOT NULL DEFAULT current_date, notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_deal_events TO authenticated;
GRANT ALL ON public.property_deal_events TO service_role;
ALTER TABLE public.property_deal_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view property deal events" ON public.property_deal_events;
CREATE POLICY "Staff view property deal events" ON public.property_deal_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff create property deal events" ON public.property_deal_events;
CREATE POLICY "Staff create property deal events" ON public.property_deal_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Staff update property deal events" ON public.property_deal_events;
CREATE POLICY "Staff update property deal events" ON public.property_deal_events FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff delete property deal events" ON public.property_deal_events;
CREATE POLICY "Staff delete property deal events" ON public.property_deal_events FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_property_status_change(_property_id uuid, _status text, _employee_id uuid DEFAULT NULL, _contact_id uuid DEFAULT NULL, _amount numeric DEFAULT NULL, _event_date date DEFAULT current_date, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _unit_id uuid; _event_id uuid; _event_type text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status NOT IN ('available','rented','sold') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT u.id INTO _unit_id FROM public.units u WHERE u.property_id = _property_id LIMIT 1;
  UPDATE public.properties SET status = _status WHERE id = _property_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND'; END IF;
  IF _unit_id IS NOT NULL THEN UPDATE public.units SET status = _status WHERE id = _unit_id; END IF;
  _event_type := CASE _status WHEN 'rented' THEN 'rent' WHEN 'sold' THEN 'sale' ELSE 'available' END;
  INSERT INTO public.property_deal_events(property_id, unit_id, event_type, employee_id, contact_id, amount, event_date, notes, created_by)
  VALUES (_property_id, _unit_id, _event_type, _employee_id, _contact_id, _amount, coalesce(_event_date,current_date), nullif(btrim(_notes),''), auth.uid())
  RETURNING id INTO _event_id;
  RETURN _event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_property_status_change(uuid,text,uuid,uuid,numeric,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_property_status_change(uuid,text,uuid,uuid,numeric,date,text) TO authenticated, service_role;

DROP TRIGGER IF EXISTS service_partners_updated ON public.service_partners;
CREATE TRIGGER service_partners_updated BEFORE UPDATE ON public.service_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS service_partner_requests_updated ON public.service_partner_requests;
CREATE TRIGGER service_partner_requests_updated BEFORE UPDATE ON public.service_partner_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS service_partner_invoices_updated ON public.service_partner_invoices;
CREATE TRIGGER service_partner_invoices_updated BEFORE UPDATE ON public.service_partner_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS service_partner_requests_partner_status_idx ON public.service_partner_requests(partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_partner_requests_requester_idx ON public.service_partner_requests(requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_partner_invoices_partner_idx ON public.service_partner_invoices(partner_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS service_partner_invoices_customer_idx ON public.service_partner_invoices(customer_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS property_deal_events_employee_date_idx ON public.property_deal_events(employee_id, event_date);

ALTER TABLE public.employee_goals DROP CONSTRAINT IF EXISTS employee_goals_goal_type_check;
ALTER TABLE public.employee_goals ADD CONSTRAINT employee_goals_goal_type_check CHECK (goal_type IN ('rent','sale','collection','tasks','leads','visits','custom'));

DROP POLICY IF EXISTS "view tasks" ON public.tasks;
CREATE POLICY "view tasks" ON public.tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.is_task_member(id, auth.uid()) OR assigned_by = auth.uid());

DROP POLICY IF EXISTS "public submit supply request" ON public.supply_requests;
CREATE POLICY "public submit supply request" ON public.supply_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public submit listing request" ON public.listing_requests;
CREATE POLICY "public submit listing request" ON public.listing_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sync_contact_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF NEW.whatsapp IS NOT DISTINCT FROM OLD.whatsapp AND (OLD.whatsapp IS NULL OR OLD.whatsapp = OLD.phone OR btrim(OLD.whatsapp) = '') THEN
      NEW.whatsapp := NEW.phone;
    END IF;
  END IF;
  IF (NEW.phone IS DISTINCT FROM OLD.phone OR NEW.whatsapp IS DISTINCT FROM OLD.whatsapp OR NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
    UPDATE public.reminder_followups
       SET recipient_phone = COALESCE(NULLIF(btrim(NEW.whatsapp),''), NEW.phone), recipient_name = NEW.full_name, updated_at = now()
     WHERE recipient_contact_id = NEW.id AND status NOT IN ('completed','cancelled','stopped');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_contact_phone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_contact_phone ON public.contacts;
CREATE TRIGGER trg_sync_contact_phone BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.sync_contact_phone();

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'other';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_key text NOT NULL, user_id uuid NOT NULL, code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0, consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.login_otps TO service_role;
ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS login_otps_phone_idx ON public.login_otps (phone_key, created_at DESC);

CREATE INDEX IF NOT EXISTS site_page_views_visited_at_idx ON public.site_page_views (visited_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
DROP POLICY IF EXISTS "authenticated staff view website analytics" ON public.site_page_views;
CREATE POLICY "authenticated staff view website analytics" ON public.site_page_views FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_crm_traffic_stats(_days integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _now timestamptz := now();
  _cur timestamptz := now() - make_interval(days => greatest(_days, 1));
  _prev timestamptz := now() - make_interval(days => greatest(_days, 1) * 2);
  _result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT jsonb_build_object(
    'views', (SELECT count(*) FROM site_page_views WHERE visited_at >= _cur),
    'visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _cur),
    'public_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _cur AND user_id IS NULL),
    'previous_views', (SELECT count(*) FROM site_page_views WHERE visited_at >= _prev AND visited_at < _cur),
    'previous_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _prev AND visited_at < _cur),
    'live_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _now - interval '5 minutes'),
    'live_public_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _now - interval '5 minutes' AND user_id IS NULL),
    'last_visit_at', (SELECT max(visited_at) FROM site_page_views),
    'top_pages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'views', views) ORDER BY views DESC) FROM (SELECT path, count(*) views FROM site_page_views WHERE visited_at >= _cur AND user_id IS NULL GROUP BY path ORDER BY count(*) DESC LIMIT 7) p), '[]'::jsonb),
    'top_pages_all', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'views', views) ORDER BY views DESC) FROM (SELECT path, count(*) views FROM site_page_views WHERE visited_at >= _cur GROUP BY path ORDER BY count(*) DESC LIMIT 7) p), '[]'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'at', visited_at, 'signed_in', user_id IS NOT NULL) ORDER BY visited_at DESC) FROM (SELECT path, visited_at, user_id FROM site_page_views ORDER BY visited_at DESC LIMIT 12) r), '[]'::jsonb),
    'events', (SELECT count(*) FROM activity_log WHERE created_at >= _cur)
  ) INTO _result;
  RETURN _result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_crm_traffic_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_crm_traffic_stats(integer) TO authenticated;