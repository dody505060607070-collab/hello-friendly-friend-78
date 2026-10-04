ALTER TABLE public.employee_sessions ADD COLUMN IF NOT EXISTS current_path text, ADD COLUMN IF NOT EXISTS device_label text, ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.owner_requests ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE, ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'maintenance', ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS title text, ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.owner_requests ALTER COLUMN owner_user_id DROP NOT NULL, ALTER COLUMN request_type DROP NOT NULL;
ALTER TABLE public.unit_expenses ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE, ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'maintenance', ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.unit_expenses ALTER COLUMN owner_user_id DROP NOT NULL, ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.owner_delegates ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE, ADD COLUMN IF NOT EXISTS delegate_contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE, ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.owner_delegates ALTER COLUMN owner_user_id DROP NOT NULL, ALTER COLUMN delegate_name DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS owner_delegates_owner_delegate_uidx ON public.owner_delegates(owner_id, delegate_contact_id);

GRANT SELECT, INSERT, UPDATE ON public.employee_sessions TO authenticated;
GRANT ALL ON public.employee_sessions TO service_role;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admins view employee sessions" ON public.employee_sessions;
CREATE POLICY "super admins view employee sessions" ON public.employee_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "users view own sessions" ON public.employee_sessions;
CREATE POLICY "users view own sessions" ON public.employee_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users open own sessions" ON public.employee_sessions;
CREATE POLICY "users open own sessions" ON public.employee_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users update own sessions" ON public.employee_sessions;
CREATE POLICY "users update own sessions" ON public.employee_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS employee_sessions_user_started_idx ON public.employee_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS employee_sessions_active_idx ON public.employee_sessions(last_seen_at DESC) WHERE ended_at IS NULL;

ALTER TABLE public.property_images ADD COLUMN IF NOT EXISTS focal_x numeric NOT NULL DEFAULT 50;
ALTER TABLE public.property_images ADD COLUMN IF NOT EXISTS focal_y numeric NOT NULL DEFAULT 50;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS property_type_id uuid REFERENCES public.property_types(id) ON DELETE SET NULL;
UPDATE public.properties p SET city_id = c.id FROM public.cities c WHERE p.city_id IS NULL AND lower(trim(p.city)) = lower(trim(c.name));
UPDATE public.properties p SET district_id = d.id FROM public.districts d WHERE p.district_id IS NULL AND lower(trim(p.district)) = lower(trim(d.name));
UPDATE public.properties p SET property_type_id = t.id FROM public.property_types t WHERE p.property_type_id IS NULL AND lower(trim(p.property_type)) = lower(trim(t.name));
CREATE INDEX IF NOT EXISTS properties_city_id_idx ON public.properties(city_id);
CREATE INDEX IF NOT EXISTS properties_district_id_idx ON public.properties(district_id);
CREATE INDEX IF NOT EXISTS properties_type_id_idx ON public.properties(property_type_id);

CREATE OR REPLACE FUNCTION public.current_owner_contact_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ca.contact_id FROM public.client_accounts ca
  JOIN public.user_roles ur ON ur.user_id = ca.user_id AND ur.role = 'owner'
  WHERE ca.user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_owner_contact_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_owner_contact_id() TO authenticated;

DROP POLICY IF EXISTS "owners view own contact" ON public.contacts;
CREATE POLICY "owners view own contact" ON public.contacts FOR SELECT TO authenticated USING (id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "owners view their tenants" ON public.contacts;
CREATE POLICY "owners view their tenants" ON public.contacts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.owner_id = public.current_owner_contact_id() AND c.tenant_id = contacts.id));
DROP POLICY IF EXISTS "owners view own buildings" ON public.buildings;
CREATE POLICY "owners view own buildings" ON public.buildings FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "owners view own units" ON public.units;
CREATE POLICY "owners view own units" ON public.units FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "owners view own properties" ON public.properties;
CREATE POLICY "owners view own properties" ON public.properties FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "owners view own contracts" ON public.contracts;
CREATE POLICY "owners view own contracts" ON public.contracts FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "owners view own contract payments" ON public.contract_payments;
CREATE POLICY "owners view own contract payments" ON public.contract_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_payments.contract_id AND c.owner_id = public.current_owner_contact_id()));
DROP POLICY IF EXISTS "owners view own invoices" ON public.invoices;
CREATE POLICY "owners view own invoices" ON public.invoices FOR SELECT TO authenticated USING (contact_id = public.current_owner_contact_id() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = invoices.contract_id AND c.owner_id = public.current_owner_contact_id()));
DROP POLICY IF EXISTS "owners view own invoice items" ON public.invoice_items;
CREATE POLICY "owners view own invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND (i.contact_id = public.current_owner_contact_id() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = i.contract_id AND c.owner_id = public.current_owner_contact_id()))));

CREATE OR REPLACE FUNCTION public.touch_employee_session(_session_id uuid, _path text, _device text DEFAULT NULL)
RETURNS public.employee_sessions LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE result public.employee_sessions;
BEGIN
  UPDATE public.employee_sessions
  SET last_seen_at = now(), current_path = left(_path, 300), device_label = coalesce(left(_device, 180), device_label), duration_seconds = greatest(0, extract(epoch FROM now() - started_at)::integer)
  WHERE id = _session_id AND user_id = auth.uid() AND ended_at IS NULL
  RETURNING * INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.touch_employee_session(uuid, text, text) TO authenticated;
CREATE OR REPLACE FUNCTION public.close_employee_session(_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  UPDATE public.employee_sessions SET ended_at = now(), last_seen_at = now(), duration_seconds = greatest(0, extract(epoch FROM now() - started_at)::integer)
  WHERE id = _session_id AND user_id = auth.uid() AND ended_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_employee_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_business_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor uuid := auth.uid(); row_id uuid; payload jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor) THEN RETURN coalesce(NEW, OLD); END IF;
  row_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  payload := jsonb_build_object('table', TG_TABLE_NAME, 'operation', lower(TG_OP));
  IF TG_OP = 'UPDATE' THEN payload := payload || jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)); END IF;
  INSERT INTO public.activity_log(actor_id, action, entity_type, entity_id, details) VALUES (actor, lower(TG_OP), TG_TABLE_NAME, row_id, payload);
  RETURN coalesce(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS audit_properties ON public.properties;
CREATE TRIGGER audit_properties AFTER INSERT OR UPDATE OR DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_buildings ON public.buildings;
CREATE TRIGGER audit_buildings AFTER INSERT OR UPDATE OR DELETE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_units ON public.units;
CREATE TRIGGER audit_units AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_contracts ON public.contracts;
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_tasks ON public.tasks;
CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_contacts ON public.contacts;
CREATE TRIGGER audit_contacts AFTER INSERT OR UPDATE OR DELETE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
DROP TRIGGER IF EXISTS audit_payments ON public.contract_payments;
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.contract_payments FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_requests TO authenticated;
GRANT ALL ON public.owner_requests TO service_role;
ALTER TABLE public.owner_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner requests" ON public.owner_requests;
CREATE POLICY "staff manage owner requests" ON public.owner_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner reads own requests" ON public.owner_requests;
CREATE POLICY "owner reads own requests" ON public.owner_requests FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
DROP POLICY IF EXISTS "owner creates own requests" ON public.owner_requests;
CREATE POLICY "owner creates own requests" ON public.owner_requests FOR INSERT TO authenticated WITH CHECK (owner_id = public.current_owner_contact_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_expenses TO authenticated;
GRANT ALL ON public.unit_expenses TO service_role;
ALTER TABLE public.unit_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage unit expenses" ON public.unit_expenses;
CREATE POLICY "staff manage unit expenses" ON public.unit_expenses FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner manages own expenses" ON public.unit_expenses;
CREATE POLICY "owner manages own expenses" ON public.unit_expenses FOR ALL TO authenticated USING (owner_id = public.current_owner_contact_id()) WITH CHECK (owner_id = public.current_owner_contact_id());
CREATE TABLE IF NOT EXISTS public.unit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_documents TO authenticated;
GRANT ALL ON public.unit_documents TO service_role;
ALTER TABLE public.unit_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage unit documents" ON public.unit_documents;
CREATE POLICY "staff manage unit documents" ON public.unit_documents FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner manages own documents" ON public.unit_documents;
CREATE POLICY "owner manages own documents" ON public.unit_documents FOR ALL TO authenticated USING (owner_id = public.current_owner_contact_id()) WITH CHECK (owner_id = public.current_owner_contact_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_delegates TO authenticated;
GRANT ALL ON public.owner_delegates TO service_role;
ALTER TABLE public.owner_delegates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff manage owner delegates" ON public.owner_delegates;
CREATE POLICY "staff manage owner delegates" ON public.owner_delegates FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "owner manages own delegates" ON public.owner_delegates;
CREATE POLICY "owner manages own delegates" ON public.owner_delegates FOR ALL TO authenticated USING (owner_id = public.current_owner_contact_id()) WITH CHECK (owner_id = public.current_owner_contact_id());
CREATE INDEX IF NOT EXISTS idx_owner_requests_owner ON public.owner_requests(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unit_expenses_owner ON public.unit_expenses(owner_id, spent_on DESC);
CREATE INDEX IF NOT EXISTS idx_unit_documents_owner ON public.unit_documents(owner_id, created_at DESC);

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_phone TEXT;

DROP POLICY IF EXISTS "edit transactions" ON public.payment_transactions;
CREATE POLICY "edit transactions" ON public.payment_transactions FOR UPDATE TO authenticated
USING (has_perm(auth.uid(), 'payments'::text, 'collect'::text)) WITH CHECK (has_perm(auth.uid(), 'payments'::text, 'collect'::text));
DROP POLICY IF EXISTS "delete transactions" ON public.payment_transactions;
CREATE POLICY "delete transactions" ON public.payment_transactions FOR DELETE TO authenticated USING (has_perm(auth.uid(), 'payments'::text, 'collect'::text));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reminder_state TO authenticated;
GRANT ALL ON public.task_reminder_state TO service_role;