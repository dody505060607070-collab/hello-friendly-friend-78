import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_DOMAIN = "client.mithraa.sa";

export function localPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return `0${digits.slice(3)}`;
  if (digits.startsWith("00966")) return `0${digits.slice(5)}`;
  if (digits.startsWith("5")) return `0${digits}`;
  return digits;
}

export function clientUsername(nationalId: string | null | undefined): string {
  return String(nationalId ?? "").replace(/\D/g, "");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** ينشئ (أو يحدّث) حساب دخول للعميل: اسم المستخدم = رقم الهوية، كلمة المرور = الجوال المحلي 05… */
export const ensureClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactId: string }) => input)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");

    const db = await admin();
    const { data: contact, error } = await db
      .from("contacts")
      .select("id, full_name, national_id, phone, whatsapp, email")
      .eq("id", data.contactId)
      .single();
    if (error || !contact) throw new Error("العميل غير موجود.");

    const username = clientUsername(contact.national_id);
    const password = localPhone(contact.phone ?? contact.whatsapp);
    if (!username) return { ok: false as const, reason: "لا يوجد رقم هوية لهذا العميل." };
    if (password.length < 6) return { ok: false as const, reason: "لا يوجد رقم جوال صالح لهذا العميل." };

    const loginEmail = `${username}@${EMAIL_DOMAIN}`;

    const existing = await db
      .from("client_accounts")
      .select("id, user_id")
      .eq("contact_id", contact.id)
      .maybeSingle();

    if (existing.data) {
      await db.auth.admin.updateUserById(existing.data.user_id, { password });
      return { ok: true as const, username, password, created: false };
    }

    const created = await db.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: contact.full_name, client_contact_id: contact.id, portal: true },
    });

    let userId = created.data.user?.id;
    if (!userId) {
      // قد يكون الحساب موجودًا مسبقًا بنفس البريد
      const list = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list.data.users.find((u) => u.email === loginEmail)?.id;
      if (userId) await db.auth.admin.updateUserById(userId, { password });
    }
    if (!userId) throw new Error(created.error?.message ?? "تعذّر إنشاء حساب العميل.");

    await db
      .from("client_accounts")
      .upsert(
        { contact_id: contact.id, user_id: userId, username, login_email: loginEmail },
        { onConflict: "contact_id" },
      );

    return { ok: true as const, username, password, created: true };
  });

/** يحوّل اسم المستخدم (رقم الهوية) إلى بريد الدخول الداخلي. */
export const resolveClientLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data }) => {
    const username = clientUsername(data.username);
    if (!username) return { email: null as string | null };
    const db = await admin();
    const row = await db
      .from("client_accounts")
      .select("login_email")
      .eq("username", username)
      .maybeSingle();
    return { email: row.data?.login_email ?? null };
  });

async function currentClient(userId: string) {
  const db = await admin();
  const account = await db
    .from("client_accounts")
    .select("contact_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!account.data) throw new Error("لا توجد بوابة عميل مرتبطة بهذا الحساب.");
  return { db, contactId: account.data.contact_id };
}

export const getPortalOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const [contact, contracts, invoices] = await Promise.all([
      db.from("contacts").select("id, full_name, national_id, phone, email").eq("id", contactId).single(),
      db
        .from("contracts")
        .select("id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, payment_cycle, payments_count, status")
        .eq("tenant_id", contactId)
        .order("start_date", { ascending: false }),
      db
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, total, status")
        .eq("contact_id", contactId)
        .order("issue_date", { ascending: false }),
    ]);

    const contractIds = (contracts.data ?? []).map((c) => c.id);
    const payments = contractIds.length
      ? await db
          .from("contract_payments")
          .select("id, contract_id, payment_number, due_date, amount_due, amount_paid, status")
          .in("contract_id", contractIds)
          .order("due_date", { ascending: true })
      : { data: [] as never[] };

    return {
      contact: contact.data,
      contracts: contracts.data ?? [],
      invoices: invoices.data ?? [],
      payments: (payments.data ?? []) as {
        id: string;
        contract_id: string;
        payment_number: number;
        due_date: string;
        amount_due: number;
        amount_paid: number;
        status: string;
      }[],
    };
  });

export const getPortalContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const contract = await db
      .from("contracts")
      .select(
        "id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, deposit, payment_cycle, payments_count, status, property:property_id(name, city, district), unit:unit_id(unit_number, unit_type)",
      )
      .eq("id", data.contractId)
      .eq("tenant_id", contactId)
      .maybeSingle();
    if (!contract.data) throw new Error("العقد غير متاح.");

    const payments = await db
      .from("contract_payments")
      .select("id, payment_number, due_date, amount_due, amount_paid, status, notes")
      .eq("contract_id", data.contractId)
      .order("payment_number", { ascending: true });

    return { contract: contract.data, payments: payments.data ?? [] };
  });

export const getPortalInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const invoice = await db
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, status, subtotal, vat_amount, total, notes, contact:contact_id(full_name, national_id, phone)")
      .eq("id", data.invoiceId)
      .eq("contact_id", contactId)
      .maybeSingle();
    if (!invoice.data) throw new Error("الفاتورة غير متاحة.");
    const items = await db
      .from("invoice_items")
      .select("id, description, quantity, unit_price, total, sort_order")
      .eq("invoice_id", data.invoiceId)
      .order("sort_order", { ascending: true });
    return { invoice: invoice.data, items: items.data ?? [] };
  });
