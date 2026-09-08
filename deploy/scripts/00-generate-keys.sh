#!/usr/bin/env bash
# يولّد كل المفاتيح المطلوبة ويطبعها جاهزة للصق في deploy/.env
set -euo pipefail

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
jwt() { # $1 = role, $2 = secret
  local header payload sig
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' \
    "$1" "$(date +%s)" "$(( $(date +%s) + 60*60*24*365*10 ))" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -binary -sha256 -hmac "$2" | b64url)
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
REALTIME_ENC_KEY=$(openssl rand -hex 8)
REALTIME_SECRET_KEY_BASE=$(openssl rand -hex 32)

cat <<EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$(jwt anon "$JWT_SECRET")
SERVICE_ROLE_KEY=$(jwt service_role "$JWT_SECRET")
REALTIME_ENC_KEY=$REALTIME_ENC_KEY
REALTIME_SECRET_KEY_BASE=$REALTIME_SECRET_KEY_BASE
EOF
