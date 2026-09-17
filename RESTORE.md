# مثراء — دليل الاستعادة الكامل (Full Restore)

هذا الملف يجعل المشروع قابلاً للنقل إلى أي مكان (GitHub → أي سيرفر) بنفس الشكل والوظائف.
كل الكود والهجرات وسكربتات النشر موجودة في المستودع. الشيء الوحيد الذي **لا يمكن قراءته برمجيًا**
هو قيم الأسرار (مشفّرة) — املأها يدويًا في `deploy/.env.secrets` (غير مرفوع لـ Git افتراضيًا،
أزل السطر من `.gitignore` لو أردت رفعه — تحذير أمني في آخر الملف).

---

## 1) ما هو محفوظ بالفعل في المستودع

| المحتوى | المسار |
| --- | --- |
| كود التطبيق كامل | `src/` |
| هجرات قاعدة البيانات (0000 → 0008) | `drizzle/migrations/` |
| أنواع قاعدة البيانات | `src/integrations/supabase/types.ts` |
| إعداد Docker لقاعدة بيانات ذاتية الاستضافة | `deploy/docker-compose.yml`, `deploy/init/`, `deploy/kong.yml.template` |
| Nginx + PM2 | `deploy/nginx/mithraa.conf`, `deploy/ecosystem.config.cjs` |
| سكربتات النشر والنسخ والترحيل | `deploy/scripts/00..07` |
| جسر واتساب (Baileys) | `deploy/whatsapp-bridge/` |
| أدلة التشغيل | `DEPLOYMENT.md`, `deploy/MIGRATION.md`, `deploy/HOSTINGER-QUICKSTART.md`, `WHATSAPP-INTEGRATION-HANDOFF.md`, `SHARED-TEAM-CHAT-HANDOFF.md` |
| مفاتيح العميل العامة (غير سرية) | `.env` |

---

## 2) قائمة الأسرار المطلوبة (20 سرًّا)

انسخ هذا القالب إلى `deploy/.env.secrets` واملأ القيم:

```bash
# --- ذكاء اصطناعي ---
GEMINI_API_KEY=
GEMINI_BACKUP_API_KEY=
GROQ_API_KEY=
LOVABLE_API_KEY=            # يُدار تلقائيًا داخل Lovable؛ خارج Lovable استخدم Gemini/Groq

# --- واتساب (Evolution API) ---
WHATSAPP_API_URL=           # https://evo.tradex1.cloud
WHATSAPP_API_KEY=
WHATSAPP_INSTANCE=          # mithra
WHATSAPP_BRIDGE_URL=
WHATSAPP_BRIDGE_TOKEN=

# --- واتساب (Twilio احتياطي) ---
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=       # whatsapp:+9665XXXXXXXX
TWILIO_CONTENT_SID=

# --- الأتمتة والمهام المجدولة ---
N8N_WEBHOOK_URL=
LOVABLE_CRON_SECRET=        # التوكن المستخدم في ترويسة X-Mithra-Token
KILL_SWITCH_SECRET=

# --- إشعارات Push ---
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=              # mailto:...

# --- تهيئة أول مدير ---
SUPER_ADMIN_INIT_PASSWORD=
```

> القيم الحالية محفوظة مشفّرة في إعدادات المشروع ولا يمكن استخراجها آليًا.
> انسخها من لوحة الأسرار مرة واحدة والصقها هنا.

### مفاتيح العميل (موجودة في `.env` وليست سرية)

```
VITE_SUPABASE_URL=https://gfljbkxvcnraitwsdegw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_394UeidQaJyUHP67_RAa-g_vP4xfF54
VITE_SUPABASE_PROJECT_ID=gfljbkxvcnraitwsdegw
```

---

## 3) خطوات الاستعادة الكاملة (8 خطوات)

### الخطوة 1 — المتطلبات الأساسية
- سيرفر (VPS) بنظام Ubuntu حديث، بصلاحية root أو sudo.
- Docker وDocker Compose، Node.js/Bun، Nginx، PM2 (تُثبَّت تلقائيًا عبر `deploy/scripts/05-setup-vps.sh`).
- نسخة من المستودع (Git clone) وآخر نسخة احتياطية JSON من صفحة "النسخ الاحتياطي" داخل التطبيق (أو dump كامل من `deploy/scripts/01-export-from-cloud.sh`).
- قائمة الأسرار الكاملة (القسم 2 أعلاه) جاهزة قبل البدء.

```bash
git clone <repo-url> /var/www/mithraa && cd /var/www/mithraa
bun install
```

### الخطوة 2 — استعادة قاعدة البيانات
- استخدم dump قاعدة البيانات الكامل (schema + data) الناتج من `01-export-from-cloud.sh`، أو استورد النسخة الشاملة JSON يدويًا (جدول جدول) إن كانت هي المصدر الوحيد المتاح.
- على السيرفر الجديد:
```bash
bash deploy/scripts/00-generate-keys.sh    # لو قاعدة بيانات ذاتية الاستضافة (Supabase self-hosted)
bash deploy/scripts/02-import-to-vps.sh    # استيراد الـ dump إلى Postgres
```
- عند الاستعادة من نسخة JSON الشاملة (من صفحة النسخ الاحتياطي)، أدرِج كل جدول بترتيب يحترم المفاتيح الأجنبية (المدن → الأحياء → المباني → الوحدات → العقارات → جهات الاتصال → العقود → الفواتير...).

### الخطوة 3 — استعادة ملفات التخزين (Storage)
```bash
bun run deploy/scripts/03-copy-storage.ts
```
- تأكد من نقل كل الصور والمستندات (صور العقارات، مستندات الملاك، مرفقات المهام) وأن مسارات الملفات في قاعدة البيانات تطابق المسارات الجديدة على السيرفر.

### الخطوة 4 — إعادة تطبيق الأسرار والمتغيرات البيئية
```bash
cp deploy/.env.example deploy/.env
# املأ كل قيم القسم 2 (مفاتيح الذكاء الاصطناعي، واتساب، Twilio، الأتمتة، Push، إلخ)
```
- تأكد أيضًا من نسخ متغيرات `.env` الخاصة بالعميل (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) في ملف البيئة الأمامي.

### الخطوة 5 — إعادة البناء والنشر
```bash
bash deploy/scripts/05-setup-vps.sh   # Docker + Nginx + PM2 + SSL (أول مرة فقط)
bash deploy/scripts/04-verify.sh      # فحص شامل قبل النشر
bash deploy/scripts/07-deploy.sh      # بناء التطبيق وتشغيله عبر PM2
```
- راقب سجلات PM2 (`pm2 logs`) وتأكد من عدم وجود أخطاء إقلاع.

### الخطوة 6 — إعادة ربط واتساب عبر رمز QR
- افتح جسر واتساب (`deploy/whatsapp-bridge/`) وشغّله عبر PM2:
```bash
pm2 restart whatsapp-bridge || pm2 start deploy/whatsapp-bridge/ecosystem.config.cjs
pm2 logs whatsapp-bridge
```
- امسح رمز QR الظاهر في السجلات (أو من صفحة إعدادات واتساب داخل التطبيق) باستخدام تطبيق واتساب على الجوال المرتبط بالحساب الرسمي.
- تحقق من نجاح الاتصال بإرسال رسالة اختبار من التطبيق.

### الخطوة 7 — إعادة تفعيل الجدولة (Cron / Scheduler)
```bash
crontab -e
# أضف:
0 * * * * /root/mithra-jobs/reminders.sh
```
```bash
# /root/mithra-jobs/reminders.sh
curl -s -X POST https://<domain>/api/public/n8n \
  -H "Content-Type: application/json" \
  -H "X-Mithra-Token: $LOVABLE_CRON_SECRET" \
  -d '{"action":"process_reminders"}'
```
- تأكد من أن `LOVABLE_CRON_SECRET` مطابق للقيمة في `deploy/.env.secrets`، وأن مفتاح إيقاف الطوارئ (`KILL_SWITCH_SECRET`) غير مُفعَّل بالخطأ.

### الخطوة 8 — قائمة التحقق النهائية (Verification Checklist)
- [ ] تسجيل الدخول يعمل، ومدير النظام (super_admin) يظهر بصلاحياته كاملة.
- [ ] عدد السجلات في كل جدول (من مانيفست النسخة الاحتياطية) مطابق لما بعد الاستيراد.
- [ ] صور العقارات والمستندات تُفتح بنجاح (تحقق من عيّنة عشوائية).
- [ ] إرسال واستقبال رسائل واتساب يعمل بعد ربط QR.
- [ ] المهام المجدولة (تذكيرات العقود، التنبيهات) تعمل خلال أول ساعة بعد إعادة تفعيل الـ cron.
- [ ] لوحة التقارير والفواتير تعرض أرقامًا صحيحة (لا نقص أو تكرار).
- [ ] لا توجد أخطاء في سجلات PM2/Nginx خلال أول 24 ساعة تشغيل.
- [ ] نسخة احتياطية جديدة تُؤخذ فورًا بعد التأكد من سلامة النظام (لإغلاق الدورة).

---

## 4) تحذير أمني

رفع `deploy/.env.secrets` إلى GitHub آمن **فقط** لو المستودع **private**.
لو أصبح المستودع عامًا في أي لحظة، غيّر فورًا: مفاتيح Gemini/Groq، توكن Twilio،
مفتاح Evolution API، `LOVABLE_CRON_SECRET`، `KILL_SWITCH_SECRET`، ومفاتيح VAPID.
