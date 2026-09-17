ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rent_period text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text;

UPDATE public.properties SET rent_period = 'yearly'
WHERE purpose = 'rent' AND rent_period IS NULL;

ALTER TABLE public.property_images
  ADD COLUMN IF NOT EXISTS focal_x numeric,
  ADD COLUMN IF NOT EXISTS focal_y numeric;

CREATE INDEX IF NOT EXISTS idx_contract_imports_file_hash ON public.contract_imports(file_hash);

CREATE TABLE IF NOT EXISTS public.employee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  user_agent text,
  platform text
);
GRANT SELECT, INSERT, UPDATE ON public.employee_sessions TO authenticated;
GRANT ALL ON public.employee_sessions TO service_role;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own session write" ON public.employee_sessions;
CREATE POLICY "own session write" ON public.employee_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own session update" ON public.employee_sessions;
CREATE POLICY "own session update" ON public.employee_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "session read" ON public.employee_sessions;
CREATE POLICY "session read" ON public.employee_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.owner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  owner_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.unit_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.owner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.owner_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  delegate_user_id uuid,
  delegate_name text NOT NULL,
  delegate_phone text,
  access_level text NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, delegate_phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_requests TO authenticated;
GRANT ALL ON public.owner_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_expenses TO authenticated;
GRANT ALL ON public.unit_expenses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_documents TO authenticated;
GRANT ALL ON public.owner_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_delegates TO authenticated;
GRANT ALL ON public.owner_delegates TO service_role;

ALTER TABLE public.owner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_delegates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['owner_requests','unit_expenses','owner_documents','owner_delegates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner rw %1$s" ON public.%1$I', t);
    EXECUTE format($p$CREATE POLICY "owner rw %1$s" ON public.%1$I FOR ALL TO authenticated
      USING (owner_user_id = auth.uid() OR public.has_perm(auth.uid(), 'owners', 'view'))
      WITH CHECK (owner_user_id = auth.uid() OR public.has_perm(auth.uid(), 'owners', 'edit'))$p$, t);
  END LOOP;
END $$;

UPDATE public.reminder_followups
SET status = 'stopped', next_send_at = NULL, updated_at = now()
WHERE payment_id IS NULL AND status IN ('active','pending','scheduled');