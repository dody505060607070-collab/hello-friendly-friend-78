import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

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

const FALLBACK_MODELS = [MODEL];

/** يحوّل عناصر Responses إلى نص/أجزاء صالحة لمزوّدي الاحتياط. */
function toPlainMessages(input: Item[]) {
  return input.map((item) => ({
    role: item.role,
    text: item.content
      .map((p) => (p.type === "input_text" ? p.text : `[ملف مرفق: ${p.filename}]`))
      .join("\n"),
    files: item.content.filter((p): p is Extract<Part, { type: "input_file" }> => p.type === "input_file"),
  }));
}

/** المزوّد الاحتياطي الأول: Groq (نصي فقط). */
async function callGroq(input: Item[], opts: CallOpts = {}): Promise<string> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY غير مهيأ.");
  const plain = toPlainMessages(input);
  if (plain.some((m) => m.files.length)) throw new Error("Groq لا يدعم الملفات.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: plain.map((m) => ({ role: m.role, content: m.text })),
      temperature: 0,
      ...(opts.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq: رد فارغ.");
  return text;
}

/** خيارات تسريع الاستدعاء (تُستخدم في تحليل العقود). */
type CallOpts = { json?: boolean; fast?: boolean; maxTokens?: number };

/** المزوّد الاحتياطي الثاني: Gemini (يدعم الملفات). */
async function callGemini(input: Item[], opts: CallOpts = {}): Promise<string> {
  const keys = [process.env["GEMINI_API_KEY"], process.env["GEMINI_BACKUP_API_KEY"]].filter(
    (k): k is string => Boolean(k),
  );
  if (!keys.length) throw new Error("مفاتيح Gemini غير مهيأة.");

  const plain = toPlainMessages(input);
  const systemText = plain
    .filter((m) => m.role === "system")
    .map((m) => m.text)
    .join("\n");
  const contents = plain
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        { text: m.text },
        ...m.files.map((f) => {
          const [head = "", b64 = ""] = f.file_data.split(",");
          const mime = head.match(/data:(.*?);base64/)?.[1] ?? "application/pdf";
          return { inline_data: { mime_type: mime, data: b64 } };
        }),
      ],
    }));

  let last = "";
  for (const key of keys) {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": key },
        body: JSON.stringify({
          contents,
          ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
          generationConfig: {
            temperature: 0,
            ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
            // إيقاف "التفكير" يقلّل زمن الاستجابة بشكل كبير في مهام الاستخراج.
            ...(opts.fast ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      },
    );
    if (!res.ok) {
      last = `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`;
      continue;
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (text) return text;
    last = "Gemini: رد فارغ.";
  }
  throw new Error(last || "فشل Gemini.");
}

/**
 * ترتيب المزوّدين: Google Gemini أولًا (مفتاح مباشر لا يعتمد على منصة الاستضافة)،
 * ثم Groq، وأخيرًا بوابة Lovable فقط إن وُجد مفتاحها — حتى يعمل النظام كاملًا على
 * خادم Hostinger VPS بدون أي اعتماد على Lovable.
 */
async function callGateway(input: Item[], opts: CallOpts = {}): Promise<string> {
  const errors: string[] = [];
  try {
    return await callGemini(input, opts);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  try {
    return await callGroq(input, opts);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (process.env["LOVABLE_API_KEY"]) {
    try {
      return await callLovable(input);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`تعذّر الوصول لأي مزوّد ذكاء اصطناعي. (${errors.join(" | ").slice(0, 400)})`);
}

async function callLovable(input: Item[]): Promise<string> {
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

  if (!res) throw new Error(`Lovable ${lastStatus}: ${lastBody.slice(0, 200)}`);

  const json = (await res.json()) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };
  if (typeof json.output_text === "string" && json.output_text.trim()) return json.output_text;
  const parts: string[] = [];
  for (const item of json.output ?? [])
    for (const c of item.content ?? []) if (typeof c.text === "string") parts.push(c.text);
  const joined = parts.join("\n").trim();
  if (!joined) throw new Error("Lovable: رد فارغ.");
  return joined;
}

const SCOPE_RULE = `نطاقك محصور في العقارات وأعمال شركة مثراء العقارية (عقارات، ملاك، مستأجرون، عقود، إيجار، بيع، فواتير، مدفوعات، تذكيرات، مهام، عملاء، تقارير، سوق العقار في السعودية).
إذا سُئلت عن أي موضوع خارج هذا النطاق (طبخ، رياضة، برمجة عامة، سياسة، صحة… إلخ) فاعتذر بلطف بجملة واحدة مثل: «أنا مساعد مختص بالعقارات فقط، كيف أساعدك في عقارك أو طلبك؟» ولا تُجب عن الموضوع الخارجي إطلاقًا.`;

const SYSTEM_PROMPT = `أنت "مساعد مثراء" — مساعد ذكي داخل لوحة تحكم شركة مثراء العقارية في بريدة، السعودية.
تعرف أقسام اللوحة: لوحة التحكم، العقارات، الطلبات (عرض وتوفير عقار)، الحجوزات، الملاك، العقود واستيراد PDF، الفواتير، التذكيرات، المهام، CRM (العملاء/الفرص/الأنشطة/التقارير)، إعدادات الموقع، الموظفون والصلاحيات، السجلات.
${SCOPE_RULE}
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; dataUrl?: string; extractedText?: string }) => input)
  .handler(async ({ data }) => {
    const instruction = `استخرج بيانات عقد الإيجار/البيع من الملف المرفق وأعد JSON فقط دون أي نص إضافي بالمفاتيح التال:
{"contract_number":"","contract_type":"rent|sale","owner_name":"","tenant_name":"","broker_name":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","signed_date":"YYYY-MM-DD","annual_rent":0,"total_value":0,"deposit":0,"fees":0,"payment_cycle":"","payments_count":0,"property_name":"","unit_number":"","city":"","district":"","special_terms":"","warnings":[]}
اترك أي قيمة غير موجودة فارغة أو null، وأضِف أي ملاحظة مهمة في warnings.`;

    const extractedText = data.extractedText?.trim().slice(0, 80_000) ?? "";
    const userContent: Part[] = [
      { type: "input_text", text: instruction },
      ...(extractedText
        ? [{ type: "input_text" as const, text: `نص العقد المستخرج من ملف PDF:\n${extractedText}` }]
        : data.dataUrl
          ? [{ type: "input_file" as const, filename: data.fileName, file_data: data.dataUrl }]
          : []),
    ];
    if (userContent.length === 1) throw new Error("تعذّر استخراج نص أو صور من ملف العقد.");

    const items: Item[] = [
        {
          role: "system",
          content: [
            { type: "input_text", text: "أنت مستخرج بيانات عقود عقارية. أعد JSON فقط دون أي شرح." },
          ],
        },
        {
          role: "user",
          content: userContent,
        },
      ];

    // Gemini Flash Lite أسرع مسار للنص ويدعم OCR عند الحاجة؛ Groq يبقى
    // احتياطيًا للمحادثات النصية ولا نستخدم نموذجه الكبير في تحليل العقود.
    const text = await callGemini(items, { json: true, fast: true, maxTokens: 1200 });

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
${SCOPE_RULE}
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
