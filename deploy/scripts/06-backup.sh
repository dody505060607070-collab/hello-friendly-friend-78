#!/usr/bin/env bash
# نسخة احتياطية يومية (قاعدة البيانات + الملفات). ضعه في cron:
#   0 3 * * * /var/www/mithraa/deploy/scripts/06-backup.sh >> /var/log/mithraa/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

STAMP=$(date +%Y%m%d)
DIR=/var/backups/mithraa
mkdir -p "$DIR"

docker compose exec -T db pg_dump -U postgres postgres | gzip > "$DIR/db-$STAMP.sql.gz"
tar -czf "$DIR/storage-$STAMP.tar.gz" -C "$(dirname "$STORAGE_LOCAL_DIR")" "$(basename "$STORAGE_LOCAL_DIR")"

find "$DIR" -type f -mtime +14 -delete
echo "نسخة احتياطية تمت: $DIR (db-$STAMP, storage-$STAMP)"
