CREATE TABLE public.employee_activities (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id),
  activity_type text not null default 'task',
  subject text not null,
  details text,
  related_contact_id uuid references public.contacts(id) on delete set null,
  notes text,
  status text not null default 'open',
  outcome text,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_activities TO authenticated;
GRANT ALL ON public.employee_activities TO service_role;
ALTER TABLE public.employee_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities readable by admin or assignee" ON public.employee_activities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR employee_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "admins manage activities" ON public.employee_activities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin or assignee update activities" ON public.employee_activities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR employee_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR employee_id = auth.uid());
CREATE POLICY "admins delete activities" ON public.employee_activities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER employee_activities_updated BEFORE UPDATE ON public.employee_activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_view_activity(_activity_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'super_admin') OR EXISTS (
    SELECT 1 FROM public.employee_activities a
    WHERE a.id = _activity_id AND (a.employee_id = _user_id OR a.created_by = _user_id)
  );
$$;

CREATE TABLE public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.employee_activities(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.activity_messages TO authenticated;
GRANT ALL ON public.activity_messages TO service_role;
ALTER TABLE public.activity_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity chat readable by participants" ON public.activity_messages FOR SELECT TO authenticated
  USING (public.can_view_activity(activity_id, auth.uid()));
CREATE POLICY "activity chat insert by participants" ON public.activity_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_view_activity(activity_id, auth.uid()));
CREATE INDEX activity_messages_activity_idx ON public.activity_messages(activity_id, created_at);

CREATE TABLE public.group_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  attachment_path text,
  attachment_name text,
  reply_to uuid references public.group_messages(id) on delete set null,
  is_pinned boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read group chat" ON public.group_messages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff send group chat" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND sender_id = auth.uid());
CREATE POLICY "own or admin edit group chat" ON public.group_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "own or admin delete group chat" ON public.group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX group_messages_created_idx ON public.group_messages(created_at);