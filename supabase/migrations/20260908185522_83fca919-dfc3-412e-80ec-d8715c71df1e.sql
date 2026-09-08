
CREATE TABLE IF NOT EXISTS public.site_kill_switch (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  locked BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL DEFAULT 'الموقع متوقف مؤقتاً. يرجى التواصل مع المالك.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_kill_switch (id, locked) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.site_kill_switch TO anon, authenticated;
GRANT ALL ON public.site_kill_switch TO service_role;

ALTER TABLE public.site_kill_switch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kill_switch_public_read" ON public.site_kill_switch;
CREATE POLICY "kill_switch_public_read" ON public.site_kill_switch
  FOR SELECT TO anon, authenticated USING (true);
