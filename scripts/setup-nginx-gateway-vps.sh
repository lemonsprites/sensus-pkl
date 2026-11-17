#!/usr/bin/env bash
# Pasang site gateway sensus di VPS (bukan vm101).
# VPS meneruskan domain publik ke VM101:APP_PORT.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG:-$ROOT/scripts/deploy-vm101.env}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

GATEWAY_HOST="${GATEWAY_HOST:-vps}"
UPSTREAM_HOST="${UPSTREAM_HOST:-192.168.100.252}"
APP_PORT="${APP_PORT:-3100}"
DOMAIN="${DOMAIN:-sensus.matsanesacis.sch.id}"
NGINX_NAME="${NGINX_NAME:-sensus}"
DRY_RUN="${DRY_RUN:-0}"
TLS=0

die() { printf '\n\033[1;31m[gateway]\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\n\033[1;36m[gateway]\033[0m %s\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tls) TLS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --help|-h)
      cat <<EOF
Pemakaian: bash scripts/setup-nginx-gateway-vps.sh [opsi]
  --tls      Jalankan certbot di VPS setelah config terpasang
  --dry-run  Tampilkan config tanpa mengubah VPS

Gateway: $GATEWAY_HOST
Domain:  $DOMAIN
Upstream: $UPSTREAM_HOST:$APP_PORT
File: /etc/nginx/sites-available/$NGINX_NAME.conf
EOF
      exit 0
      ;;
    *) die "Opsi tidak dikenal: $1" ;;
  esac
  shift
done

for command in ssh scp sed; do
  command -v "$command" >/dev/null 2>&1 || die "Perintah '$command' tidak ditemukan."
done
[[ -f "$ROOT/deploy/nginx-sensus-gateway.conf.example" ]] || die "Template gateway tidak ditemukan."

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT
sed -e "s/sensus\\.matsanesacis\\.sch\\.id/$DOMAIN/g" \
    -e "s/192\\.168\\.100\\.252:3100/$UPSTREAM_HOST:$APP_PORT/g" \
    "$ROOT/deploy/nginx-sensus-gateway.conf.example" > "$TMP_FILE"

info "Gateway: $GATEWAY_HOST -> $UPSTREAM_HOST:$APP_PORT"
info "Site: /etc/nginx/sites-available/$NGINX_NAME.conf"
if [[ "$DRY_RUN" == "1" ]]; then
  cat "$TMP_FILE"
  info "Dry-run selesai; tidak ada perubahan VPS."
  exit 0
fi

scp "$TMP_FILE" "$GATEWAY_HOST:/tmp/$NGINX_NAME.conf"
ssh "$GATEWAY_HOST" \
  "env NGINX_NAME=$(printf '%q' "$NGINX_NAME") DOMAIN=$(printf '%q' "$DOMAIN") TLS=$(printf '%q' "$TLS") bash -s" <<'REMOTE'
set -Eeuo pipefail
if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi
$SUDO install -m 0644 "/tmp/$NGINX_NAME.conf" "/etc/nginx/sites-available/$NGINX_NAME.conf"
$SUDO ln -sfn "/etc/nginx/sites-available/$NGINX_NAME.conf" "/etc/nginx/sites-enabled/$NGINX_NAME.conf"
$SUDO nginx -t
$SUDO systemctl reload nginx
if [[ "$TLS" == "1" ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    echo "[gateway] certbot belum terpasang. Jalankan di VPS: apt-get install -y certbot python3-certbot-nginx" >&2
    exit 1
  fi
  $SUDO certbot --nginx -d "$DOMAIN"
fi
rm -f "/tmp/$NGINX_NAME.conf"
REMOTE

info "Gateway selesai. Cek: https://$DOMAIN/api/health"
