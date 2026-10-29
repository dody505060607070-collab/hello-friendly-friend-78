CREATE TABLE IF NOT EXISTS public.owner_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  recipient_name text,
  recipient_phone text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_followup_queue TO authenticated;
GRANT ALL ON public.owner_followup_queue TO service_role;
ALTER TABLE public.owner_followup_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owners viewers read followup queue" ON public.owner_followup_queue;
CREATE POLICY "owners viewers read followup queue" ON public.owner_followup_queue FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'owners', 'view'));
CREATE INDEX IF NOT EXISTS owner_followup_queue_pending_idx ON public.owner_followup_queue (status, created_at);