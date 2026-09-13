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

## 3) خطوات الاستعادة على سيرفر جديد

```bash
git clone <repo-url> /var/www/mithraa && cd /var/www/mithraa
bun install
cp deploy/.env.example deploy/.env        # املأ القيم من القسم 2
bash deploy/scripts/00-generate-keys.sh   # لو قاعدة بيانات ذاتية الاستضافة
bash deploy/scripts/05-setup-vps.sh       # Docker + Nginx + PM2 + SSL
bash deploy/scripts/02-import-to-vps.sh   # استيراد نسخة قاعدة البيانات
bun run deploy/scripts/03-copy-storage.ts # نقل الملفات المرفوعة
bash deploy/scripts/04-verify.sh          # فحص شامل
bash deploy/scripts/07-deploy.sh          # بناء وتشغيل
```

### الأتمتة (cron كل ساعة)

```bash
# /root/mithra-jobs/reminders.sh
curl -s -X POST https://<domain>/api/public/n8n \
  -H "Content-Type: application/json" \
  -H "X-Mithra-Token: $LOVABLE_CRON_SECRET" \
  -d '{"action":"process_reminders"}'
```

### نسخة قاعدة البيانات

```bash
bash deploy/scripts/01-export-from-cloud.sh   # يُنتج dump كامل (schema + data)
bash deploy/scripts/06-backup.sh              # نسخ دورية
```

---

## 4) تحذير أمني

رفع `deploy/.env.secrets` إلى GitHub آمن **فقط** لو المستودع **private**.
لو أصبح المستودع عامًا في أي لحظة، غيّر فورًا: مفاتيح Gemini/Groq، توكن Twilio،
مفتاح Evolution API، `LOVABLE_CRON_SECRET`، `KILL_SWITCH_SECRET`، ومفاتيح VAPID.
