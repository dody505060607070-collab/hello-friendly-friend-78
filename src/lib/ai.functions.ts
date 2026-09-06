import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

type Part = { type: "input_text"; text: string } | { type: "input_file"; filename: string; file_data: string };
type Item = { role: "system" | "user" | "assistant"; content: Part[] };

async function callGateway(input: Item[]): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة على الخادم.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({ model: MODEL, input }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي. أضِف رصيدًا للمتابعة.");
    if (res.status === 429) throw new Error("عدد الطلبات كبير الآن، حاول بعد لحظات.");
    throw new Error(`فشل طلب الذكاء الاصطناعي (${res.status}): ${body.slice(0, 240)}`);
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
  .inputValidator(
    (input: {
      messages: { role: "user" | "assistant"; content: string }[];
      context?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const items: Item[] = [{ role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] }];
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
    let extraction: Record<string, unknown> = {};
    try {
      extraction = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
    } catch {
      extraction = {};
    }
    return { extraction, raw: text };
  });
