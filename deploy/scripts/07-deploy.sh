#!/usr/bin/env bash
# تحديث النظام بعد أي تعديل على الكود.
set -euo pipefail
cd /var/www/mithraa

git pull --ff-only || true
bun install
set -a; source deploy/.env; set +a
bun run build
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save
echo "تم النشر."
