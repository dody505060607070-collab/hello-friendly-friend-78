import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

type Part = { type: "input_text"; text: string } | { type: "input_file"; filename: string; file_data: string };
type Item = { role: "system" | "user" | "assistant"; content: Part[] };

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
  const keys = [process.env["GEMINI_API_KEY"], process.env["GEMINI_API_KEY_BACKUP"]].filter(
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

  // نماذج بديلة عند ازدحام النموذج الأساسي (503/429)
  const models = ["gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-2.5-flash"];
  let last = "";
  for (const model of models) {
    for (const key of keys) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
          // 503/429 مؤقتة: أعد المحاولة مرة واحدة ثم انتقل للمفتاح/النموذج التالي
          if ((res.status === 503 || res.status === 429 || res.status >= 500) && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            continue;
          }
          break;
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
        break;
      }
    }
  }
  throw new Error(last || "فشل Gemini.");
}


/**
 * سلسلة تعويض المزوّدين، تُقرأ المفاتيح من process.env داخل كل معالج:
 * (1) Gemini بمفتاحه الأساسي ثم الاحتياطي إن وُجد، (2) Groq، (3) بوابة Lovable
 * كملاذ أخير متاح دائمًا. أي مزوّد بلا مفتاح أو يفشل يُتخطّى دون تسريب تفاصيله.
 */
async function callGateway(input: Item[], opts: CallOpts = {}): Promise<string> {
  const errors: string[] = [];
  if (process.env["GEMINI_API_KEY"] || process.env["GEMINI_API_KEY_BACKUP"]) {
    try {
      return await callGemini(input, opts);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (process.env["GROQ_API_KEY"]) {
    try {
      return await callGroq(input, opts);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (process.env["LOVABLE_API_KEY"]) {
    try {
      return await callLovable(input, opts);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error("تعذّر الوصول للمساعد الذكي حاليًا، يرجى المحاولة لاحقًا أو التواصل معنا مباشرة.");
}

async function callLovable(input: Item[], opts: CallOpts = {}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة على الخادم.");

  const plain = toPlainMessages(input);
  if (plain.some((m) => m.files.length)) throw new Error("بوابة Lovable لا تدعم الملفات هنا.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: plain.map((m) => ({ role: m.role, content: m.text })),
      temperature: 0,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Lovable ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Lovable: رد فارغ.");
  return text;
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
    const { requireUnlocked } = await import("./kill-switch.server");
    await requireUnlocked();
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
    const { requireUnlocked } = await import("./kill-switch.server");
    await requireUnlocked();
    const instruction = `استخرج بيانات عقد الإيجار/البيع من الملف المرفق وأعد JSON فقط دون أي نص إضافي بالمفاتيح التالية:
{"contract_number":"","contract_type":"rent|sale","owner_name":"","owner_national_id":"","owner_phone":"","owner_email":"","tenant_is_company":false,"tenant_name":"","tenant_national_id":"","tenant_phone":"","tenant_cr_number":"","tenant_rep_name":"","tenant_rep_national_id":"","tenant_rep_phone":"","broker_name":"","broker_phone":"","broker_entity_name":"","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","signed_date":"YYYY-MM-DD","annual_rent":0,"total_value":0,"vat":0,"deposit":0,"fees":0,"payment_cycle":"","payments_count":0,"property_name":"","property_usage":"","property_type":"","unit_number":"","units":[{"unit_number":"","unit_type":"","floor":"","area":0}],"payments":[{"no":1,"rent":0,"vat":0,"services":0,"total":0,"issue_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD"}],"city":"","district":"","special_terms":"","warnings":[]}

هذا غالبًا نموذج «إيجار» الرسمي (الهيئة العامة للعقار) وقد يكون عقدًا تجاريًا. اعتمد على أرقام البنود:
- البند ١ بيانات العقد: «رقم سجل العقد» = contract_number (انسخه كاملًا كما هو مثل 20633964658 / 1-0)، «تاريخ إبرام العقد» = signed_date، «تاريخ بداية/نهاية مدّة الإيجار» = start_date/end_date، «مكان إبرام العقد» = city.
- البند ٢ بيانات المؤجّر = المالك (owner). لا تأخذ اسم المالك من أي بند آخر.
- البند ٤ بيانات المستأجر: إذا ورد «اسم الشركة/المؤسسة» أو «رقم السجل التجاري» فالمستأجر منشأة: اجعل tenant_is_company=true، tenant_name = اسم الشركة/المؤسسة كاملًا كما هو، tenant_cr_number = رقم السجل التجاري، واترك tenant_national_id فارغًا.
- البند ٥ بيانات ممثّل المستأجر: هذا شخص مختلف عن المنشأة → tenant_rep_name / tenant_rep_national_id / tenant_rep_phone. لا تضع اسم الممثّل في tenant_name أبدًا.
- البند ٦ المنشأة العقارية والوسيط: broker_entity_name = اسم منشأة الوساطة، broker_name = الممثل النظامي للمنشأة، broker_phone = جوّاله.
- البند ٨ بيانات العقار: property_usage (تجاري/سكني)، property_type (نوع البناء)، والعنوان الوطني → city و district (اسم الحي فقط دون أرقام). property_name = اسم العقار إن ذُكر صراحة، وإلا كوّنه من نوع البناء + الحي مثل «ورشة — حفصة الأندلسية».
- البند ٩ الوحدات الإيجارية: أدرج كل وحدة في units (رقم الوحدة، نوعها، الطابق، المساحة). إن تعددت الوحدات اجعل unit_number = أرقامها مفصولة بفاصلة.
- البند ١١ البيانات المالية: annual_rent = «القيمة السنوية للإيجار»، total_value = «إجمالي قيمة العقد»، vat = ضريبة القيمة المضافة، deposit = «مبلغ الضمان» أو العربون، payment_cycle = «دورة سداد الإيجار»، payments_count = «عدد دفعات الإيجار».
- البند ١٢ جدول سداد الدفعات: انسخ كل صف في payments بقيمه وتواريخه الميلادية كما هي. عددها قد يخالف payments_count — إن اختلفا أضف تنبيهًا في warnings.

قواعد إلزامية للدقة:
1) انسخ القيم حرفيًا ولا تخمّن؛ إن لم تجد قيمة اتركها "" أو 0 وأضف سببًا في warnings.
2) الأسماء العربية تُنسخ بالكامل بترتيبها الصحيح (اسم، أب، جد، عائلة) دون اختصار أو تصحيح إملائي أو ترجمة.
3) الأرقام: حوّل الأرقام العربية إلى إنجليزية، واحذف الفواصل ورمز العملة (﷼ / ر.س)، وأعدها كأرقام. لا تخلط بين الإيجار السنوي وإجمالي العقد والضريبة والتأمين.
4) التواريخ ميلادية YYYY-MM-DD. إن وُجد تاريخ هجري وميلادي معًا خذ الميلادي.
5) الهوية 10 أرقام، والجوال بصيغته الواردة (+9665… أو 05…). لا تتبادل بيانات الأطراف.
6) contract_type = "rent" لعقود الإيجار حتى لو كان الاستخدام تجاريًا؛ "sale" فقط لعقود البيع.
7) استخرج من هذا الملف فقط، ولا تنقل شيئًا من عقد آخر.
8) راجع الناتج قبل الإخراج وتأكد أن كل قيمة موجودة فعلًا في نص العقد.`;

    const rawText = data.extractedText?.trim() ?? "";
    // تحليل حتمي أولًا: نصحّح النص العربي المقلوب ثم نقرأ الحقول من نموذج «إيجار» مباشرة.
    const { parseEjarContract, normalizeArabicPdfText, looksScrambled } = await import("./ejar-parser");
    const deterministic = rawText ? parseEjarContract(rawText) : null;
    const cleanText = rawText && looksScrambled(rawText) ? normalizeArabicPdfText(rawText) : rawText;

    if (
      deterministic &&
      deterministic.contract_number &&
      deterministic.owner_name &&
      deterministic.owner_national_id &&
      deterministic.start_date &&
      deterministic.tenant_name
    ) {
      const warnings: string[] = [];
      if (!deterministic.payments.length) warnings.push("لم يُقرأ جدول الدفعات من العقد.");
      if (!deterministic.annual_rent) warnings.push("لم تُقرأ القيمة السنوية للإيجار.");
      return {
        extractionJson: JSON.stringify({ ...deterministic, special_terms: "", warnings, source: "parser" }),
        raw: "parser",
      };
    }

    const extractedText = cleanText.slice(0, 80_000);

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

    // Gemini أسرع مسار؛ وعند ازدحامه نستخدم Groq للنص المستخرج.
    let text: string;
    try {
      text = await callGemini(items, { json: true, fast: true, maxTokens: 3000 });
    } catch (e) {
      if (!extractedText) throw e;
      text = await callGroq(items, { json: true, maxTokens: 3000 });
    }


    const match = text.match(/\{[\s\S]*\}/);
    let extractionJson = "{}";
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        if (deterministic) {
          // القيم المقروءة حرفيًا من العقد تتفوق دائمًا على تخمين الذكاء الاصطناعي.
          for (const [key, value] of Object.entries(deterministic)) {
            const filled =
              (typeof value === "string" && value.trim()) ||
              (typeof value === "number" && value > 0) ||
              (Array.isArray(value) && value.length > 0);
            if (filled) parsed[key] = value;
          }
        }
        extractionJson = JSON.stringify(parsed);
      } catch {
        extractionJson = "{}";
      }
    }

    return { extractionJson, raw: text };
  });


const PUBLIC_PROMPT = `أنت "مساعد مثراء" — مساعد ذكي على الموقع العام لشركة مثراء العقارية في بريدة، السعودية.
مهمتك مساعدة الزوار: شرح أقسام الموقع (الإيجار، البيع، من نحن، تواصل معنا، اعرض/اطلب عقارك)، توضيح خطوات عرض عقار أو طلب عقار، والإجابة عن أسئلة عامة عن العقارات في بريدة.
${SCOPE_RULE}
أجب بالعربية الفصحى المبسطة بإجابات قصيرة ومهذبة.
أدناه قائمة بالعقارات المتاحة فعليًا على الموقع (منشورة ومرئية) بصيغة JSON. اعتمد عليها فقط عند اقتراح عقارات — لا تخترع عقارات أو أسعارًا غير واردة فيها.
عند اقتراح أي عقار من القائمة، اذكر اسمه والسعر والمدينة/الحي باختصار، وأرفق رابطه المباشر كما هو نصًا (مثل /properties/CODE) ليتمكن الزائر من فتحه مباشرة.
إن لم تجد عقارًا مناسبًا في القائمة، وضّح ذلك واقترح على الزائر التواصل عبر صفحة «تواصل معنا» أو الواتساب.`;

async function fetchPublicListingsContext(): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("properties")
      .select("code, name, price_value, price_text, purpose, property_type, city, district, status, is_visible")
      .eq("is_visible", true)
      .eq("status", "available")
      .order("is_featured", { ascending: false })
      .limit(80);
    const listings = (data ?? []).map((p) => ({
      name: p.name,
      price: p.price_value ?? p.price_text ?? null,
      purpose: p.purpose,
      type: p.property_type,
      location: [p.city, p.district].filter(Boolean).join(" - "),
      code: p.code,
      url: `/properties/${p.code}`,
    }));
    return JSON.stringify(listings);
  } catch {
    return "[]";
  }
}

export const askPublicAi = createServerFn({ method: "POST" })
  .inputValidator((input: { messages: { role: "user" | "assistant"; content: string }[] }) => input)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import("./kill-switch.server");
    await requireUnlocked();
    const items: Item[] = [
      { role: "system", content: [{ type: "input_text", text: PUBLIC_PROMPT }] },
    ];
    const listingsJson = await fetchPublicListingsContext();
    items.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: `قائمة العقارات المتاحة حاليًا (JSON):\n${listingsJson.slice(0, 20000)}`,
        },
      ],
    });
    for (const m of data.messages.slice(-12)) {
      items.push({
        role: m.role,
        content: [{ type: "input_text", text: m.content.slice(0, 2000) }],
      });
    }
    const text = await callGateway(items);
    return { text };
  });
