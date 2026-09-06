-- ============ MESSAGING / REMINDERS ============
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  body text NOT NULL,
  category text, -- before_due | on_due | overdue | partial | receipt
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reminder_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.contract_payments(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  recipient_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_phone text NOT NULL,
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  message_body text NOT NULL,
  repeat_interval text NOT NULL DEFAULT 'once', -- once | 6h | 8h | 12h | 24h | 3d
  sent_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  status text NOT NULL DEFAULT 'active', -- active | stopped | completed
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id uuid REFERENCES public.reminder_followups(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.contract_payments(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_phone text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  result text NOT NULL DEFAULT 'queued', -- queued | sending | accepted | delivered | read | failed
  failure_reason text,
  provider_message_id text,
  sent_by uuid,
  sent_by_system boolean NOT NULL DEFAULT false,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates, public.reminder_followups TO authenticated;
GRANT SELECT, INSERT ON public.message_log TO authenticated;
GRANT ALL ON public.message_templates, public.reminder_followups, public.message_log TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view templates" ON public.message_templates FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'reminders','view'));
CREATE POLICY "write templates" ON public.message_templates FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'reminders','edit')) WITH CHECK (public.has_perm(auth.uid(),'reminders','edit'));
CREATE POLICY "view followups" ON public.reminder_followups FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'reminders','view'));
CREATE POLICY "write followups" ON public.reminder_followups FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'reminders','send')) WITH CHECK (public.has_perm(auth.uid(),'reminders','send'));
CREATE POLICY "view message log" ON public.message_log FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'reminders','view'));
CREATE POLICY "add message log" ON public.message_log FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'reminders','send'));
CREATE TRIGGER templates_updated BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER followups_updated BEFORE UPDATE ON public.reminder_followups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER message_log_updated BEFORE UPDATE ON public.message_log FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_followups_next ON public.reminder_followups (status, next_send_at);

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  details text,
  task_type text NOT NULL DEFAULT 'normal', -- normal | photography
  priority text NOT NULL DEFAULT 'medium',  -- low | medium | high
  status text NOT NULL DEFAULT 'new',       -- new | in_progress | submitted | completed | returned | cancelled
  due_date date,
  due_time time,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejection_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subtask_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text,
  kind text NOT NULL DEFAULT 'reference', -- reference | photography_result
  review_status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks, public.task_assignees, public.task_attachments TO authenticated;
GRANT SELECT, INSERT ON public.task_history TO authenticated;
GRANT ALL ON public.tasks, public.task_assignees, public.task_attachments, public.task_history TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_task_member(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = _task_id AND ta.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.assigned_by = _user_id);
$$;
REVOKE ALL ON FUNCTION public.is_task_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_task_member(uuid, uuid) TO authenticated;

CREATE POLICY "view tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','view') OR public.is_task_member(id, auth.uid()));
CREATE POLICY "add tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'tasks','add'));
CREATE POLICY "edit tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','edit') OR public.is_task_member(id, auth.uid()))
  WITH CHECK (public.has_perm(auth.uid(),'tasks','edit') OR public.is_task_member(id, auth.uid()));
CREATE POLICY "delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.has_perm(auth.uid(),'tasks','delete'));

CREATE POLICY "view task assignees" ON public.task_assignees FOR SELECT TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','view') OR user_id = auth.uid() OR public.is_task_member(task_id, auth.uid()));
CREATE POLICY "write task assignees" ON public.task_assignees FOR ALL TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','edit')) WITH CHECK (public.has_perm(auth.uid(),'tasks','edit'));
CREATE POLICY "view task attachments" ON public.task_attachments FOR SELECT TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','view') OR public.is_task_member(task_id, auth.uid()));
CREATE POLICY "write task attachments" ON public.task_attachments FOR ALL TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','edit') OR public.is_task_member(task_id, auth.uid()))
  WITH CHECK (public.has_perm(auth.uid(),'tasks','edit') OR public.is_task_member(task_id, auth.uid()));
CREATE POLICY "view task history" ON public.task_history FOR SELECT TO authenticated
  USING (public.has_perm(auth.uid(),'tasks','view') OR public.is_task_member(task_id, auth.uid()));
CREATE POLICY "add task history" ON public.task_history FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_tasks_status ON public.tasks (status, due_date);

-- ============ INTERNAL CHAT ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL, -- property | task
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_conv_property ON public.conversations (property_id) WHERE property_id IS NOT NULL;
CREATE UNIQUE INDEX idx_conv_task ON public.conversations (task_id) WHERE task_id IS NOT NULL;
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text,
  attachment_path text,
  attachment_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations, public.chat_messages TO authenticated;
GRANT ALL ON public.conversations, public.chat_messages TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.has_perm(auth.uid(),'chat','view') OR (task_id IS NOT NULL AND public.is_task_member(task_id, auth.uid())));
CREATE POLICY "create conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (public.has_perm(auth.uid(),'chat','view') OR (task_id IS NOT NULL AND public.is_task_member(task_id, auth.uid())));
CREATE POLICY "view chat messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
    AND (public.has_perm(auth.uid(),'chat','view') OR (c.task_id IS NOT NULL AND public.is_task_member(c.task_id, auth.uid())))));
CREATE POLICY "send chat messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id
    AND (public.has_perm(auth.uid(),'chat','view') OR (c.task_id IS NOT NULL AND public.is_task_member(c.task_id, auth.uid())))));
CREATE POLICY "edit own chat messages" ON public.chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE TRIGGER chat_messages_updated BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_chat_conv ON public.chat_messages (conversation_id, created_at);

-- ============ CRM ============
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_type text NOT NULL DEFAULT 'rent', -- buy | rent
  stage text NOT NULL DEFAULT 'new',
  expected_value numeric(14,2),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_follow_up date,
  close_reason text,
  supply_request_id uuid REFERENCES public.supply_requests(id) ON DELETE SET NULL,
  listing_request_id uuid REFERENCES public.listing_requests(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.opportunity_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  UNIQUE (opportunity_id, property_id)
);
CREATE TABLE public.opportunity_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- call | note | viewing | task | whatsapp
  subject text,
  outcome text,
  happened_at timestamptz NOT NULL DEFAULT now(),
  next_follow_up date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities, public.opportunity_properties, public.crm_activities TO authenticated;
GRANT SELECT, INSERT ON public.opportunity_stage_history TO authenticated;
GRANT ALL ON public.opportunities, public.opportunity_properties, public.opportunity_stage_history, public.crm_activities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view opportunities" ON public.opportunities FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'crm','view') OR assigned_to = auth.uid());
CREATE POLICY "write opportunities" ON public.opportunities FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'crm','edit') OR assigned_to = auth.uid()) WITH CHECK (public.has_perm(auth.uid(),'crm','edit') OR assigned_to = auth.uid());
CREATE POLICY "view opp props" ON public.opportunity_properties FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'crm','view'));
CREATE POLICY "write opp props" ON public.opportunity_properties FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'crm','edit')) WITH CHECK (public.has_perm(auth.uid(),'crm','edit'));
CREATE POLICY "view opp history" ON public.opportunity_stage_history FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'crm','view'));
CREATE POLICY "add opp history" ON public.opportunity_stage_history FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "view activities" ON public.crm_activities FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'crm','view') OR created_by = auth.uid());
CREATE POLICY "write activities" ON public.crm_activities FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'crm','edit') OR created_by = auth.uid()) WITH CHECK (public.has_perm(auth.uid(),'crm','edit') OR created_by = auth.uid());
CREATE TRIGGER opportunities_updated BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_notifications_user ON public.notifications (user_id, is_read, created_at DESC);