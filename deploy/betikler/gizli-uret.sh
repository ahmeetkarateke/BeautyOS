#!/usr/bin/env bash
# BeautyOS sunucu gizli dosyalarını TEK komutla üretir. Kullanım:
#   gizli-uret.sh <BEAUTYOS_VERSION> <BEAUTYOS_STAGING_VERSION>      (ikisi de 12 haneli commit kimliği, ör. 5c3d8b316e8f)
# /srv/beautyos altında .env.db .env.redis .env.migrate .env.migrate-staging .env .env.staging dosyalarını yazar
# (parolalar `openssl rand -hex 32`, yalnız hex; bağlantı adresleri aynı parolalarla tutarlı) ve staging basic auth için
# /srv/caddy/.env dosyasına BEAUTYOS_STAGING_BASIC_USER / BEAUTYOS_STAGING_BASIC_HASH satırlarını ekler.
# Güvenlik: dosyalardan biri bile varsa HİÇBİRİ yazılmaz (zorla seçeneği yoktur); dosyalar 600 ve çalıştıran kullanıcıya aittir;
# değerler ekrana, günlüğe ve komut satırına (ps) düşmez. Ekrana yalnız staging basic auth parolası BİR KEZ yazılır.
# Dış servis anahtarları (TELEGRAM_*, RESEND, GEMINI, NETGSM, SENTRY, TURNSTILE) boş bırakılır; kurucu gerekirse sonradan doldurur.
# Ortam (yalnız test için): PREFIX (dizinlerin önüne eklenir), CADDY_HASH_KOMUT (varsayılan: docker exec -i caddy caddy hash-password).
set -euo pipefail
export LC_ALL=C

PREFIX="${PREFIX:-}"
BASE="$PREFIX/srv/beautyos"
CADDY_ENV="$PREFIX/srv/caddy/.env"
BASIC_USER=beautyos
DOSYALAR=(.env.db .env.redis .env.migrate .env.migrate-staging .env .env.staging)

hata() { echo "HATA: $*" >&2; }

if [ $# -ne 2 ] || ! [[ "$1" =~ ^[0-9a-f]{12}$ ]] || ! [[ "$2" =~ ^[0-9a-f]{12}$ ]]; then
  echo "Kullanım: gizli-uret.sh <BEAUTYOS_VERSION> <BEAUTYOS_STAGING_VERSION>   (12 haneli küçük harfli onaltılık commit kimlikleri)" >&2
  exit 2
fi
SURUM_CANLI="$1"
SURUM_STAGING="$2"

# ─── Ön denetimler: hiçbir şey yazılmadan önce ──────────────────────────────────────
if [ "$(id -un)" != "karateke" ] && [ -z "$PREFIX" ]; then
  hata "bu betik 'karateke' kullanıcısıyla çalıştırılmalı (dosya sahibi karateke olacak)"
  exit 1
fi
[ -d "$BASE" ] || { hata "$BASE yok"; exit 1; }
for f in "${DOSYALAR[@]}"; do
  if [ -e "$BASE/$f" ]; then
    hata "$BASE/$f zaten var; hiçbir dosya yazılmadı (üzerine yazma seçeneği yoktur)"
    exit 1
  fi
done
[ -f "$CADDY_ENV" ] || { hata "$CADDY_ENV yok (ortak Caddy kurulu olmalı); hiçbir dosya yazılmadı"; exit 1; }
if grep -qE '^(BEAUTYOS_STAGING_BASIC_USER|BEAUTYOS_STAGING_BASIC_HASH)=' "$CADDY_ENV"; then
  hata "$CADDY_ENV içinde BEAUTYOS_STAGING_BASIC_* zaten var; hiçbir dosya yazılmadı"
  exit 1
fi

# ─── Parolalar (yalnız bellekte; komut satırına verilmez) ────────────────────────────
uret() { openssl rand -hex 32; }
DB_ROOT="$(uret)"; REDIS="$(uret)"
OWNER="$(uret)"; UYG="$(uret)"; STG_OWNER="$(uret)"; STG_UYG="$(uret)"
JWT="$(uret)"; JWT_STG="$(uret)"; SEED="$(uret)"; SEED_STG="$(uret)"
BASIC_PAROLA="$(openssl rand -hex 16)"

# Basic auth özeti: parola stdin'den verilir (argümanda ya da ps'te görünmez). Dosyalar yazılmadan ÖNCE alınır; başarısızsa hiçbir şey yazılmaz.
HASH_KOMUT="${CADDY_HASH_KOMUT:-docker exec -i caddy caddy hash-password}"
# shellcheck disable=SC2086
HASH="$($HASH_KOMUT <<<"$BASIC_PAROLA" 2>/dev/null | tail -n 1)" || true
if ! [[ "$HASH" =~ ^\$2[aby]\$[0-9]+\$.{53}$ ]]; then
  hata "Caddy parola özeti alınamadı (caddy konteyneri çalışıyor mu? komut: docker exec -i caddy caddy hash-password); hiçbir dosya yazılmadı"
  exit 1
fi

# ─── Yazma: noclobber ile (var olan dosyanın üzerine asla yazılmaz), umask 077 ───────
umask 077
yaz() { # dosya  (içerik stdin'den)
  ( set -C; cat >"$BASE/$1" )
}
yaz .env.db <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$DB_ROOT
POSTGRES_DB=beautyos
APP_OWNER_PASSWORD=$OWNER
APP_USER_PASSWORD=$UYG
STG_OWNER_PASSWORD=$STG_OWNER
STG_USER_PASSWORD=$STG_UYG
EOF
yaz .env.redis <<EOF
REDIS_PASSWORD=$REDIS
EOF
yaz .env.migrate <<EOF
MIGRATION_DATABASE_URL=postgresql://app_owner:$OWNER@postgres:5432/beautyos
EOF
yaz .env.migrate-staging <<EOF
MIGRATION_DATABASE_URL=postgresql://stg_owner:$STG_OWNER@postgres:5432/beautyos_staging
EOF
yaz .env <<EOF
BEAUTYOS_VERSION=$SURUM_CANLI
BEAUTYOS_STAGING_VERSION=$SURUM_STAGING
BEAUTYOS_PREVIOUS_VERSION=
IMAGE_PREFIX=
LOG_LEVEL=info
PUBLIC_URL=
FRONTEND_URL=https://app.beautyossapp.com
ALLOWED_ORIGINS=https://beautyossapp.com,https://app.beautyossapp.com,https://www.beautyossapp.com
DATABASE_URL=postgresql://app_user:$UYG@postgres:5432/beautyos
DIRECT_URL=postgresql://app_user:$UYG@postgres:5432/beautyos
REDIS_URL=redis://:$REDIS@redis:6379/0
JWT_SECRET=$JWT
ADMIN_SEED_SECRET=$SEED
TURNSTILE_SECRET_KEY=
SENTRY_DSN=
RESEND_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_SECRET_TOKEN=
TELEGRAM_TENANT_ID=
GEMINI_API_KEY=
NETGSM_USERCODE=
NETGSM_PASSWORD=
NETGSM_HEADER=
SMS_COST_PER_PART=
WHATSAPP_360DIALOG_API_KEY=
WHATSAPP_SANDBOX=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
EOF
yaz .env.staging <<EOF
LOG_LEVEL=info
PUBLIC_URL=
FRONTEND_URL=https://yeni.beautyossapp.com
ALLOWED_ORIGINS=https://yeni.beautyossapp.com
DATABASE_URL=postgresql://stg_user:$STG_UYG@postgres:5432/beautyos_staging
DIRECT_URL=postgresql://stg_user:$STG_UYG@postgres:5432/beautyos_staging
REDIS_URL=redis://:$REDIS@redis:6379/1
JWT_SECRET=$JWT_STG
ADMIN_SEED_SECRET=$SEED_STG
TURNSTILE_SECRET_KEY=
SENTRY_DSN=
RESEND_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_SECRET_TOKEN=
TELEGRAM_TENANT_ID=
GEMINI_API_KEY=
NETGSM_USERCODE=
NETGSM_PASSWORD=
NETGSM_HEADER=
SMS_COST_PER_PART=
WHATSAPP_360DIALOG_API_KEY=
WHATSAPP_SANDBOX=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
EOF

# Caddy: dosya satır sonuyla bitmiyorsa önce yeni satır; değerler tek tırnakta ($ karakterleri için).
if [ -s "$CADDY_ENV" ] && [ "$(tail -c 1 "$CADDY_ENV" | od -An -tx1 | tr -d ' ')" != "0a" ]; then
  printf '\n' >>"$CADDY_ENV"
fi
printf "BEAUTYOS_STAGING_BASIC_USER='%s'\nBEAUTYOS_STAGING_BASIC_HASH='%s'\n" "$BASIC_USER" "$HASH" >>"$CADDY_ENV"

# ─── Bitiş: yalnız dosya adları, izinler ve dolu/boş listesi (değer yok) ─────────────
echo "── Oluşturulan dosyalar ──"
for f in "${DOSYALAR[@]}"; do
  printf '%s  %s %s\n' "$BASE/$f" "$(stat -c '%a' "$BASE/$f")" "$(stat -c '%U' "$BASE/$f")"
  while IFS='=' read -r ad deger; do
    [ -n "$ad" ] || continue
    if [ -n "$deger" ]; then durum=dolu; else durum=boş; fi
    printf '    %-34s %s\n' "$ad" "$durum"
  done <"$BASE/$f"
done
echo "── Ortak Caddy ($CADDY_ENV, eklenen satırlar) ──"
printf '    %-34s dolu\n    %-34s dolu\n' BEAUTYOS_STAGING_BASIC_USER BEAUTYOS_STAGING_BASIC_HASH
echo
echo "STAGING BASIC AUTH (yeni.beautyossapp.com) — BİR KEZ gösterilir, parola yöneticisine kaydedin:"
echo "  kullanıcı: $BASIC_USER"
echo "  parola   : $BASIC_PAROLA"
