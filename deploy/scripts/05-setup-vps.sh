#!/usr/bin/env bash
# تجهيز الخادم من الصفر (Ubuntu 22/24 على Hostinger VPS).
set -euo pipefail

apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx postgresql-client ca-certificates gnupg unzip

# Docker
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Bun + PM2 (Node)
if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
fi
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

mkdir -p /var/www/mithraa/storage
echo "تم التجهيز. التالي: انسخ المشروع إلى /var/www/mithraa وشغّل deploy/scripts/00-generate-keys.sh"
