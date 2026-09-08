#!/usr/bin/env bash
# فحص شامل بعد الربط: قاعدة البيانات، الحسابات، الـAPI، الـRealtime، التخزين، واتساب.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
ok(){ echo "✅ $1"; }; bad(){ echo "❌ $1"; }

docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && ok "قاعدة البيانات تعمل" || bad "قاعدة البيانات"
U=$(docker compose exec -T db psql -U postgres -tAc "select count(*) from auth.users" 2>/dev/null)
[ -n "${U:-}" ] && ok "عدد الحسابات: $U" || bad "جدول الحسابات"
P=$(docker compose exec -T db psql -U postgres -tAc "select count(*) from public.properties" 2>/dev/null)
[ -n "${P:-}" ] && ok "عدد العقارات: $P" || bad "جدول العقارات"

curl -sf -H "apikey: $ANON_KEY" "http://127.0.0.1:8000/rest/v1/" >/dev/null && ok "REST API" || bad "REST API"
curl -sf "http://127.0.0.1:8000/auth/v1/health" >/dev/null && ok "خدمة الحسابات" || bad "خدمة الحسابات"

[ -d "$STORAGE_LOCAL_DIR" ] && ok "مجلد التخزين: $(du -sh "$STORAGE_LOCAL_DIR" 2>/dev/null | cut -f1)" || bad "مجلد التخزين"
curl -sf -o /dev/null "$PUBLIC_BASE_URL" && ok "الموقع يستجيب" || bad "الموقع"

if [ -n "${TWILIO_ACCOUNT_SID:-}" ]; then
  curl -sf -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
    "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" >/dev/null \
    && ok "Twilio متصل" || bad "بيانات Twilio"
else echo "ℹ️ Twilio غير مضبوط بعد (النظام يعمل بروابط wa.me)"; fi

[ -n "${GEMINI_API_KEY:-}" ] && ok "مفتاح Gemini موجود" || bad "مفتاح Gemini"
