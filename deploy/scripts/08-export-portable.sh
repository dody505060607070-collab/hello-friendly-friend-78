#!/usr/bin/env bash
# Creates one encrypted portable backup without exposing secrets to Git.
# Usage: PORTABLE_BACKUP_PASSWORD='strong password' bash deploy/scripts/08-export-portable.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"
ENV_FILE="$DEPLOY_DIR/.env"

if [ -z "${PORTABLE_BACKUP_PASSWORD:-}" ]; then
  echo "PORTABLE_BACKUP_PASSWORD is required" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deploy/.env" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d)"
OUT_DIR="${PORTABLE_BACKUP_DIR:-/var/backups/rashoudi-portable}"
ARCHIVE="$OUT_DIR/rashoudi-full-$STAMP.tar.gz.enc"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR" "$WORK_DIR/runtime"
chmod 700 "$OUT_DIR" "$WORK_DIR"

docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE" \
  exec -T db pg_dump -U postgres postgres | gzip > "$WORK_DIR/database.sql.gz"

cp "$ENV_FILE" "$WORK_DIR/runtime/deploy.env"
if [ -f "$DEPLOY_DIR/kong.yml" ]; then
  cp "$DEPLOY_DIR/kong.yml" "$WORK_DIR/runtime/kong.yml"
fi

if [ -n "${STORAGE_LOCAL_DIR:-}" ] && [ -d "$STORAGE_LOCAL_DIR" ]; then
  tar -czf "$WORK_DIR/storage.tar.gz" -C "$(dirname "$STORAGE_LOCAL_DIR")" "$(basename "$STORAGE_LOCAL_DIR")"
fi
if [ -d "$DEPLOY_DIR/whatsapp-bridge/auth" ]; then
  tar -czf "$WORK_DIR/whatsapp-session.tar.gz" -C "$DEPLOY_DIR/whatsapp-bridge" auth
fi

cat > "$WORK_DIR/MANIFEST.txt" <<EOF
Rashoudi portable backup
Created UTC: $STAMP
Contains: database, runtime environment, optional storage, optional WhatsApp session
Encryption: AES-256-CBC with PBKDF2
EOF

tar -czf - -C "$WORK_DIR" . | openssl enc -aes-256-cbc -salt -pbkdf2 \
  -pass env:PORTABLE_BACKUP_PASSWORD -out "$ARCHIVE"
chmod 600 "$ARCHIVE"

echo "Encrypted backup created: $ARCHIVE"
echo "Keep PORTABLE_BACKUP_PASSWORD outside GitHub and test restoration before migration."