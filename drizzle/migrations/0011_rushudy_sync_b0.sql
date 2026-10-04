ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org text NOT NULL DEFAULT 'mithraa'
  CHECK (org IN ('mithraa', 'rashoudi'));
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'mithraa'
  CHECK (channel IN ('mithraa', 'rashoudi', 'shared'));
CREATE INDEX IF NOT EXISTS group_messages_channel_created_idx ON public.group_messages (channel, created_at);
CREATE OR REPLACE FUNCTION public.user_org(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT p.org FROM public.profiles p WHERE p.id = _user_id), 'mithraa') $$;
GRANT EXECUTE ON FUNCTION public.user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org(uuid) TO service_role;
DROP POLICY IF EXISTS "staff read group chat" ON public.group_messages;
DROP POLICY IF EXISTS "staff send group chat" ON public.group_messages;
DROP POLICY IF EXISTS "staff read permitted group chat channels" ON public.group_messages;
DROP POLICY IF EXISTS "staff send permitted group chat channels" ON public.group_messages;
CREATE POLICY "staff read permitted group chat channels" ON public.group_messages
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND (channel = 'shared' OR channel = public.user_org(auth.uid()) OR public.has_role(auth.uid(), 'super_admin')));
CREATE POLICY "staff send permitted group chat channels" ON public.group_messages
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND sender_id = auth.uid() AND (channel = 'shared' OR channel = public.user_org(auth.uid()) OR public.has_role(auth.uid(), 'super_admin')));

DROP POLICY IF EXISTS "staff insert activity" ON public.activity_log;
CREATE POLICY "staff insert activity" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND (actor_id IS NULL OR actor_id = auth.uid()));
DROP POLICY IF EXISTS "add opp history" ON public.opportunity_stage_history;
CREATE POLICY "add opp history" ON public.opportunity_stage_history FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND (changed_by IS NULL OR changed_by = auth.uid()));
DROP POLICY IF EXISTS "staff add status history" ON public.request_status_history;
CREATE POLICY "staff add status history" ON public.request_status_history FOR INSERT TO authenticated
  WITH CHECK (has_perm(auth.uid(), 'requests'::text, 'edit'::text) AND (changed_by IS NULL OR changed_by = auth.uid()));
DROP POLICY IF EXISTS "add task history" ON public.task_history;
CREATE POLICY "add task history" ON public.task_history FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND (actor_id IS NULL OR actor_id = auth.uid()));

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS close_probability integer NOT NULL DEFAULT 50;
DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_close_probability_check CHECK (close_probability BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS tasks_contract_id_idx ON public.tasks(contract_id);
CREATE OR REPLACE FUNCTION public.create_contract_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tasks (title, details, task_type, priority, status, due_date, contract_id, property_id, contact_id, assigned_by)
  VALUES
    ('تحصيل أول دفعة للعقد ' || NEW.contract_number, 'مراجعة وتحصيل أول دفعة مستحقة للعقد الجديد.', 'contract_collection', 'high', 'new', COALESCE(NEW.start_date, CURRENT_DATE), NEW.id, NEW.property_id, NEW.tenant_id, NEW.created_by),
    ('تسليم مفاتيح العقد ' || NEW.contract_number, 'تنسيق تسليم المفاتيح وتوثيق حالة التسليم.', 'key_handover', 'normal', 'new', COALESCE(NEW.start_date, CURRENT_DATE), NEW.id, NEW.property_id, NEW.tenant_id, NEW.created_by),
    ('متابعة تجديد العقد ' || NEW.contract_number, 'التواصل مع الأطراف قبل انتهاء العقد لتحديد قرار التجديد.', 'contract_renewal', 'normal', 'new', COALESCE(NEW.end_date - 30, CURRENT_DATE + 30), NEW.id, NEW.property_id, NEW.tenant_id, NEW.created_by);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS create_contract_tasks_after_insert ON public.contracts;
CREATE TRIGGER create_contract_tasks_after_insert AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.create_contract_tasks();

CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_role text NOT NULL DEFAULT 'tenant',
  image_data text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.contract_signatures TO authenticated;
GRANT ALL ON public.contract_signatures TO service_role;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view permitted contract signatures" ON public.contract_signatures;
CREATE POLICY "view permitted contract signatures" ON public.contract_signatures FOR SELECT TO authenticated
USING (public.has_perm(auth.uid(), 'contracts', 'view') OR EXISTS (SELECT 1 FROM public.contracts c JOIN public.client_accounts ca ON ca.contact_id = c.tenant_id WHERE c.id = contract_signatures.contract_id AND ca.user_id = auth.uid()));
DROP POLICY IF EXISTS "sign permitted contracts" ON public.contract_signatures;
CREATE POLICY "sign permitted contracts" ON public.contract_signatures FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (public.has_perm(auth.uid(), 'contracts', 'edit') OR EXISTS (SELECT 1 FROM public.contracts c JOIN public.client_accounts ca ON ca.contact_id = c.tenant_id WHERE c.id = contract_signatures.contract_id AND ca.user_id = auth.uid())));
DROP POLICY IF EXISTS "delete contract signatures" ON public.contract_signatures;
CREATE POLICY "delete contract signatures" ON public.contract_signatures FOR DELETE TO authenticated
USING (public.has_perm(auth.uid(), 'contracts', 'edit'));
CREATE INDEX IF NOT EXISTS contract_signatures_contract_id_idx ON public.contract_signatures(contract_id, signed_at DESC);

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  size_bytes bigint,
  tables_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admins view backups" ON public.backup_runs;
CREATE POLICY "super admins view backups" ON public.backup_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX IF NOT EXISTS backup_runs_created_at_idx ON public.backup_runs(created_at DESC);

DROP POLICY IF EXISTS "public upload listing request media" ON storage.objects;
CREATE POLICY "public upload listing request media" ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'listing-request-media' AND (storage.foldername(name))[1] = 'public' AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp'));
DROP POLICY IF EXISTS "staff read listing request media" ON storage.objects;
CREATE POLICY "staff read listing request media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'listing-request-media' AND public.has_perm(auth.uid(), 'requests', 'view'));
DROP POLICY IF EXISTS "staff delete listing request media" ON storage.objects;
CREATE POLICY "staff delete listing request media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'listing-request-media' AND public.has_perm(auth.uid(), 'requests', 'edit'));

ALTER TABLE public.message_log ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_log_idempotency_key_unique ON public.message_log (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_log_task_id_created_idx ON public.message_log (task_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.task_reminder_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  next_send_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
GRANT SELECT ON public.task_reminder_state TO authenticated;
GRANT ALL ON public.task_reminder_state TO service_role;
ALTER TABLE public.task_reminder_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff view task reminder state" ON public.task_reminder_state;
CREATE POLICY "staff view task reminder state" ON public.task_reminder_state FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS task_reminder_state_due_idx ON public.task_reminder_state (next_send_at);
CREATE TABLE IF NOT EXISTS public.automation_job_state (
  job_name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'ready',
  lease_until timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.automation_job_state TO authenticated;
GRANT ALL ON public.automation_job_state TO service_role;
ALTER TABLE public.automation_job_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins view automation job state" ON public.automation_job_state;
CREATE POLICY "admins view automation job state" ON public.automation_job_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE OR REPLACE FUNCTION public.acquire_automation_lease(_job_name text, _lease_seconds integer DEFAULT 3300)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE acquired boolean;
BEGIN
  INSERT INTO public.automation_job_state (job_name, status, lease_until, last_started_at, updated_at)
  VALUES (_job_name, 'running', now() + make_interval(secs => _lease_seconds), now(), now())
  ON CONFLICT (job_name) DO UPDATE
  SET status = 'running', lease_until = now() + make_interval(secs => _lease_seconds), last_started_at = now(), updated_at = now()
  WHERE automation_job_state.status <> 'paused' AND (automation_job_state.lease_until IS NULL OR automation_job_state.lease_until < now());
  GET DIAGNOSTICS acquired = ROW_COUNT;
  RETURN acquired;
END;
$$;
CREATE OR REPLACE FUNCTION public.finish_automation_lease(_job_name text, _error text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.automation_job_state
  SET status = CASE WHEN _error IS NULL THEN 'ready' ELSE 'failed' END, lease_until = NULL, last_finished_at = now(), last_error = _error,
      consecutive_failures = CASE WHEN _error IS NULL THEN 0 ELSE consecutive_failures + 1 END, updated_at = now()
  WHERE job_name = _job_name;
$$;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS converted_by uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.validate_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.property_id IS NULL THEN RAISE EXCEPTION 'RESERVATION_PROPERTY_REQUIRED'; END IF;
  IF NEW.employee_id IS NULL THEN RAISE EXCEPTION 'RESERVATION_EMPLOYEE_REQUIRED'; END IF;
  IF NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'RESERVATION_INVALID_DURATION'; END IF;
  IF NEW.status NOT IN ('hold', 'active', 'cancelled', 'converted', 'expired') THEN RAISE EXCEPTION 'RESERVATION_INVALID_STATUS'; END IF;
  IF NEW.status IN ('hold', 'active') AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id <> NEW.id AND r.status IN ('hold', 'active') AND r.ends_at > now()
      AND ((NEW.property_id IS NOT NULL AND r.property_id = NEW.property_id) OR (NEW.unit_id IS NOT NULL AND r.unit_id = NEW.unit_id))
      AND NEW.starts_at < r.ends_at AND NEW.ends_at > r.starts_at
  ) THEN RAISE EXCEPTION 'RESERVATION_CONFLICT'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reservations_no_overlap ON public.reservations;
CREATE TRIGGER reservations_no_overlap
BEFORE INSERT OR UPDATE OF property_id, unit_id, starts_at, ends_at, status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_reservation();
CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.reservations SET status = 'expired', updated_at = now() WHERE status IN ('hold', 'active') AND ends_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
CREATE OR REPLACE FUNCTION public.create_reservation(_property_id uuid, _employee_id uuid, _contact_id uuid DEFAULT NULL, _duration_hours integer DEFAULT 24, _notes text DEFAULT NULL)
RETURNS public.reservations LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE created public.reservations;
BEGIN
  PERFORM public.expire_reservations();
  IF _duration_hours NOT IN (24, 48, 72, 168) THEN RAISE EXCEPTION 'RESERVATION_INVALID_DURATION'; END IF;
  INSERT INTO public.reservations (property_id, employee_id, contact_id, starts_at, ends_at, notes, status, created_by)
  VALUES (_property_id, _employee_id, _contact_id, now(), now() + make_interval(hours => _duration_hours), NULLIF(btrim(_notes), ''), 'active', auth.uid())
  RETURNING * INTO created;
  RETURN created;
END;
$$;
CREATE OR REPLACE FUNCTION public.extend_reservation(_reservation_id uuid)
RETURNS public.reservations LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE changed public.reservations;
BEGIN
  PERFORM public.expire_reservations();
  UPDATE public.reservations SET ends_at = ends_at + interval '24 hours', extended_count = extended_count + 1, updated_at = now()
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now()
  RETURNING * INTO changed;
  IF changed.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  RETURN changed;
END;
$$;
CREATE OR REPLACE FUNCTION public.cancel_reservation(_reservation_id uuid)
RETURNS public.reservations LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE changed public.reservations;
BEGIN
  PERFORM public.expire_reservations();
  UPDATE public.reservations SET status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), updated_at = now()
  WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now()
  RETURNING * INTO changed;
  IF changed.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  RETURN changed;
END;
$$;
CREATE OR REPLACE FUNCTION public.convert_reservation_to_contract(_reservation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  reservation_row public.reservations;
  property_row public.properties;
  new_contract_id uuid;
BEGIN
  PERFORM public.expire_reservations();
  SELECT * INTO reservation_row FROM public.reservations WHERE id = _reservation_id AND status IN ('hold', 'active') AND ends_at > now() FOR UPDATE;
  IF reservation_row.id IS NULL THEN RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE'; END IF;
  SELECT * INTO property_row FROM public.properties WHERE id = reservation_row.property_id;
  INSERT INTO public.contracts (contract_number, contract_type, owner_id, tenant_id, property_id, unit_id, start_date, status, source, created_by)
  VALUES ('RSV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), CASE WHEN property_row.purpose = 'sale' THEN 'sale' ELSE 'rent' END,
    property_row.owner_id, reservation_row.contact_id, reservation_row.property_id, reservation_row.unit_id, current_date, 'draft', 'reservation', auth.uid())
  RETURNING id INTO new_contract_id;
  UPDATE public.reservations SET status = 'converted', contract_id = new_contract_id, converted_by = auth.uid(), converted_at = now(), updated_at = now()
  WHERE id = reservation_row.id;
  RETURN new_contract_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_reservation_to_contract(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_reservation_to_contract(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO authenticated, service_role;