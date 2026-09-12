# ربط الواتساب للموقع المنسوخ (Remix) — ملف تسليم للذكاء الاصطناعي

> هذا الملف مكتوب عشان يتسلم لأي AI يشتغل على الموقع المنسوخ من مشروع مثراء.
> فيه كل المعلومات والخطوات عشان يربط الواتساب على **نفس سيرفر Hostinger VPS**
> من غير ما يأثر على الموقع الأصلي (المصري).

---

## 1) الوضع الحالي على السيرفر (لا تلمسه)

الموقع الأصلي (مثراء — المصري) شغال على Hostinger VPS وفيه:

| المكوّن | المكان / الاسم |
|---|---|
| Evolution API | `https://evo.tradex1.cloud` (Docker على الـ VPS) |
| Instance الواتساب الأصلي | `mithra` |
| n8n | شغال على الـ VPS (Docker) |
| سكربت التذكيرات | `/root/mithra-jobs/reminders.sh` (cron) يضرب `/api/public/n8n` |
| Nginx | يوزّع الدومينات على الـ apps |
| SSL | شغال عبر Certbot — `evo.tradex1.cloud` راجع 200 |

⚠️ **ممنوع** تعديل instance `mithra` أو الـ cron أو إعدادات Nginx الخاصة بالموقع الأول.

---

## 2) القاعدة الذهبية للفصل

عشان الموقعين ما يدخلوش في بعض، الموقع الجديد لازم يبقى له:

1. **Instance واتساب منفصلة** على نفس Evolution API — مثلاً `mithra2`.
   - نفس رقم الواتساب ممكن يتشارك، لكن الأفضل والأأمن instance لكل موقع.
   - لإنشائها: POST على `{WHATSAPP_API_URL}/instance/create` بجسم:
     `{ "instanceName": "mithra2", "integration": "WHATSAPP-BAILEYS" }` بهيدر `apikey: {WHATSAPP_API_KEY}`.
2. **أسرار (secrets) خاصة بالموقع الجديد** — تشيلها في Lovable Cloud بتاع المشروع الجديد.
3. لو هتشغل سكربتات cron للموقع التاني: **مسار منفصل** مثل `/root/site2-jobs/` — ممنوع تعديل `/root/mithra-jobs/`.

نفس الـ VPS + نفس n8n + نفس Evolution + نفس Stripe: كل دول ممكن يتشاركوا عادي.

---

## 3) الأسرار المطلوبة في المشروع الجديد

الكود جاهز بالفعل (اتعمل remix) — كل اللي محتاجه 3 أسرار في Lovable Cloud:

| الاسم | القيمة | مصدرها |
|---|---|---|
| `WHATSAPP_API_URL` | `https://evo.tradex1.cloud` | ثابتة |
| `WHATSAPP_API_KEY` | مفتاح Evolution API (الـ global apikey) | من ملف `.env` بتاع Evolution على السيرفر (`docker compose` config) |
| `WHATSAPP_INSTANCE` | `mithra2` (أو أي اسم منفصل للموقع الجديد) | تختاره — ممنوع `mithra` عشان ده بتاع الموقع الأول |

⚠️ المفتاح سري — يتحفظ عبر أداة الأسرار في Lovable، ممنوع يتحط في الكود.

---

## 4) الكود الموجود أصلاً (ما تعيدش كتابته)

- `src/lib/whatsapp.functions.ts` — دوال: إرسال رسالة، QR connect، حالة الاتصال، logout.
  - فيه `cloudEnsureInstance(instance)` — بتعمل الـ instance تلقائيًا لو مش موجودة.
  - بتقرأ الأسرار الثلاثة فوق من `process.env`.
- `src/routes/api/public/n8n.ts` — Webhook يستقبل أحداث من n8n (تذكيرات/متابعات).
- `src/lib/automation.server.ts` — تكامل n8n (جدولة التذكيرات والمتابعات).
- صفحة إدارة الواتساب في لوحة التحكم — تعرض QR وتسمح بمسحه وربط الرقم.

---

## 5) خطوات التفعيل بالترتيب

1. **حط الأسرار الثلاثة** (سكشن 3) في المشروع الجديد.
2. **افتح صفحة الواتساب** في لوحة تحكم الموقع الجديد:
   - الكود هيكلم Evolution، لو instance `mithra2` مش موجودة `cloudEnsureInstance` هيعملها.
   - هيطلع **QR Code** — امسحه بالواتساب على الموبايل.
   - استنى لحد ما الحالة تبقى `open`.
   - لو الرقم هو نفس رقم الموقع الأول: اعرف إن الواتساب بيسمح بجلسة Baileys واحدة فعالة لكل instance — امسح QR بتاع `mithra2` وده هيفصل القديم لو على نفس الجهاز. الأضمن: رقم منفصل للموقع التاني.
3. **جرّب الإرسال**: ابعت رسالة تجريبية من صفحة الواتساب لرقمك — لازم توصل.
4. **n8n** (اختياري): لو عايز تذكيرات مجدولة للموقع الجديد:
   - استخدم نفس n8n instance، اعمل workflow جديد مخصص للموقع التاني.
   - الـ webhook endpoint: `https://<دومين-الموقع-الجديد>/api/public/n8n` مع توكن الموقع الجديد.
   - لو cron على السيرفر: `/root/site2-jobs/reminders.sh` بمسار وتوكن منفصلين.

---

## 6) اختبارات سريعة (Smoke tests)

```bash
# السيرفر شغال؟
curl -s -o /dev/null -w "%{http_code}" https://evo.tradex1.cloud   # المتوقع 200

# المفتاح صح؟ (من غير مفتاح بيرجع 401)
curl -s -o /dev/null -w "%{http_code}" -H "apikey: <WHATSAPP_API_KEY>" \
  https://evo.tradex1.cloud/instance/fetchInstances               # المتوقع 200

# حالة instance الموقع الجديد
curl -s -H "apikey: <WHATSAPP_API_KEY>" \
  https://evo.tradex1.cloud/instance/connectionState/mithra2
```

من داخل الموقع الجديد: صفحة الواتساب → الحالة `open` + إرسال رسالة تجريبية بنجاح = تمام.

---

## 7) أخطاء شائعة وحلولها

| العرض | السبب | الحل |
|---|---|---|
| `مفتاح خدمة واتساب غير صحيح` | `WHATSAPP_API_KEY` غلط أو فيه مسافات/علامات تنصيص | راجع القيمة من `.env` بتاع Evolution |
| `لا يوجد اتصال باسم ...` | الـ instance مش متعملة | الكود بيعملها تلقائيًا؛ لو فشل، اعملها يدويًا بـ `/instance/create` |
| QR مش بيطلع | instance متصلة أصلاً (state=open) | اعمل logout الأول من صفحة الواتساب |
| الرسايل مش بتوصل | الحالة مش `open` | امسح QR تاني واستنى الاتصال |
| الموقع الأول وقف بعت | اتعمل logout للـ instance الغلط | instance كل موقع منفصلة — راجع `WHATSAPP_INSTANCE` |

---

## 8) تذكير أخير

- ممنوع لمس: instance `mithra`، مجلد `/root/mithra-jobs/`، إعدادات Nginx/SSL بتاعة الموقع الأول.
- كل حاجة للموقع الجديد تتعمل بأسماء ومسارات منفصلة.
- نفس المفتاح (`WHATSAPP_API_KEY`) بيشتغل للاتنين لأنه مفتاح Evolution العام — الفرق بس في اسم الـ instance.
