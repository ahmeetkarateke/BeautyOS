#!/usr/bin/env bash
# Sunucuda DIŞA KAPALI test ortamı için SAHTE/geçici değer dosyalarını üretir (boş veritabanı, güvenli kip).
# Gerçek anahtar yoktur: Telegram, SMS, e-posta, Gemini, WhatsApp, Sentry boş bırakılır; parolalar rastgele üretilir.
# Kullanım (deploy/ klasöründe):  bash test-kur.sh
# Mevcut dosyaların üzerine yazmaz; yeniden üretmek için önce silinmelidir.
set -euo pipefail

cd "$(dirname "$0")"

for f in .env .env.staging .env.db .env.redis .env.migrate .env.migrate-staging; do
  if [ -e "$f" ]; then
    echo "HATA: $f zaten var; üzerine yazılmadı." >&2
    exit 1
  fi
done

umask 077
rastgele() { openssl rand -hex 16; }
owner_pw=$(rastgele); user_pw=$(rastgele); stg_owner_pw=$(rastgele); stg_user_pw=$(rastgele)
db_pw=$(rastgele); redis_pw=$(rastgele)

cat > .env.db <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${db_pw}
POSTGRES_DB=beautyos
APP_OWNER_PASSWORD=${owner_pw}
APP_USER_PASSWORD=${user_pw}
STG_OWNER_PASSWORD=${stg_owner_pw}
STG_USER_PASSWORD=${stg_user_pw}
EOF

echo "REDIS_PASSWORD=${redis_pw}" > .env.redis
echo "MIGRATION_DATABASE_URL=postgresql://app_owner:${owner_pw}@postgres:5432/beautyos" > .env.migrate
echo "MIGRATION_DATABASE_URL=postgresql://stg_owner:${stg_owner_pw}@postgres:5432/beautyos_staging" > .env.migrate-staging

cat > .env <<EOF
BEAUTYOS_VERSION=test
NEXT_PUBLIC_API_URL_PROD=https://api.test.invalid
NEXT_PUBLIC_API_URL_STAGING=https://yeni-api.test.invalid
PROXY_NETWORK=beautyos-test-proxy
LOG_LEVEL=info
PUBLIC_URL=
FRONTEND_URL=https://app.test.invalid
ALLOWED_ORIGINS=https://app.test.invalid
DATABASE_URL=postgresql://app_user:${user_pw}@postgres:5432/beautyos
DIRECT_URL=postgresql://app_user:${user_pw}@postgres:5432/beautyos
REDIS_URL=redis://:${redis_pw}@redis:6379/0
JWT_SECRET=$(openssl rand -hex 32)
EOF

cat > .env.staging <<EOF
LOG_LEVEL=info
PUBLIC_URL=
FRONTEND_URL=https://yeni.test.invalid
ALLOWED_ORIGINS=https://yeni.test.invalid
DATABASE_URL=postgresql://stg_user:${stg_user_pw}@postgres:5432/beautyos_staging
DIRECT_URL=postgresql://stg_user:${stg_user_pw}@postgres:5432/beautyos_staging
REDIS_URL=redis://:${redis_pw}@redis:6379/1
JWT_SECRET=$(openssl rand -hex 32)
EOF

echo "Test değer dosyaları üretildi (güvenli kip: dış servis anahtarları boş)."
