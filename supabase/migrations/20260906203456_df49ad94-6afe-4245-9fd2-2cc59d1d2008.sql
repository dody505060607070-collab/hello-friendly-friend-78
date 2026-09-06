-- ============ CONTRACTS ============
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL,
  contract_type text NOT NULL DEFAULT 'rent', -- rent | sale
  renewal_status text,
  signed_date date,
  signed_place text,
  start_date date,
  end_date date,
  duration_text text,
  calendar_type text NOT NULL DEFAULT 'gregorian', -- gregorian | hijri
  owner_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  annual_rent numeric(14,2),
  total_value numeric(14,2),
  deposit numeric(14,2),
  fees numeric(14,2),
  payment_cycle text,
  payments_count integer,
  special_terms text,
  renewal_terms text,
  notes text,
  file_path text,
  previous_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active', -- draft | active | expired | terminated | renewed
  source text NOT NULL DEFAULT 'manual', -- manual | pdf_import
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_number, contract_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view contracts" ON public.contracts FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'contracts','view'));
CREATE POLICY "add contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'contracts','add'));
CREATE POLICY "edit contracts" ON public.contracts FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'contracts','edit')) WITH CHECK (public.has_perm(auth.uid(),'contracts','edit'));
CREATE POLICY "delete contracts" ON public.contracts FOR DELETE TO authenticated USING (public.has_perm(auth.uid(),'contracts','delete'));
CREATE TRIGGER contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_contracts_status ON public.contracts (status, end_date);

-- ============ PAYMENTS ============
CREATE TABLE public.contract_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  payment_number integer NOT NULL,
  due_date date NOT NULL,
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | partial | paid | overdue | cancelled
  is_derived boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, payment_number)
);
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.contract_payments(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  attachment_path text,
  notes text,
  idempotency_key text UNIQUE,
  recorded_by uuid,
  reversed_of uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_payments TO authenticated;
GRANT SELECT, INSERT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.contract_payments, public.payment_transactions TO service_role;
ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view payments" ON public.contract_payments FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'contracts','view'));
CREATE POLICY "write payments" ON public.contract_payments FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'contracts','edit')) WITH CHECK (public.has_perm(auth.uid(),'contracts','edit'));
CREATE POLICY "view transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'contracts','view'));
CREATE POLICY "collect payments" ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'payments','collect'));
CREATE TRIGGER contract_payments_updated BEFORE UPDATE ON public.contract_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_payments_due ON public.contract_payments (due_date, status);

-- keep payment totals/status in sync with transactions
CREATE OR REPLACE FUNCTION public.recalc_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; total numeric; due numeric; d date;
BEGIN
  pid := COALESCE(NEW.payment_id, OLD.payment_id);
  SELECT COALESCE(sum(amount),0) INTO total FROM public.payment_transactions WHERE payment_id = pid;
  SELECT amount_due, due_date INTO due, d FROM public.contract_payments WHERE id = pid;
  UPDATE public.contract_payments SET
    amount_paid = total,
    status = CASE
      WHEN status = 'cancelled' THEN 'cancelled'
      WHEN total >= due AND due > 0 THEN 'paid'
      WHEN total > 0 THEN 'partial'
      WHEN d < CURRENT_DATE THEN 'overdue'
      ELSE 'pending' END
  WHERE id = pid;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.recalc_payment_status() FROM anon, authenticated, public;
CREATE TRIGGER payment_tx_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.recalc_payment_status();

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'unpaid', -- unpaid | partial | paid | cancelled
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices, public.invoice_items, public.invoice_payments TO authenticated;
GRANT ALL ON public.invoices, public.invoice_items, public.invoice_payments TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'invoices','view'));
CREATE POLICY "write invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'invoices','edit')) WITH CHECK (public.has_perm(auth.uid(),'invoices','edit'));
CREATE POLICY "view invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'invoices','view'));
CREATE POLICY "write invoice items" ON public.invoice_items FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'invoices','edit')) WITH CHECK (public.has_perm(auth.uid(),'invoices','edit'));
CREATE POLICY "view invoice payments" ON public.invoice_payments FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'invoices','view'));
CREATE POLICY "write invoice payments" ON public.invoice_payments FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'payments','collect')) WITH CHECK (public.has_perm(auth.uid(),'payments','collect'));
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PDF IMPORTS ============
CREATE TABLE public.contract_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  file_hash text,
  pages integer,
  status text NOT NULL DEFAULT 'uploaded', -- uploaded | analyzing | review | approved | failed
  extraction jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  ocr_used boolean NOT NULL DEFAULT false,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  uploaded_by uuid,
  reviewed_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_imports_hash ON public.contract_imports (file_hash) WHERE file_hash IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_imports TO authenticated;
GRANT ALL ON public.contract_imports TO service_role;
ALTER TABLE public.contract_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view imports" ON public.contract_imports FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'contracts','view'));
CREATE POLICY "write imports" ON public.contract_imports FOR ALL TO authenticated USING (public.has_perm(auth.uid(),'contracts','edit')) WITH CHECK (public.has_perm(auth.uid(),'contracts','edit'));
CREATE TRIGGER contract_imports_updated BEFORE UPDATE ON public.contract_imports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RESERVATIONS ============
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'hold', -- hold | active | expired | cancelled | converted
  created_by uuid,
  cancelled_by uuid,
  cancelled_at timestamptz,
  extended_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view reservations" ON public.reservations FOR SELECT TO authenticated USING (public.has_perm(auth.uid(),'reservations','view'));
CREATE POLICY "create reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(),'reservations','book'));
CREATE POLICY "edit reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'reservations','book')) WITH CHECK (public.has_perm(auth.uid(),'reservations','book'));
CREATE POLICY "delete reservations" ON public.reservations FOR DELETE TO authenticated USING (public.has_perm(auth.uid(),'reservations','delete'));
CREATE TRIGGER reservations_updated BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_reservations_active ON public.reservations (status, ends_at);

-- prevent overlapping active reservations for the same property/unit
CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('hold','active') THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id <> NEW.id
      AND r.status IN ('hold','active')
      AND r.ends_at > now()
      AND ((NEW.property_id IS NOT NULL AND r.property_id = NEW.property_id)
        OR (NEW.unit_id IS NOT NULL AND r.unit_id = NEW.unit_id))
      AND NEW.starts_at < r.ends_at AND NEW.ends_at > r.starts_at
  ) THEN
    RAISE EXCEPTION 'RESERVATION_CONFLICT';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.check_reservation_overlap() FROM anon, authenticated, public;
CREATE TRIGGER reservations_no_overlap BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.check_reservation_overlap();