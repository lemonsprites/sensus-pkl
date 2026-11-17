#!/usr/bin/env bash
# Pasang konfigurasi Nginx sensus-pkl di VM101 (sekali saja).
# Membutuhkan sudo interaktif untuk menulis /etc/nginx dan reload.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG:-$ROOT/scripts/deploy-vm101.env}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

SSH_HOST="${SSH_HOST:-vm101}"
DOMAIN="${DOMAIN:-sensus.matsanesacis.sch.id}"
APP_PORT="${APP_PORT:-3100}"
NGINX_NAME="${NGINX_NAME:-sensus}"
TLS=0
DRY_RUN="${DRY_RUN:-0}"

die() { printf '\n\033[1;31m[nginx] GAGAL:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\n\033[1;36m[nginx]\033[0m %s\n' "$*"; }

usage() {
  cat <<EOF
Pemakaian: bash scripts/setup-nginx-vm101.sh [opsi]

Opsi:
  --tls       Setelah memasang config, jalankan certbot --nginx untuk domain
  --dry-run   Tampilkan konfigurasi tanpa mengubah remote
  --help      Bantuan

Target: $SSH_HOST, domain $DOMAIN, proxy 127.0.0.1:$APP_PORT
File: /etc/nginx/sites-available/$NGINX_NAME.conf
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tls) TLS=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Opsi tidak dikenal: $1" ;;
  esac
  shift
done

for command in ssh scp sed; do
  command -v "$command" >/dev/null 2>&1 || die "Perintah '$command' tidak ditemukan."
done
[[ -f "$ROOT/deploy/nginx-sensus.conf.example" ]] || die "Template Nginx tidak ditemukan."

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT
sed -e "s/sensus\\.matsanesacis\\.sch\\.id/$DOMAIN/g" \
    -e "s/127\\.0\\.0\\.1:3100/127.0.0.1:$APP_PORT/g" \
    "$ROOT/deploy/nginx-sensus.conf.example" > "$TMP_FILE"

info "Target: $SSH_HOST, domain $DOMAIN, proxy 127.0.0.1:$APP_PORT"
info "Konfigurasi: /etc/nginx/sites-available/$NGINX_NAME.conf"
if [[ "$DRY_RUN" == "1" ]]; then
  cat "$TMP_FILE"
  info "Dry-run selesai; tidak ada perubahan remote."
  exit 0
fi

scp "$TMP_FILE" "$SSH_HOST:/tmp/$NGINX_NAME.conf"

info "Memasang config dan reload Nginx (sudo akan meminta password)..."
ssh -t "$SSH_HOST" \
  "env NGINX_NAME=$(printf '%q' "$NGINX_NAME") DOMAIN=$(printf '%q' "$DOMAIN") TLS=$(printf '%q' "$TLS") bash -s" <<'REMOTE'
set -Eeuo pipefail
sudo install -m 0644 "/tmp/$NGINX_NAME.conf" "/etc/nginx/sites-available/$NGINX_NAME.conf"
sudo ln -sfn "/etc/nginx/sites-available/$NGINX_NAME.conf" "/etc/nginx/sites-enabled/$NGINX_NAME.conf"
sudo nginx -t
sudo systemctl reload nginx
if [[ "$TLS" == "1" ]]; then
  sudo certbot --nginx -d "$DOMAIN"
fi
rm -f "/tmp/$NGINX_NAME.conf"
REMOTE

info "Nginx selesai. Cek: https://$DOMAIN/api/health"
