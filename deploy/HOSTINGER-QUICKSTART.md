# خطوات Hostinger — انسخ والصق بالترتيب

كل بلوك تنسخه كما هو وتلصقه في **وحدة تحكم الويب (Browser terminal)** الخاصة بالـVPS
على العنوان `72.61.190.233` (وليس في شات الذكاء الاصطناعي).
انتظر انتهاء كل بلوك قبل البلوك التالي.

الأولوية هنا: تشغيل **واتساب المجاني** أولًا، ثم رفع الموقع كاملًا.

---

## 0) تأمين الخادم (مرة واحدة)

```bash
passwd
```

اكتب كلمة مرور جديدة قوية مرتين (لن تظهر أثناء الكتابة).

---

## 1) تثبيت الأساسيات

```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx unzip ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
node -v && npm -v && nginx -v
```

> ملاحظة: تجاهل أي تحذير عن `npm@12` — غير مطلوب.

---

## 2) جلب المشروع

استبدل `RRR` برابط مستودع GitHub الحقيقي للمشروع (من زر GitHub في Lovable):

```bash
mkdir -p /var/www && cd /var/www
git clone RRR mithraa
cd /var/www/mithraa && ls
```

يجب أن ترى `src` و `deploy` و `package.json`.

---

## 3) تشغيل جسر واتساب المجاني

```bash
cd /var/www/mithraa/deploy/whatsapp-bridge
npm install
npm i @hapi/boom
openssl rand -hex 32
```

انسخ الناتج (توكن طويل) واحتفظ به، ثم:

```bash
cd /var/www/mithraa/deploy/whatsapp-bridge
export BRIDGE_TOKEN="ضع-هنا-التوكن-الذي-نسخته"
pm2 start server.js --name whatsapp-bridge --update-env
pm2 save
pm2 startup systemd -u root --hp /root
curl -s http://127.0.0.1:3010/health
```

---

## 4) ربط النطاق wa.mithra.work بالجسر

```bash
cat >/etc/nginx/sites-available/wa <<'EOF'
server {
    listen 80;
    server_name wa.mithra.work;
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/wa /etc/nginx/sites-enabled/wa
nginx -t && systemctl reload nginx
certbot --nginx -d wa.mithra.work --agree-tos -m admin@mithra.work --redirect -n
curl -s https://wa.mithra.work/health
```

بعد نجاح هذه الخطوة أعطِ الموقع المتغيرين التاليين (من إعدادات المشروع، لا من الخادم):

| المتغير | القيمة |
| --- | --- |
| `WHATSAPP_BRIDGE_URL` | `https://wa.mithra.work` |
| `WHATSAPP_BRIDGE_TOKEN` | نفس التوكن أعلاه |

ثم افتح في لوحة التحكم صفحة **ربط واتساب** وامسح رمز QR من تطبيق واتساب
(الإعدادات ← الأجهزة المرتبطة ← ربط جهاز). بعدها كل زر «إرسال تذكير» يرسل من رقمك مجانًا.

---

## 5) تشغيل قاعدة البيانات والحسابات على الخادم

```bash
cd /var/www/mithraa
curl -fsSL https://get.docker.com | sh
bash deploy/scripts/00-generate-keys.sh
```

انسخ كل المفاتيح الظاهرة، ثم:

```bash
cd /var/www/mithraa/deploy
cp .env.example .env
nano .env
```

الصق المفاتيح، واضبط `PUBLIC_BASE_URL=https://app.mithra.work`،
و`STORAGE_LOCAL_DIR=/var/www/mithraa/storage`، ومفاتيح Gemini/Groq.
احفظ بـ `Ctrl+O` ثم `Enter` ثم `Ctrl+X`.

```bash
cd /var/www/mithraa/deploy
envsubst < kong.yml.template > kong.yml
docker compose --env-file .env up -d
docker compose ps
```

---

## 6) بناء الموقع وتشغيله

```bash
cd /var/www/mithraa
curl -fsSL https://bun.sh/install | bash && ln -sf /root/.bun/bin/bun /usr/local/bin/bun
bun install
set -a; source deploy/.env; set +a
bun run build
mkdir -p /var/log/mithraa
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save
```

---

## 7) ربط النطاق app.mithra.work بالموقع

```bash
cp /var/www/mithraa/deploy/nginx/mithraa.conf /etc/nginx/sites-available/mithraa
sed -i 's/your-domain.sa/app.mithra.work/g; s/www.app.mithra.work//g' /etc/nginx/sites-available/mithraa
ln -sf /etc/nginx/sites-available/mithraa /etc/nginx/sites-enabled/mithraa
nginx -t && systemctl reload nginx
certbot --nginx -d app.mithra.work --agree-tos -m admin@mithra.work --redirect -n
```

---

## 8) فحص نهائي

```bash
cd /var/www/mithraa && bash deploy/scripts/04-verify.sh
pm2 ls
```

---

## أوامر سريعة لاحقًا

```bash
pm2 logs whatsapp-bridge --lines 50   # سجل واتساب
pm2 logs mithraa --lines 50           # سجل الموقع
cd /var/www/mithraa && bash deploy/scripts/07-deploy.sh   # تحديث بعد أي تعديل
```
