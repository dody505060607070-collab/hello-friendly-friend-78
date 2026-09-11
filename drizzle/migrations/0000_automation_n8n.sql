CREATE TABLE IF NOT EXISTS public.automation_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  webhook_url text,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.automation_config TO authenticated;
GRANT ALL ON public.automation_config TO service_role;
ALTER TABLE public.automation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read automation config" ON public.automation_config
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

INSERT INTO public.automation_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  direction text NOT NULL DEFAULT 'out',
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  response text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_events_created_idx ON public.automation_events (created_at DESC);

GRANT SELECT ON public.automation_events TO authenticated;
GRANT ALL ON public.automation_events TO service_role;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read automation events" ON public.automation_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));