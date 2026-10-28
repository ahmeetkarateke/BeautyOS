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

cleanup() {
  docker rm -f "${RUN}-pg" "${RUN}-redis" "${RUN}-api" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  docker rmi "$IMG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

PGPASS="$(openssl rand -hex 16)"
JWT="$(openssl rand -hex 24)"

docker build -q -f "$SRC/tests/sunucu/Dockerfile.api-test" -t "$IMG" "$SRC" >/dev/null

docker network create --internal "$NET" >/dev/null
docker run -d --name "${RUN}-pg" --network "$NET" --network-alias postgres \
  --memory 512m --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=beautyos_test \
  postgres:17-bookworm -c fsync=off -c synchronous_commit=off -c max_connections=100 >/dev/null
docker run -d --name "${RUN}-redis" --network "$NET" --network-alias redis \
  --memory 128m --tmpfs /data \
  redis:7.4-alpine redis-server --save "" --appendonly no >/dev/null

docker run --rm --name "${RUN}-api" --network "$NET" --memory 1g \
  -e TZ=UTC -e NODE_ENV=test \
  -e DATABASE_URL="postgresql://postgres:${PGPASS}@postgres:5432/beautyos_test" \
  -e DIRECT_URL="postgresql://postgres:${PGPASS}@postgres:5432/beautyos_test" \
  -e REDIS_URL="redis://redis:6379" \
  -e JWT_SECRET="$JWT" \
  "$IMG" sh -c 'node /opt/bekle.cjs postgres:5432 redis:6379 \
    && node_modules/.bin/prisma migrate deploy >/dev/null \
    && npx --no-install vitest run "$@"' sh "$@"
