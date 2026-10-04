CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'normal',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  technician_name TEXT,
  technician_phone TEXT,
  scheduled_at TIMESTAMPTZ,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  before_images TEXT[] NOT NULL DEFAULT '{}',
  after_images TEXT[] NOT NULL DEFAULT '{}',
  rating INTEGER,
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_status_check CHECK (status IN ('new','assigned','in_progress','done','cancelled')),
  CONSTRAINT maintenance_priority_check CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT maintenance_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))
);
CREATE INDEX IF NOT EXISTS maintenance_requests_status_idx ON public.maintenance_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_requests_property_idx ON public.maintenance_requests(property_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_requests TO authenticated;
GRANT INSERT ON public.maintenance_requests TO anon;
GRANT ALL ON public.maintenance_requests TO service_role;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read maintenance" ON public.maintenance_requests;
CREATE POLICY "staff read maintenance" ON public.maintenance_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff write maintenance" ON public.maintenance_requests;
CREATE POLICY "staff write maintenance" ON public.maintenance_requests FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff update maintenance" ON public.maintenance_requests;
CREATE POLICY "staff update maintenance" ON public.maintenance_requests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff delete maintenance" ON public.maintenance_requests;
CREATE POLICY "staff delete maintenance" ON public.maintenance_requests FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "public submit maintenance" ON public.maintenance_requests;
CREATE POLICY "public submit maintenance" ON public.maintenance_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'new' AND technician_name IS NULL AND internal_notes IS NULL AND cost = 0 AND created_by IS NULL);
DROP TRIGGER IF EXISTS set_updated_at_maintenance_requests ON public.maintenance_requests;
CREATE TRIGGER set_updated_at_maintenance_requests BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.unit_documents ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE public.owner_requests ADD COLUMN IF NOT EXISTS staff_note TEXT;

CREATE TABLE IF NOT EXISTS public.owner_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'bank',
  iban_last4 TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','transferred','rejected')),
  staff_note TEXT, processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_payout_requests TO authenticated;
GRANT ALL ON public.owner_payout_requests TO service_role;
ALTER TABLE public.owner_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage payout requests" ON public.owner_payout_requests;
CREATE POLICY "staff manage payout requests" ON public.owner_payout_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'owner' CHECK (sender IN ('owner','staff')),
  body TEXT NOT NULL, read_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_messages_owner_idx ON public.owner_messages (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_messages TO authenticated;
GRANT ALL ON public.owner_messages TO service_role;
ALTER TABLE public.owner_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner messages" ON public.owner_messages;
CREATE POLICY "staff manage owner messages" ON public.owner_messages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'general', title TEXT NOT NULL, body TEXT, link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_notifications_owner_idx ON public.owner_notifications (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_notifications TO authenticated;
GRANT ALL ON public.owner_notifications TO service_role;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner notifications" ON public.owner_notifications;
CREATE POLICY "staff manage owner notifications" ON public.owner_notifications FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_preferences (
  owner_id UUID PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ar', currency TEXT NOT NULL DEFAULT 'SAR',
  report_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (report_frequency IN ('none','monthly','quarterly','yearly')),
  expense_approval_limit NUMERIC(14,2) NOT NULL DEFAULT 1000,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_preferences TO authenticated;
GRANT ALL ON public.owner_preferences TO service_role;
ALTER TABLE public.owner_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner preferences" ON public.owner_preferences;
CREATE POLICY "staff manage owner preferences" ON public.owner_preferences FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_share_links TO authenticated;
GRANT ALL ON public.owner_share_links TO service_role;
ALTER TABLE public.owner_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner share links" ON public.owner_share_links;
CREATE POLICY "staff manage owner share links" ON public.owner_share_links FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','tenant','renewal','other')),
  title TEXT NOT NULL, details TEXT, amount NUMERIC(14,2),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decision_note TEXT, decided_at TIMESTAMPTZ, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_approvals_owner_idx ON public.owner_approvals (owner_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_approvals TO authenticated;
GRANT ALL ON public.owner_approvals TO service_role;
ALTER TABLE public.owner_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner approvals" ON public.owner_approvals;
CREATE POLICY "staff manage owner approvals" ON public.owner_approvals FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.unit_condition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'periodic' CHECK (kind IN ('move_in','move_out','periodic')),
  summary TEXT, images TEXT[] NOT NULL DEFAULT '{}',
  reported_on DATE NOT NULL DEFAULT CURRENT_DATE, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_condition_reports TO authenticated;
GRANT ALL ON public.unit_condition_reports TO service_role;
ALTER TABLE public.unit_condition_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage condition reports" ON public.unit_condition_reports;
CREATE POLICY "staff manage condition reports" ON public.unit_condition_reports FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.unit_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL, visitor_phone TEXT,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT, feedback TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unit_visits_owner_idx ON public.unit_visits (owner_id, visit_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_visits TO authenticated;
GRANT ALL ON public.unit_visits TO service_role;
ALTER TABLE public.unit_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage unit visits" ON public.unit_visits;
CREATE POLICY "staff manage unit visits" ON public.unit_visits FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.unit_documents(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  doc_title TEXT NOT NULL, signer_name TEXT NOT NULL,
  otp_code TEXT, otp_expires_at TIMESTAMPTZ, signed_at TIMESTAMPTZ, signature_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_signatures TO authenticated;
GRANT ALL ON public.owner_signatures TO service_role;
ALTER TABLE public.owner_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner signatures" ON public.owner_signatures;
CREATE POLICY "staff manage owner signatures" ON public.owner_signatures FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_agent TEXT, path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_login_events_owner_idx ON public.owner_login_events (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_login_events TO authenticated;
GRANT ALL ON public.owner_login_events TO service_role;
ALTER TABLE public.owner_login_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner login events" ON public.owner_login_events;
CREATE POLICY "staff manage owner login events" ON public.owner_login_events FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_asset_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.owner_asset_section_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.owner_asset_sections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('building','property','unit')),
  item_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_owner_asset_sections_owner ON public.owner_asset_sections(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_asset_section_items_section ON public.owner_asset_section_items(section_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_asset_sections TO authenticated;
GRANT ALL ON public.owner_asset_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_asset_section_items TO authenticated;
GRANT ALL ON public.owner_asset_section_items TO service_role;
ALTER TABLE public.owner_asset_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_asset_section_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner sections" ON public.owner_asset_sections;
CREATE POLICY "staff manage owner sections" ON public.owner_asset_sections FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner reads own sections" ON public.owner_asset_sections;
CREATE POLICY "owner reads own sections" ON public.owner_asset_sections FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "staff manage owner section items" ON public.owner_asset_section_items;
CREATE POLICY "staff manage owner section items" ON public.owner_asset_section_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner reads own section items" ON public.owner_asset_section_items;
CREATE POLICY "owner reads own section items" ON public.owner_asset_section_items FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());

ALTER TABLE public.employee_goals ADD COLUMN IF NOT EXISTS auto_track boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS points_per_unit numeric NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.mithraa_links (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mithraa_links TO service_role;
ALTER TABLE public.mithraa_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role manages mithraa links" ON public.mithraa_links;
CREATE POLICY "service role manages mithraa links" ON public.mithraa_links FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON FUNCTION public.attribute_marketing_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_business_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_marketing_lead_from_request() FROM PUBLIC, anon, authenticated;