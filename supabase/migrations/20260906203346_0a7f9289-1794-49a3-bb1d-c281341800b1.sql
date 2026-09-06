-- ============ CONTACTS ============
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  kind text NOT NULL DEFAULT 'individual', -- individual | company
  roles text[] NOT NULL DEFAULT '{}',      -- owner | tenant | buyer | broker
  national_id text,
  phone text,
  phone_alt text,
  whatsapp text,
  email text,
  address text,
  source text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  preferred_districts text[],
  interested_property_type text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_contacts_national_id ON public.contacts (national_id) WHERE national_id IS NOT NULL;
CREATE INDEX idx_contacts_phone ON public.contacts (phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view contacts" ON public.contacts FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'contacts','view'));
CREATE POLICY "add contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'contacts','add'));
CREATE POLICY "edit contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'contacts','edit')) WITH CHECK (public.has_perm(auth.uid(),'contacts','edit'));
CREATE POLICY "delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_perm(auth.uid(),'contacts','delete'));
CREATE TRIGGER contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BUILDINGS / UNITS ============
CREATE TABLE public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  city text,
  district text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  unit_number text NOT NULL,
  unit_type text,
  floor text,
  area numeric(10,2),
  rooms integer,
  status text NOT NULL DEFAULT 'vacant', -- vacant | occupied | reserved | unavailable
  is_rentable boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, unit_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings, public.units TO authenticated;
GRANT ALL ON public.buildings, public.units TO service_role;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view buildings" ON public.buildings FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'owners','view'));
CREATE POLICY "write buildings" ON public.buildings FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'owners','edit')) WITH CHECK (public.has_perm(auth.uid(),'owners','edit'));
CREATE POLICY "view units" ON public.units FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'owners','view'));
CREATE POLICY "write units" ON public.units FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'owners','edit')) WITH CHECK (public.has_perm(auth.uid(),'owners','edit'));
CREATE TRIGGER buildings_updated BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROPERTIES ============
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  purpose text NOT NULL DEFAULT 'rent',  -- sale | rent
  property_type text,
  city text,
  district text,
  price_text text,
  price_value numeric(14,2),
  description text,
  owner_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  whatsapp_number text,
  is_visible boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  map_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text NOT NULL DEFAULT 'available', -- available | reserved | rented | sold | archived
  needs_review boolean NOT NULL DEFAULT false,
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_purpose ON public.properties (purpose);
CREATE INDEX idx_properties_visible ON public.properties (is_visible, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT SELECT ON public.properties TO anon;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read visible properties" ON public.properties FOR SELECT TO anon USING (is_visible AND status <> 'archived');
CREATE POLICY "staff view properties" ON public.properties FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'properties','view') OR (is_visible AND status <> 'archived'));
CREATE POLICY "staff add properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'properties','add'));
CREATE POLICY "staff edit properties" ON public.properties FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'properties','edit')) WITH CHECK (public.has_perm(auth.uid(),'properties','edit'));
CREATE POLICY "staff delete properties" ON public.properties FOR DELETE TO authenticated USING (public.has_perm(auth.uid(),'properties','delete'));
CREATE TRIGGER properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.property_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.property_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  years integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_images, public.property_videos, public.property_guarantees TO authenticated;
GRANT SELECT ON public.property_images, public.property_videos, public.property_guarantees TO anon;
GRANT ALL ON public.property_images, public.property_videos, public.property_guarantees TO service_role;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_guarantees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read property images" ON public.property_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_visible OR public.has_perm(auth.uid(),'properties','view'))));
CREATE POLICY "write property images" ON public.property_images FOR ALL TO authenticated
  USING (public.has_perm(auth.uid(),'properties','edit')) WITH CHECK (public.has_perm(auth.uid(),'properties','edit'));
CREATE POLICY "read property videos" ON public.property_videos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_visible OR public.has_perm(auth.uid(),'properties','view'))));
CREATE POLICY "write property videos" ON public.property_videos FOR ALL TO authenticated
  USING (public.has_perm(auth.uid(),'properties','edit')) WITH CHECK (public.has_perm(auth.uid(),'properties','edit'));
CREATE POLICY "read property guarantees" ON public.property_guarantees FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.is_visible OR public.has_perm(auth.uid(),'properties','view'))));
CREATE POLICY "write property guarantees" ON public.property_guarantees FOR ALL TO authenticated
  USING (public.has_perm(auth.uid(),'properties','edit')) WITH CHECK (public.has_perm(auth.uid(),'properties','edit'));
CREATE INDEX idx_property_images_prop ON public.property_images (property_id, sort_order);

-- ============ LISTING REQUESTS (طلبات عرض عقار) ============
CREATE TABLE public.listing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  purpose text NOT NULL DEFAULT 'rent',
  property_type text,
  city text,
  district text,
  description text,
  asking_price text,
  rent_period text,
  map_url text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending | in_review | approved | rejected | converted
  admin_notes text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ============ SUPPLY REQUESTS (طلبات توفير عقار) ============
CREATE TABLE public.supply_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  request_type text NOT NULL DEFAULT 'rent', -- buy | rent
  city text,
  districts text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  property_type text,
  requester_type text NOT NULL DEFAULT 'client', -- client | broker
  broker_name text,
  broker_phone text,
  requester_notes text,
  status text NOT NULL DEFAULT 'in_review', -- in_review | following | fulfilled | closed
  admin_notes text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL, -- listing | supply
  request_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_requests, public.supply_requests TO authenticated;
GRANT INSERT ON public.listing_requests, public.supply_requests TO anon;
GRANT SELECT, INSERT ON public.request_status_history TO authenticated;
GRANT ALL ON public.listing_requests, public.supply_requests, public.request_status_history TO service_role;
ALTER TABLE public.listing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public submit listing request" ON public.listing_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "staff view listing requests" ON public.listing_requests FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'requests','view'));
CREATE POLICY "staff write listing requests" ON public.listing_requests FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'requests','edit')) WITH CHECK (public.has_perm(auth.uid(),'requests','edit'));
CREATE POLICY "public submit supply request" ON public.supply_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "staff view supply requests" ON public.supply_requests FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'requests','view'));
CREATE POLICY "staff write supply requests" ON public.supply_requests FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'requests','edit')) WITH CHECK (public.has_perm(auth.uid(),'requests','edit'));
CREATE POLICY "staff read status history" ON public.request_status_history FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'requests','view'));
CREATE POLICY "staff add status history" ON public.request_status_history FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'requests','edit'));
CREATE TRIGGER listing_requests_updated BEFORE UPDATE ON public.listing_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER supply_requests_updated BEFORE UPDATE ON public.supply_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();