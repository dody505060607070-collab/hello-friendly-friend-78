CREATE TABLE IF NOT EXISTS public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  login_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.client_accounts TO authenticated;
GRANT ALL ON public.client_accounts TO service_role;

ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client sees own account" ON public.client_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "staff sees client accounts" ON public.client_accounts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));