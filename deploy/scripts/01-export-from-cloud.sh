#!/usr/bin/env bash
# ينسخ قاعدة البيانات الحالية (بما فيها الحسابات auth.users) إلى ملف واحد.
# شغّله من مجلد deploy بعد ضبط SOURCE_DB_URL في .env
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

: "${SOURCE_DB_URL:?ضع SOURCE_DB_URL في deploy/.env}"
mkdir -p backup
STAMP=$(date +%Y%m%d-%H%M%S)

echo "== تصدير المخططات والبيانات =="
pg_dump "$SOURCE_DB_URL" \
  --no-owner --no-privileges --quote-all-identifiers \
  --schema=public --schema=auth --schema=storage \
  --exclude-table-data='storage.s3_multipart_uploads*' \
  -f "backup/mithraa-$STAMP.sql"

ln -sf "mithraa-$STAMP.sql" backup/latest.sql
echo "تم: deploy/backup/mithraa-$STAMP.sql"
