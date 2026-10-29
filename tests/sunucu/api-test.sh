#!/usr/bin/env bash
# API testlerini sunucuda, geçici ve AĞSIZ bir yığında çalıştırır.
#   Kullanım: api-test.sh <açılmış-kaynak-dizini> [vitest argümanları...]
#
# Güvence:
#  - Yığın `--internal` bir ağda: dış ağa ve sirket-proxy'ye bağlı değil, port yayınlamaz.
#  - Postgres 17 + Redis 7.4 yalnız bu koşuya ait, veri tmpfs'te (diske yazılmaz).
#  - Canlı beautyos-postgres/redis'e hiç bağlanılmaz; adlar koşuya özeldir (bostest-<pid>).
#  - Çıkışta (hata dahil) konteynerler, ağ ve test imajı silinir. Yalnız bostest-* kaynağına dokunur.
#  - Parola ve JWT sırrı her koşuda rastgele üretilir, dosyaya yazılmaz.
set -euo pipefail

SRC="${1:?kaynak dizini gerekli}"
shift || true
RUN="bostest-$$"
NET="${RUN}-net"
IMG="bostest-api:$$"

MIN_AVAIL_MB=600
avail_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
# Canlı siteyle ortak sunucu: derleme sürüyorsa ya da bellek azsa koşma; koşu sırasında 600 MB altına inerse yığını sil.
if pgrep -f 'derle[.]sh' >/dev/null 2>&1 || [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then
  echo "derle.sh calisiyor ya da bellek az, API testi kosulmadi" >&2
  exit 3
fi
MAIN_PID=$$
(
  while :; do
    if [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then
      echo "BEKCI: kullanilabilir bellek $(avail_mb) MB < ${MIN_AVAIL_MB}, yigin siliniyor" >&2
      docker rm -f "bostest-${MAIN_PID}-pg" "bostest-${MAIN_PID}-redis" "bostest-${MAIN_PID}-api" >/dev/null 2>&1 || true
      kill -TERM "$MAIN_PID" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 2
  done
) &
WATCH_PID=$!

cleanup() {
  kill "$WATCH_PID" >/dev/null 2>&1 || true
  docker rm -f "${RUN}-pg" "${RUN}-redis" "${RUN}-api" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  docker rmi "$IMG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

PGPASS="$(openssl rand -hex 16)"
JWT="$(openssl rand -hex 24)"

docker build -q --memory 1g --memory-swap 1g -f "$SRC/tests/sunucu/Dockerfile.api-test" -t "$IMG" "$SRC" >/dev/null

docker network create --internal "$NET" >/dev/null
docker run -d --name "${RUN}-pg" --network "$NET" --network-alias postgres \
  --memory 384m --memory-swap 384m --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=beautyos_test \
  postgres:17-bookworm -c fsync=off -c synchronous_commit=off -c max_connections=100 >/dev/null
docker run -d --name "${RUN}-redis" --network "$NET" --network-alias redis \
  --memory 64m --memory-swap 64m --tmpfs /data \
  redis:7.4-alpine redis-server --save "" --appendonly no >/dev/null

docker run --rm --name "${RUN}-api" --network "$NET" --memory 768m --memory-swap 768m \
  -e TZ=UTC -e NODE_ENV=test \
  -e DATABASE_URL="postgresql://postgres:${PGPASS}@postgres:5432/beautyos_test" \
  -e DIRECT_URL="postgresql://postgres:${PGPASS}@postgres:5432/beautyos_test" \
  -e REDIS_URL="redis://redis:6379" \
  -e JWT_SECRET="$JWT" \
  "$IMG" sh -c 'node /opt/bekle.cjs postgres:5432 redis:6379 \
    && node_modules/.bin/prisma migrate deploy >/dev/null \
    && npx --no-install vitest run "$@"' sh "$@"
