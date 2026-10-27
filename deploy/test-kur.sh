#!/usr/bin/env bash
# Sunucuda DIŞA KAPALI test ortamı için SAHTE/geçici değer dosyalarını üretir (boş veritabanı, güvenli kip).
# Gerçek anahtar yoktur: Telegram, SMS, e-posta, Gemini, WhatsApp boş bırakılır; parolalar rastgele üretilir.
# Kullanım (deploy/ klasöründe):  bash test-kur.sh
# Mevcut dosyaların üzerine yazmaz; yeniden üretmek için önce silinmelidir.
set -euo pipefail

cd "$(dirname "$0")"

for f in .env .env.db .env.redis .env.migrate; do
  if [ -e "$f" ]; then
    echo "HATA: $f zaten var; üzerine yazılmadı." >&2
    exit 1
  fi
done

umask 077
db_pass=$(openssl rand -hex 16)
redis_pass=$(openssl rand -hex 16)
jwt=$(openssl rand -hex 32)
db_url="postgresql://beautyos_test:${db_pass}@postgres:5432/beautyos_test"

cat > .env.db <<EOF
POSTGRES_USER=beautyos_test
POSTGRES_PASSWORD=${db_pass}
POSTGRES_DB=beautyos_test
EOF

echo "REDIS_PASSWORD=${redis_pass}" > .env.redis
echo "MIGRATION_DATABASE_URL=${db_url}" > .env.migrate

cat > .env <<EOF
BEAUTYOS_VERSION=test
NEXT_PUBLIC_API_URL=https://api.test.invalid
NEXT_PUBLIC_BOT_FEATURES_ENABLED=false
PROXY_NETWORK=beautyos-test-proxy
LOG_LEVEL=info
PUBLIC_URL=
FRONTEND_URL=https://yeni.test.invalid
ALLOWED_ORIGINS=https://yeni.test.invalid
DATABASE_URL=${db_url}
REDIS_URL=redis://:${redis_pass}@redis:6379
JWT_SECRET=${jwt}
EOF

echo "Test değer dosyaları üretildi (güvenli kip: dış servis anahtarları boş)."
