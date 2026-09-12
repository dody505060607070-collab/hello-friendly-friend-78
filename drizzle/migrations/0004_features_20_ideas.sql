-- 1) تقييم الفرص حسب الاحتمالية
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS probability integer NOT NULL DEFAULT 50;

-- 2) التوقيع الإلكتروني للعقود
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_role text NOT NULL DEFAULT 'tenant',
  signature_data text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_signatures TO authenticated;
GRANT ALL ON public.contract_signatures TO service_role;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view contract signatures" ON public.contract_signatures;
CREATE POLICY "view contract signatures" ON public.contract_signatures
  FOR SELECT TO authenticated
  USING (public.has_perm(auth.uid(), 'contracts', 'view'));

DROP POLICY IF EXISTS "write contract signatures" ON public.contract_signatures;
CREATE POLICY "write contract signatures" ON public.contract_signatures
  FOR ALL TO authenticated
  USING (public.has_perm(auth.uid(), 'contracts', 'edit'))
  WITH CHECK (public.has_perm(auth.uid(), 'contracts', 'edit'));

-- 3) سجل النسخ الاحتياطي المجدول
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'success',
  tables_count integer NOT NULL DEFAULT 0,
  rows_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view backups" ON public.backup_runs;
CREATE POLICY "view backups" ON public.backup_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 4) مهام تلقائية عند إنشاء عقد
CREATE OR REPLACE FUNCTION public.create_contract_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tasks (title, details, task_type, priority, status, due_date, property_id, assigned_by)
  VALUES
    ('تجهيز ملف العقد ' || COALESCE(NEW.contract_number, ''),
     'إنشاء تلقائي عند تسجيل العقد: تأكد من رفع نسخة العقد الموقعة والمرفقات.',
     'contract', 'high', 'new', (CURRENT_DATE + 2), NEW.property_id, NEW.created_by),
    ('جدولة دفعات العقد ' || COALESCE(NEW.contract_number, ''),
     'إنشاء تلقائي عند تسجيل العقد: تأكد من صحة جدول الدفعات وتواريخ الاستحقاق.',
     'finance', 'medium', 'new', (CURRENT_DATE + 3), NEW.property_id, NEW.created_by),
    ('تسليم الوحدة للمستأجر — ' || COALESCE(NEW.contract_number, ''),
     'إنشاء تلقائي عند تسجيل العقد: تنسيق موعد الاستلام وتوثيق حالة الوحدة.',
     'operations', 'medium', 'new', COALESCE(NEW.start_date, CURRENT_DATE) + 1, NEW.property_id, NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_contract_tasks ON public.contracts;
CREATE TRIGGER trg_create_contract_tasks
  AFTER INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.create_contract_tasks();