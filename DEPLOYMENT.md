# تشغيل نظام مثراء على Hostinger VPS

النظام لا يعتمد على أي خدمة من Lovable في التشغيل. كل شيء يُضبط بمتغيرات بيئة.

## 1. متغيرات البيئة (ملف `.env` على الخادم)

```bash
# قاعدة البيانات والمصادقة
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...

# الذكاء الاصطناعي (Google أولًا، Groq احتياطي)
GEMINI_API_KEY=...
GEMINI_BACKUP_API_KEY=...
GROQ_API_KEY=...
# LOVABLE_API_KEY غير مطلوب — إن لم يوجد يتخطاه النظام تمامًا

# التخزين على قرص الخادم (50–70 جيجا أو أكثر)
STORAGE_DRIVER=local
VITE_STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/var/www/mithraa/storage
STORAGE_MAX_UPLOAD_MB=200

# واتساب Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+9665XXXXXXXX

PUBLIC_BASE_URL=https://your-domain.sa
```

## 2. التخزين

- عند `STORAGE_DRIVER=local` تُحفظ كل الصور والفيديو وملفات العقود في
  `STORAGE_LOCAL_DIR` على قرص الـVPS، وتُقدَّم عبر `/api/public/files/<path>`.
- خذ نسخة احتياطية دورية لهذا المجلد (rsync أو snapshot من Hostinger).
- قبل التحويل، انسخ الملفات القديمة من التخزين السحابي إلى نفس المجلد بنفس
  المسارات (`property-media/...`, `internal-files/...`, `contracts/...`).

## 3. واتساب Twilio

- رابط الـWebhook في لوحة Twilio:
  `https://your-domain.sa/api/public/twilio-whatsapp`
- الإرسال من داخل النظام يستخدم `sendWhatsApp` في `src/lib/whatsapp.functions.ts`.
- بدون المفاتيح يعمل النظام ويعيد رابط `wa.me` للإرسال اليدوي (لا يتعطل شيء).

## 4. البناء والتشغيل

```bash
bun install
bun run build
node .output/server/index.mjs   # أو عبر PM2 خلف Nginx
```

في Nginx ارفع `client_max_body_size 200M;` حتى تمرّ ملفات الرفع الكبيرة.

## 5. النقل الكامل إلى الخادم

خطة النقل الكاملة (قاعدة البيانات + الحسابات + الملفات) في `deploy/MIGRATION.md`،
وكل الملفات الجاهزة في مجلد `deploy/`.
