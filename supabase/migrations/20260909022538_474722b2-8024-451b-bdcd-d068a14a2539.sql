CREATE TABLE public.direct_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_threads TO authenticated;
GRANT ALL ON public.direct_threads TO service_role;
ALTER TABLE public.direct_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages threads" ON public.direct_threads FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "employee reads own thread" ON public.direct_threads FOR SELECT TO authenticated
USING (employee_id = auth.uid());

CREATE TRIGGER direct_threads_updated BEFORE UPDATE ON public.direct_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text,
  attachment_path text,
  attachment_name text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages direct messages" ON public.direct_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "employee reads own direct messages" ON public.direct_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.direct_threads t WHERE t.id = thread_id AND t.employee_id = auth.uid()));

CREATE POLICY "employee replies in open thread" ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.direct_threads t WHERE t.id = thread_id AND t.employee_id = auth.uid() AND t.status = 'open')
);

CREATE TRIGGER direct_messages_updated BEFORE UPDATE ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX direct_messages_thread_idx ON public.direct_messages (thread_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;