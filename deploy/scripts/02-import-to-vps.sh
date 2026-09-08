#!/usr/bin/env bash
# يستورد النسخة إلى قاعدة البيانات المحلية داخل Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

FILE=${1:-backup/latest.sql}
[ -f "$FILE" ] || { echo "الملف $FILE غير موجود"; exit 1; }

echo "== انتظار قاعدة البيانات =="
for i in $(seq 1 60); do
  docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done

echo "== الاستيراد =="
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < "$FILE"

echo "== ضبط الصلاحيات =="
docker compose exec -T db psql -U postgres -d postgres <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
notify pgrst, 'reload schema';
SQL

echo "تم الاستيراد. تحقق: docker compose exec db psql -U postgres -c 'select count(*) from auth.users;'"
