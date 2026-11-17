#!/usr/bin/env bash
# Deploy lokal sensus-pkl ke VM101 melalui rsync + SSH.
# Tidak memakai Git remote/CI. Rahasia .env tidak dikirim kecuali SYNC_ENV=1.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG:-$ROOT/scripts/deploy-vm101.env}"

info() { printf '\n\033[1;36m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[deploy]\033[0m %s\n' "$*" >&2; }
die() { printf '\n\033[1;31m[deploy] GAGAL:\033[0m %s\n' "$*" >&2; exit 1; }
quote() { printf '%q' "$1"; }

trap 'die "Perintah gagal pada baris $LINENO."' ERR

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

# Default dapat dioverride lewat scripts/deploy-vm101.env atau environment.
SSH_HOST="${SSH_HOST:-vm101}"
REMOTE_DIR="${REMOTE_DIR:-/home/matsa/sensus-pkl}"
PM2_NAME="${PM2_NAME:-sensus-pkl}"
APP_PORT="${APP_PORT:-3000}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-$REMOTE_DIR/.env}"
DOMAIN="${DOMAIN:-sensus.matsanesacis.sch.id}"

DRY_RUN="${DRY_RUN:-0}"
CONFIRM="${CONFIRM:-1}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
SYNC_ENV="${SYNC_ENV:-0}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"
SKIP_RESTART="${SKIP_RESTART:-0}"

usage() {
  cat <<EOF
Pemakaian: npm run deploy:vm101 -- [opsi]
       atau: bash scripts/deploy-vm101.sh [opsi]

Opsi:
  --dry-run       Tampilkan rencana tanpa mengubah remote
  --yes, -y       Lewati konfirmasi
  --sync-env      Unggah .env lokal ke remote (backup .env lama dulu)
  --allow-dirty   Izinkan file tracked yang belum di-commit
  --skip-install  Lewati npm ci di remote
  --skip-build    Lewati npm run build
  --skip-migrate  Lewati prisma migrate deploy
  --skip-restart  Jangan restart PM2 / health check
  --help          Tampilkan bantuan

Konfigurasi: salin scripts/deploy-vm101.env.example ke scripts/deploy-vm101.env.
Nilai saat ini: SSH_HOST=$SSH_HOST REMOTE_DIR=$REMOTE_DIR PM2_NAME=$PM2_NAME APP_PORT=$APP_PORT
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) CONFIRM=0 ;;
    --sync-env) SYNC_ENV=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-restart) SKIP_RESTART=1 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Opsi tidak dikenal: $1 (gunakan --help)" ;;
  esac
  shift
done

for command in ssh rsync git; do
  command -v "$command" >/dev/null 2>&1 || die "Perintah '$command' tidak ditemukan di lokal."
done
[[ -f "$ROOT/package.json" ]] || die "package.json tidak ditemukan di $ROOT."
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || die "APP_PORT harus angka: $APP_PORT"

if [[ "$ALLOW_DIRTY" != "1" ]] && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
    die "Ada perubahan tracked yang belum di-commit. Commit dulu atau gunakan --allow-dirty."
  fi
fi

info "Target: $SSH_HOST:$REMOTE_DIR (PM2 $PM2_NAME, port $APP_PORT)"
info "Domain contoh Nginx: $DOMAIN"
info "Commit lokal: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'non-git')"

if [[ "$CONFIRM" == "1" && "$DRY_RUN" != "1" ]]; then
  if [[ ! -t 0 ]]; then
    die "Konfirmasi membutuhkan terminal. Gunakan --yes untuk deploy non-interaktif."
  fi
  read -r -p "Lanjutkan deploy? [y/N] " reply
  [[ "$reply" =~ ^[yY]$ ]] || die "Deploy dibatalkan."
fi

info "Memeriksa koneksi SSH..."
ssh -o BatchMode=yes -o ConnectTimeout=15 "$SSH_HOST" true || die "SSH ke $SSH_HOST gagal."

if [[ "$DRY_RUN" != "1" ]]; then
  ssh -o BatchMode=yes "$SSH_HOST" \
    'command -v node >/dev/null && command -v npm >/dev/null && command -v pm2 >/dev/null && command -v curl >/dev/null' \
    || die "Remote harus memiliki node, npm, pm2, dan curl."
fi

if [[ "$DRY_RUN" != "1" ]]; then
  info "Menyiapkan direktori remote..."
  ssh -o BatchMode=yes "$SSH_HOST" "mkdir -p $(quote "$REMOTE_DIR")" \
    || die "Tidak bisa membuat $REMOTE_DIR. Jika di /var/www, buat sekali dengan sudo/chown."
fi

if [[ "$SYNC_ENV" == "1" ]]; then
  [[ -f "$ROOT/.env" ]] || die "SYNC_ENV=1 tetapi $ROOT/.env tidak ada."
  warn "Mengunggah .env lokal ke remote; backup .env remote dibuat lebih dulu."
  if [[ "$DRY_RUN" != "1" ]]; then
    ssh -o BatchMode=yes "$SSH_HOST" \
      "env REMOTE_ENV_FILE=$(quote "$REMOTE_ENV_FILE") bash -s" <<'REMOTE_ENV'
set -Eeuo pipefail
mkdir -p "$(dirname "$REMOTE_ENV_FILE")"
if [[ -f "$REMOTE_ENV_FILE" ]]; then
  cp "$REMOTE_ENV_FILE" "$REMOTE_ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
fi
REMOTE_ENV
    rsync -az "$ROOT/.env" "$SSH_HOST:$REMOTE_ENV_FILE"
  fi
fi

if [[ "$DRY_RUN" != "1" ]]; then
  ssh -o BatchMode=yes "$SSH_HOST" "test -f $(quote "$REMOTE_ENV_FILE")" \
    || die "Remote .env tidak ditemukan: $REMOTE_ENV_FILE. Siapkan dulu atau gunakan --sync-env."
else
  info "Dry-run: melewati pengecekan file remote."
fi

info "Sinkronisasi source lokal → remote..."
RSYNC_ARGS=(
  -az
  --delete
  --human-readable
  --itemize-changes
  --exclude=.git/
  --exclude=node_modules/
  --exclude=dist/
  --exclude=.env
  --exclude=.env.*
  --exclude=data/
  --exclude=tmp/
  --exclude=uploads/
  --exclude=coverage/
  --exclude=.cache/
  --exclude='*.log'
  --exclude=pnpm-lock.yaml
  --exclude=pnpm-workspace.yaml
  --exclude=scripts/deploy-vm101.env
)
if [[ "$DRY_RUN" == "1" ]]; then
  printf '\n[dry-run] rsync %s -e "ssh -o BatchMode=yes -o ConnectTimeout=15" %q %q\n' \
    "${RSYNC_ARGS[*]}" "$ROOT/" "$SSH_HOST:$REMOTE_DIR/"
else
  rsync "${RSYNC_ARGS[@]}" -e "ssh -o BatchMode=yes -o ConnectTimeout=15" \
    "$ROOT/" "$SSH_HOST:$REMOTE_DIR/"
fi

REMOTE_SCRIPT=$(cat <<'REMOTE'
set -Eeuo pipefail
cd "$REMOTE_DIR"

if [[ ! -f .env ]]; then
  echo "[deploy] .env tidak ditemukan di $REMOTE_DIR" >&2
  exit 1
fi

if [[ "$SKIP_INSTALL" != "1" ]]; then
  echo "[deploy] npm ci..."
  npm ci --include=dev
else
  echo "[deploy] npm ci dilewati."
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "[deploy] build web + api..."
  npm run build
else
  echo "[deploy] build dilewati."
fi

if [[ "$SKIP_MIGRATE" != "1" ]]; then
  echo "[deploy] prisma migrate deploy..."
  npm run prisma:deploy
else
  echo "[deploy] migration dilewati."
fi

if [[ "$SKIP_RESTART" != "1" ]]; then
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_NAME" --update-env
  else
    pm2 start dist/server/server.js --name "$PM2_NAME" --time
  fi
  pm2 save >/dev/null
  echo "[deploy] menunggu health check..."
  for attempt in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
      echo "[deploy] health OK (percobaan ${attempt})"
      exit 0
    fi
    sleep 2
  done
  echo "[deploy] health check GAGAL" >&2
  pm2 logs "$PM2_NAME" --lines 80 --nostream || true
  exit 1
fi

echo "[deploy] restart dan health check dilewati."
REMOTE
)

info "Menjalankan langkah remote..."
if [[ "$DRY_RUN" == "1" ]]; then
  printf '\n----- REMOTE SCRIPT (dry-run) -----\n%s\n----- END -----\n' "$REMOTE_SCRIPT"
else
  printf '%s\n' "$REMOTE_SCRIPT" | ssh -o BatchMode=yes "$SSH_HOST" \
    "env REMOTE_DIR=$(quote "$REMOTE_DIR") PM2_NAME=$(quote "$PM2_NAME") APP_PORT=$(quote "$APP_PORT") SKIP_INSTALL=$(quote "$SKIP_INSTALL") SKIP_BUILD=$(quote "$SKIP_BUILD") SKIP_MIGRATE=$(quote "$SKIP_MIGRATE") SKIP_RESTART=$(quote "$SKIP_RESTART") bash -s"
fi

info "Deploy selesai. Domain target: $DOMAIN"
info "Cek: curl -fsS http://127.0.0.1:$APP_PORT/api/health (dari VM), atau https://$DOMAIN/api/health"

