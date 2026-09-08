import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

type Part = { type: "input_text"; text: string } | { type: "input_file"; filename: string; file_data: string };
type Item = { role: "system" | "user" | "assistant"; content: Part[] };

/**
 * The Responses API only accepts `output_text` parts on assistant items;
 * `input_text` on an assistant turn fails with 400 invalid_value.
 */
function normalize(input: Item[]) {
  return input.map((item) => ({
    role: item.role,
    content: item.content.map((part) =>
      item.role === "assistant" && part.type === "input_text"
        ? { type: "output_text", text: part.text }
        : part,
    ),
  }));
}

const FALLBACK_MODELS = [MODEL, "openai/gpt-5.5", "google/gemini-3.8-flash"];

async function callGateway(input: Item[]): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة على الخادم.");

  const payloadInput = normalize(input);
  let res: Response | null = null;
  let lastBody = "";
  let lastStatus = 0;

  for (const model of FALLBACK_MODELS) {
    const attempt = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({ model, input: payloadInput, store: false }),
    });
    if (attempt.ok) {
      res = attempt;
      break;
    }
    lastStatus = attempt.status;
    lastBody = await attempt.text();
    // 400 = بنية الطلب خاطئة، تغيير النموذج لن يفيد.
    if (attempt.status === 400 || attempt.status === 401) break;
  }

  if (!res) {
    if (lastStatus === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي. أضِف رصيدًا للمتابعة.");
    if (lastStatus === 429) throw new Error("عدد الطلبات كبير الآن، حاول بعد لحظات.");
    throw new Error(`فشل طلب الذكاء الاصطناعي (${lastStatus}): ${lastBody.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };
  if (typeof json.output_text === "string" && json.output_text.trim()) return json.output_text;
  const parts: string[] = [];
  for (const item of json.output ?? [])
    for (const c of item.content ?? []) if (typeof c.text === "string") parts.push(c.text);
  return parts.join("\n").trim() || "لم يصل رد من المساعد.";
}

const SYSTEM_PROMPT = `أنت "مساعد مثراء" — مساعد ذكي داخل لوحة تحكم شركة مثراء العقارية في بريدة، السعودية.
تعرف أقسام اللوحة: لوحة التحكم، العقارات، الطلبات (عرض وتوفير عقار)، الحجوزات، الملاك، العقود واستيراد PDF، الفواتير، التذكيرات، المهام، CRM (العملاء/الفرص/الأنشطة/التقارير)، إعدادات الموقع، الموظفون والصلاحيات، السجلات.
أجب دائمًا بالعربية الفصحى المبسطة، بإجابات قصيرة عملية ومرتبة بنقاط عند الحاجة. إن أرسل المستخدم بيانات مسحوبة من جدول، حللها واشرحها واقترح الخطوة التالية.`;

export const askAdminAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      messages: { role: "user" | "assistant"; content: string }[];
      context?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const items: Item[] = [{ role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] }];
    const latestQuestion = data.messages.at(-1)?.content ?? "";
    const owners = await context.supabase
      .from("contacts")
      .select("id, full_name")
      .contains("roles", ["owner"])
      .limit(500);
    const mentionedOwner = (owners.data ?? [])
      .filter((owner) => owner.full_name.length >= 3 && latestQuestion.includes(owner.full_name))
      .sort((a, b) => b.full_name.length - a.full_name.length)[0];
    if (mentionedOwner) {
      const [owner, properties, units, contracts, invoices] = await Promise.all([
        context.supabase.from("contacts").select("id, full_name, kind, national_id, phone, phone_alt, whatsapp, email, address, notes, is_active, created_at").eq("id", mentionedOwner.id).single(),
        context.supabase.from("properties").select("code, name, purpose, property_type, city, district, price_value, status, is_visible").eq("owner_id", mentionedOwner.id),
        context.supabase.from("units").select("unit_number, unit_type, floor, area, rooms, status, is_rentable").eq("owner_id", mentionedOwner.id),
        context.supabase.from("contracts").select("contract_number, contract_type, start_date, end_date, annual_rent, total_value, deposit, status").eq("owner_id", mentionedOwner.id),
        context.supabase.from("invoices").select("invoice_number, issue_date, due_date, subtotal, vat_amount, total, status").eq("contact_id", mentionedOwner.id),
      ]);
      items.push({
        role: "user",
        content: [{
          type: "input_text",
          text: `بيانات موثوقة من النظام للمالك المذكور. لا تضف معلومات غير موجودة:\n${JSON.stringify({ owner: owner.data, properties: properties.data ?? [], units: units.data ?? [], contracts: contracts.data ?? [], invoices: invoices.data ?? [] }).slice(0, 30000)}`,
        }],
      });
    }
    if (data.context?.trim()) {
      items.push({
        role: "user",
        content: [
          {
            type: "input_text",
            text: `بيانات مرفقة من لوحة التحكم (سُحبت بالماوس):\n${data.context.slice(0, 12000)}`,
          },
        ],
      });
    }
    for (const m of data.messages.slice(-16)) {
      items.push({ role: m.role, content: [{ type: "input_text", text: m.content }] });
    }
    const text = await callGateway(items);
    return { text };
  });

export const analyzeContractPdf = createServerFn({ method: "POST" })
  .inputValidator((input: { fileName: string; dataUrl: string }) => input)
  .handler(async ({ data }) => {
    const instruction = `استخرج بيانات عقد الإيجار/البيع من الملف المرفق وأعد JSON فقط دون أي نص إضافي بالمفاتيح التال:
{"contract_number":"","contract_type":"rent|sale","owner_name":"","tenant_name":"","broker_name":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","signed_date":"YYYY-MM-DD","annual_rent":0,"total_value":0,"deposit":0,"fees":0,"payment_cycle":"","payments_count":0,"property_name":"","unit_number":"","city":"","district":"","special_terms":"","warnings":[]}
اترك أي قيمة غير موجودة فارغة أو null، وأضِف أي ملاحظة مهمة في warnings.`;

    const text = await callGateway([
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
      {
        role: "user",
        content: [
          { type: "input_text", text: instruction },
          { type: "input_file", filename: data.fileName, file_data: data.dataUrl },
        ],
      },
    ]);

    const match = text.match(/\{[\s\S]*\}/);
    let extractionJson = "{}";
    if (match) {
      try {
        extractionJson = JSON.stringify(JSON.parse(match[0]));
      } catch {
        extractionJson = "{}";
      }
    }
    return { extractionJson, raw: text };
  });


const PUBLIC_PROMPT = `أنت "مساعد مثراء" — مساعد ذكي على الموقع العام لشركة مثراء العقارية في بريدة، السعودية.
مهمتك مساعدة الزوار: شرح أقسام الموقع (الإيجار، البيع، من نحن، تواصل معنا، اعرض/اطلب عقارك)، توضيح خطوات عرض عقار أو طلب عقار، والإجابة عن أسئلة عامة عن العقارات في بريدة.
أجب بالعربية الفصحى المبسطة بإجابات قصيرة ومهذبة. لا تذكر بيانات داخلية أو أسعار غير مؤكدة، وإن لزم التفاصيل اطلب من الزائر التواصل عبر صفحة «تواصل معنا» أو الواتساب.`;

export const askPublicAi = createServerFn({ method: "POST" })
  .inputValidator((input: { messages: { role: "user" | "assistant"; content: string }[] }) => input)
  .handler(async ({ data }) => {
    const items: Item[] = [
      { role: "system", content: [{ type: "input_text", text: PUBLIC_PROMPT }] },
    ];
    for (const m of data.messages.slice(-12)) {
      items.push({
        role: m.role,
        content: [{ type: "input_text", text: m.content.slice(0, 2000) }],
      });
    }
    const text = await callGateway(items);
    return { text };
  });
