import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Extraction = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

function addCycle(base: Date, cycle: string, i: number) {
  const d = new Date(base);
  if (cycle === "monthly") d.setMonth(d.getMonth() + i);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + i * 3);
  else if (cycle === "semiannual") d.setMonth(d.getMonth() + i * 6);
  else d.setFullYear(d.getFullYear() + i);
  return d.toISOString().slice(0, 10);
}

/**
 * الترحيل الكامل لعقد مستورد من PDF:
 * ينشئ/يربط المالك والمستأجر والوسيط والعقار والعقد وجدول الدفعات والفواتير
 * وحساب بوابة العميل، ويسجّل الاستثناءات للمراجعة.
 */
export const finalizeContractImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { extraction: Extraction; filePath?: string | undefined; importId?: string | undefined }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");

    const db = context.supabase;
    const e = data.extraction ?? {};
    const warnings: string[] = Array.isArray(e["warnings"]) ? (e["warnings"] as string[]).map(String) : [];
    const created: string[] = [];

    const findOrCreateContact = async (name: string, role: string) => {
      if (!name) return null;
      const found = await db.from("contacts").select("id").ilike("full_name", name).limit(1);
      if (found.data?.[0]) return found.data[0].id;
      const ins = await db
        .from("contacts")
        .insert({
          full_name: name,
          kind: "individual",
          roles: [role],
          source: "pdf_import",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (ins.error) {
        warnings.push(`تعذّر إنشاء جهة الاتصال «${name}»: ${ins.error.message}`);
        return null;
      }
      created.push(`جهة اتصال: ${name}`);
      return ins.data.id;
    };

    const ownerName = str(e["owner_name"]);
    const tenantName = str(e["tenant_name"]);
    const brokerName = str(e["broker_name"]);
    const ownerId = await findOrCreateContact(ownerName, "owner");
    const tenantId = await findOrCreateContact(tenantName, "tenant");
    const brokerId = await findOrCreateContact(brokerName, "broker");
    if (!ownerName) warnings.push("لم يُستخرج اسم المالك من الملف.");
    if (!tenantName) warnings.push("لم يُستخرج اسم المستأجر من الملف.");

    // العقار
    const propertyName = str(e["property_name"]) || str(e["unit_number"]);
    let propertyId: string | null = null;
    if (propertyName) {
      const found = await db.from("properties").select("id").ilike("name", propertyName).limit(1);
      if (found.data?.[0]) propertyId = found.data[0].id;
      else {
        const code = `P-${Date.now().toString(36).toUpperCase()}`;
        const ins = await db
          .from("properties")
          .insert({
            code,
            name: propertyName,
            purpose: str(e["contract_type"]) === "sale" ? "sale" : "rent",
            city: str(e["city"]) || null,
            district: str(e["district"]) || null,
            owner_id: ownerId,
            is_visible: false,
            needs_review: true,
            status: "reserved",
            internal_notes: "أُنشئ تلقائيًا من استيراد عقد PDF — يحتاج مراجعة.",
            created_by: context.userId,
          })
          .select("id")
          .single();
        if (ins.error) warnings.push(`تعذّر إنشاء العقار: ${ins.error.message}`);
        else {
          propertyId = ins.data.id;
          created.push(`عقار: ${propertyName}`);
        }
      }
    } else {
      warnings.push("لم يُستخرج اسم العقار — رُبط العقد بدون عقار.");
    }

    // العقد
    const isSale = str(e["contract_type"]) === "sale";
    const annual = num(e["annual_rent"]);
    const total = num(e["total_value"]) ?? annual;
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(str(e["start_date"])) ? str(e["start_date"]) : null;
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(str(e["end_date"])) ? str(e["end_date"]) : null;
    if (!startDate) warnings.push("تاريخ بداية العقد غير واضح في الملف.");
    const cycleRaw = str(e["payment_cycle"]).toLowerCase();
    const cycle = cycleRaw.includes("شهر") || cycleRaw.includes("month")
      ? "monthly"
      : cycleRaw.includes("ربع") || cycleRaw.includes("quarter")
        ? "quarterly"
        : cycleRaw.includes("نصف") || cycleRaw.includes("semi")
          ? "semiannual"
          : "annual";
    const paymentsCount = Math.min(Math.max(Number(num(e["payments_count"]) ?? 1), 1), 60);

    const contractIns = await db
      .from("contracts")
      .insert({
        contract_number: str(e["contract_number"]) || `C-${Date.now().toString(36).toUpperCase()}`,
        contract_type: isSale ? "sale" : "rent",
        owner_id: ownerId,
        tenant_id: tenantId,
        broker_id: brokerId,
        property_id: propertyId,
        start_date: startDate,
        end_date: endDate,
        signed_date: /^\d{4}-\d{2}-\d{2}$/.test(str(e["signed_date"])) ? str(e["signed_date"]) : null,
        annual_rent: annual,
        total_value: total,
        deposit: num(e["deposit"]),
        fees: num(e["fees"]),
        payment_cycle: cycle,
        payments_count: paymentsCount,
        special_terms: str(e["special_terms"]) || null,
        status: "active",
        source: "pdf_import",
        file_path: data.filePath ?? null,
        created_by: context.userId,
      })
      .select("id, contract_number")
      .single();
    if (contractIns.error) throw new Error(`تعذّر إنشاء العقد: ${contractIns.error.message}`);
    const contractId = contractIns.data.id;
    created.push(`عقد: ${contractIns.data.contract_number}`);

    // جدول الدفعات
    const base = startDate ? new Date(startDate) : new Date();
    const amountEach = total ? Math.round((total / paymentsCount) * 100) / 100 : 0;
    if (!amountEach) warnings.push("قيمة العقد غير واضحة — أُنشئت الدفعات بقيمة صفر للمراجعة.");
    const payments = Array.from({ length: paymentsCount }, (_, i) => ({
      contract_id: contractId,
      payment_number: i + 1,
      due_date: addCycle(base, cycle, i),
      amount_due: amountEach,
      amount_paid: 0,
      status: "pending",
      is_derived: true,
    }));
    const payIns = await db.from("contract_payments").insert(payments).select("id, due_date, amount_due, payment_number");
    if (payIns.error) warnings.push(`تعذّر إنشاء جدول الدفعات: ${payIns.error.message}`);
    else created.push(`${payIns.data.length} دفعة مجدولة`);

    // الفواتير لكل دفعة
    let invoicesCreated = 0;
    for (const p of payIns.data ?? []) {
      const invoiceNumber = `INV-${contractIns.data.contract_number}-${p.payment_number}`;
      const inv = await db
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          contact_id: tenantId,
          contract_id: contractId,
          issue_date: p.due_date,
          due_date: p.due_date,
          status: "unpaid",
          subtotal: p.amount_due,
          vat_amount: 0,
          total: p.amount_due,
          notes: "أُنشئت تلقائيًا من استيراد العقد",
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (inv.error) {
        warnings.push(`تعذّر إنشاء الفاتورة ${invoiceNumber}: ${inv.error.message}`);
        continue;
      }
      invoicesCreated += 1;
      await db.from("invoice_items").insert({
        invoice_id: inv.data.id,
        description: `دفعة رقم ${p.payment_number} — عقد ${contractIns.data.contract_number}`,
        quantity: 1,
        unit_price: p.amount_due,
        total: p.amount_due,
        sort_order: 1,
      });
    }
    if (invoicesCreated) created.push(`${invoicesCreated} فاتورة`);

    // تذكير أول دفعة
    const firstPayment = (payIns.data ?? []).sort((a, b) => a.payment_number - b.payment_number)[0];
    let tenantPhone = "";
    if (tenantId) {
      const c = await db.from("contacts").select("phone, whatsapp, national_id").eq("id", tenantId).single();
      tenantPhone = c.data?.whatsapp ?? c.data?.phone ?? "";
      if (!c.data?.national_id) warnings.push("لا يوجد رقم هوية للمستأجر — لن يُفعّل حساب البوابة قبل إضافته.");
      if (!tenantPhone) warnings.push("لا يوجد رقم جوال للمستأجر — لن تُرسل التذكيرات.");
    }
    if (firstPayment && tenantPhone && tenantId) {
      const body = `تحية طيبة ${tenantName}،\nنذكّركم بموعد سداد الدفعة رقم ${firstPayment.payment_number} بقيمة ${firstPayment.amount_due} ريال بتاريخ ${firstPayment.due_date} عن العقد ${contractIns.data.contract_number}.\nمثراء العقارية`;
      await db.from("reminder_followups").insert({
        contract_id: contractId,
        payment_id: null,
        recipient_contact_id: tenantId,
        recipient_name: tenantName,
        recipient_phone: tenantPhone,
        message_body: body,
        repeat_interval: "monthly",
        status: "pending",
        next_send_at: new Date(firstPayment.due_date).toISOString(),
        created_by: context.userId,
      });
      created.push("تذكير سداد مجدول");
    }

    // حساب بوابة العميل
    let account: { username: string; password: string } | null = null;
    if (tenantId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const contact = await supabaseAdmin
          .from("contacts")
          .select("id, full_name, national_id, phone, whatsapp")
          .eq("id", tenantId)
          .single();
        const username = String(contact.data?.national_id ?? "").replace(/\D/g, "");
        const digits = String(contact.data?.phone ?? contact.data?.whatsapp ?? "").replace(/\D/g, "");
        const password = digits.startsWith("966")
          ? `0${digits.slice(3)}`
          : digits.startsWith("5")
            ? `0${digits}`
            : digits;
        if (username && password.length >= 6) {
          const loginEmail = `${username}@client.mithraa.sa`;
          const existing = await supabaseAdmin
            .from("client_accounts")
            .select("id, user_id")
            .eq("contact_id", tenantId)
            .maybeSingle();
          if (existing.data) {
            await supabaseAdmin.auth.admin.updateUserById(existing.data.user_id, { password });
            account = { username, password };
          } else {
            const createdUser = await supabaseAdmin.auth.admin.createUser({
              email: loginEmail,
              password,
              email_confirm: true,
              user_metadata: { full_name: contact.data?.full_name ?? tenantName, is_client: true },
            });
            if (createdUser.data.user) {
              await supabaseAdmin.from("client_accounts").insert({
                contact_id: tenantId,
                user_id: createdUser.data.user.id,
                username,
                login_email: loginEmail,
              });
              account = { username, password };
              created.push("حساب بوابة العميل");
            } else if (createdUser.error) {
              warnings.push(`تعذّر إنشاء حساب العميل: ${createdUser.error.message}`);
            }
          }
        }
      } catch (err) {
        warnings.push(`تعذّر إنشاء حساب العميل: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
      }
    }

    if (data.importId) {
      await db
        .from("contract_imports")
        .update({
          status: warnings.length ? "needs_review" : "approved",
          contract_id: contractId,
          warnings: warnings as never,
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", data.importId);
    }

    await db.from("activity_log").insert({
      actor_id: context.userId,
      action: "contract_import_finalized",
      entity_type: "contract",
      entity_id: contractId,
      details: { created, warnings } as never,
    });

    return { contractId, created, warnings, account };
  });
