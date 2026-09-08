# خطة نقل مثراء بالكامل إلى Hostinger VPS

كل شيء جاهز في مجلد `deploy/`. لا شيء في النظام يعتمد على Lovable بعد النقل:
قاعدة البيانات + الحسابات + الملفات + الذكاء الاصطناعي + واتساب — كلها على خادمك.

## ما الذي ينتقل؟

| المكوّن | قبل | بعد (على الـVPS) |
| --- | --- | --- |
| قاعدة البيانات | سحابية | PostgreSQL داخل Docker |
| الحسابات وتسجيل الدخول | سحابي | GoTrue (نفس نظام الحسابات) |
| واجهة البيانات (REST) | سحابية | PostgREST خلف بوابة Kong |
| التحديث الفوري (الشات/الإشعارات) | سحابي | Realtime داخل Docker |
| الصور والفيديو والعقود | تخزين سحابي | قرص الـVPS (50–70 جيجا أو أكثر) |
| الذكاء الاصطناعي | Gateway | Google Gemini مباشرة + Groq احتياطي |
| واتساب | — | Twilio |

## الخطوات بالترتيب (يوم الربط)

1. **تجهيز الخادم**: `sudo bash deploy/scripts/05-setup-vps.sh`
2. **نسخ المشروع** إلى `/var/www/mithraa`.
3. **توليد المفاتيح**: `bash deploy/scripts/00-generate-keys.sh` ثم الصق الناتج في `deploy/.env`
   (انسخ القالب من `deploy/.env.example` وأكمل الدومين ومفاتيح Gemini/Groq/Twilio).
4. **توليد إعداد البوابة**: `cd deploy && set -a && source .env && set +a && envsubst < kong.yml.template > kong.yml`
5. **تشغيل الخلفية**: `cd deploy && docker compose --env-file .env up -d`
6. **تصدير البيانات الحالية**: ضع `SOURCE_DB_URL` في `.env` ثم `bash scripts/01-export-from-cloud.sh`
7. **استيرادها محليًا**: `bash scripts/02-import-to-vps.sh`
8. **نقل الملفات**: `bun scripts/03-copy-storage.ts` (يحتاج `SOURCE_SUPABASE_URL` و`SOURCE_SERVICE_ROLE_KEY`)
9. **بناء وتشغيل التطبيق**: `bun install && bun run build && pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup`
10. **Nginx + شهادة SSL**: انسخ `deploy/nginx/mithraa.conf` وبدّل الدومين ثم `certbot --nginx -d your-domain.sa`
11. **الفحص النهائي**: `bash deploy/scripts/04-verify.sh` — يجب أن تكون كل السطور ✅
12. **النسخ الاحتياطي**: أضف `deploy/scripts/06-backup.sh` إلى cron يوميًا.

## ما الذي أحتاجه منك (هذه هي النقاط الوحيدة المتبقية)

1. بيانات الـVPS: عنوان IP + مستخدم SSH.
2. الدومين النهائي (لضبط `PUBLIC_BASE_URL` وشهادة SSL).
3. مفاتيح Twilio الثلاثة: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, رقم واتساب المرسل.
4. (اختياري) `GOOGLE_CLIENT_ID` و`GOOGLE_CLIENT_SECRET` لتفعيل الدخول بجوجل على الخادم الجديد.
5. (اختياري) بيانات SMTP لرسائل استعادة كلمة المرور.

## ملاحظات مهمة

- كلمات مرور المستخدمين تنتقل كما هي (تُنقل تجزئتها ضمن `auth.users`) — لا أحد يحتاج إعادة تعيين.
- بعد النقل بدّل الروابط في التطبيق تلقائيًا عبر `SUPABASE_URL=https://your-domain.sa/api-gw`
  و`VITE_SUPABASE_URL` بنفس القيمة — لا تعديل كود مطلوب.
- ارفع `client_max_body_size` في Nginx (مضبوط على 200M) لملفات العقود والفيديو.
- الرجوع للخلف: أوقف PM2 وأعد `VITE_SUPABASE_URL` القديم — لا يُفقد شيء.
