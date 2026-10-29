#!/usr/bin/env bash
# E2E testlerini sunucuda, geçici ve AĞSIZ bir yığında çalıştırır.
#   Kullanım: e2e-test.sh <açılmış-kaynak-dizini> <çıktı-dizini> [playwright argümanları...]
# Kaynak dizini: test edilecek dalın ağacı + tests/sunucu + apps/web/e2e + playwright.config.ts.
#
# Güvence (api-test.sh ile aynı): `--internal` ağ, port yayını yok, canlı Postgres/Redis'e ve
# sirket-proxy'ye bağlantı yok, veri tmpfs'te, çıkışta her şey silinir.
# Canlı yığını korumak için: derlemeler bellek sınırlıdır; vmstat tepe bellek/takas değerini kaydeder.
# Turnstile: derlemeye site anahtarı verilmez, API'de TURNSTILE_SECRET_KEY yoktur (test ortamı).
set -euo pipefail

SRC="${1:?kaynak dizini gerekli}"
OUT="${2:?çıktı dizini gerekli}"
shift 2 || true
# Çıktı dizini root olarak chown -R edilir: yalnız /tmp altındaki gerçek (symlink çözülmüş) bir alt dizine izin ver.
# Doğrulama önce: realpath -m dizini oluşturmadan sembolik bağlantıları çözer; mkdir yalnız kabulden sonra.
OUT="$(realpath -m "$OUT")"
case "$OUT" in
  /tmp/?*) ;;
  *) echo "çıktı dizini /tmp altında olmalı (gerçek yol: $OUT)" >&2; exit 2 ;;
esac
mkdir -p "$OUT"
RUN="bostest-e2e-$$"
NET="${RUN}-net"
API_IMG="bostest-api:$$"
WEB_IMG="bostest-web:$$"
E2E_IMG="bostest-e2e:$$"
MIN_AVAIL_MB=600

avail_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }

# Canlı siteyle ortak sunucu: derleme sürüyorsa ya da bellek zaten azsa koşma.
if pgrep -f 'derle[.]sh' >/dev/null 2>&1; then
  echo "derle.sh calisiyor, E2E kosulmadi" >&2
  exit 3
fi
if [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then
  echo "kullanilabilir bellek $(avail_mb) MB < ${MIN_AVAIL_MB}, E2E kosulmadi" >&2
  exit 3
fi

cleanup() {
  [ -n "${WATCH_PID:-}" ] && kill "$WATCH_PID" >/dev/null 2>&1 || true
  # Konteyner root olarak yazar; çıktının sahibi çağıran kullanıcıya geçirilir (sonraki koşuda silinebilsin).
  docker run --rm -v "$OUT:/out" --entrypoint chown "$E2E_IMG" -R "$(id -u):$(id -g)" /out >/dev/null 2>&1 || true
  [ -n "${VMSTAT_PID:-}" ] && kill "$VMSTAT_PID" >/dev/null 2>&1 || true
  docker rm -f "${RUN}-pg" "${RUN}-redis" "${RUN}-api" "${RUN}-web" "${RUN}-e2e" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  [ -n "${WEBSRC:-}" ] && rm -rf "$WEBSRC" || true
  docker rmi "$API_IMG" "$WEB_IMG" "$E2E_IMG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Bellek kaydı: 2 sn aralıkla, MB. Sütunlar: free(4) si(7) so(8) ...
vmstat -n -S M 2 > "$OUT/vmstat.txt" &
VMSTAT_PID=$!

# Bekçi: kullanılabilir bellek eşiğin altına inerse yığını siler ve koşuyu durdurur.
# Her ölçüm (MB) bellek-min.txt'e yazılır; tepe değer buradan raporlanır.
MAIN_PID=$$
(
  while :; do
    A="$(avail_mb)"
    echo "$A" >> "$OUT/bellek-min.txt"
    if [ "$A" -lt "$MIN_AVAIL_MB" ]; then
      echo "BEKCI: kullanilabilir bellek ${A} MB < ${MIN_AVAIL_MB}, yigin siliniyor" > "$OUT/bekci-durdurdu.txt"
      docker rm -f "${RUN}-pg" "${RUN}-redis" "${RUN}-api" "${RUN}-web" "${RUN}-e2e" >/dev/null 2>&1 || true
      kill -TERM "$MAIN_PID" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 2
  done
) &
WATCH_PID=$!

PGPASS="$(openssl rand -hex 16)"
JWT="$(openssl rand -hex 24)"

docker build -q --memory 1g --memory-swap 1g -f "$SRC/tests/sunucu/Dockerfile.api-test" -t "$API_IMG" "$SRC" >/dev/null
# Web imajı, test dosyaları çıkarılmış bir kopyadan derlenir: canlıdaki imaj da testsiz derlenir ve
# `next build` e2e/ dosyalarını (Playwright bağımlılığı) tip denetimine sokmamalıdır.
WEBSRC="$(mktemp -d /tmp/bostest-websrc.XXXXXX)"
tar -C "$SRC" --exclude=./apps/web/e2e --exclude=./apps/web/playwright.config.ts \
  --exclude='./apps/web/vitest.*' -cf - . | tar -C "$WEBSRC" -xf -
# Vitrin bayrağı (NEXT_PUBLIC_UI_V2_SHOWCASE) web Dockerfile'ında build arg değildir; yalnız test kopyasında ENV olarak verilir,
# uygulama dosyalarına dokunulmaz. Değer yalnız "1" olabilir.
if [ "${E2E_UI_V2_SHOWCASE:-}" = "1" ]; then
  sed -i 's|^RUN npm run build --workspace=apps/web|ENV NEXT_PUBLIC_UI_V2_SHOWCASE=1\n&|' "$WEBSRC/apps/web/Dockerfile"
  grep -q '^ENV NEXT_PUBLIC_UI_V2_SHOWCASE=1' "$WEBSRC/apps/web/Dockerfile" || { echo "vitrin bayrağı Dockerfile'a eklenemedi" >&2; exit 4; }
fi
docker build -q --memory 1536m --memory-swap 1536m -f "$WEBSRC/apps/web/Dockerfile" \
  --build-arg NEXT_PUBLIC_API_URL=http://bostest-api:3001 --build-arg NEXT_PUBLIC_UI_V2="${E2E_UI_V2:-}" --build-arg NODE_HEAP_MB=1280 \
  -t "$WEB_IMG" "$WEBSRC" >/dev/null
rm -rf "$WEBSRC"
docker build -q --memory 512m --memory-swap 512m -f "$SRC/tests/sunucu/Dockerfile.e2e" -t "$E2E_IMG" "$SRC" >/dev/null

docker network create --internal "$NET" >/dev/null
docker run -d --name "${RUN}-pg" --network "$NET" --network-alias postgres \
  --memory 256m --memory-swap 256m --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=beautyos_test \
  postgres:17-bookworm -c fsync=off -c synchronous_commit=off >/dev/null
docker run -d --name "${RUN}-redis" --network "$NET" --network-alias redis \
  --memory 64m --memory-swap 64m --tmpfs /data \
  redis:7.4-alpine redis-server --save "" --appendonly no >/dev/null

DBURL="postgresql://postgres:${PGPASS}@postgres:5432/beautyos_test"
docker run -d --name "${RUN}-api" --network "$NET" --network-alias bostest-api --memory 384m --memory-swap 384m \
  -e TZ=UTC -e NODE_ENV=test -e PORT=3001 \
  -e DATABASE_URL="$DBURL" -e DIRECT_URL="$DBURL" -e REDIS_URL="redis://redis:6379" \
  -e JWT_SECRET="$JWT" -e CORS_ORIGIN="http://web:3000" -e ALLOWED_ORIGINS="http://web:3000" \
  "$API_IMG" sh -c 'node /opt/bekle.cjs postgres:5432 redis:6379 \
    && node_modules/.bin/prisma migrate deploy >/dev/null \
    && exec npx --no-install tsx src/index.ts' >/dev/null
docker run -d --name "${RUN}-web" --network "$NET" --network-alias web --memory 320m --memory-swap 320m \
  "$WEB_IMG" >/dev/null

docker run --rm --name "${RUN}-e2e" --network "$NET" --memory 512m --memory-swap 512m --shm-size=256m \
  -v "$OUT:/out" -v "$SRC/tests/sunucu/bekle.cjs:/opt/bekle.cjs:ro" \
  -e E2E_UI_V2="${E2E_UI_V2:-}" -e E2E_UI_V2_SHOWCASE="${E2E_UI_V2_SHOWCASE:-}" -e E2E_BASE_URL=http://web:3000 -e E2E_API_URL=http://bostest-api:3001 \
  -e E2E_OUT_DIR=/out/cikti -e E2E_SHOT_DIR=/out/ekran -e DEMO_SEED_PASSWORD="$(openssl rand -hex 12)" -e DEMO_SEED_GUN=1 \
  "$E2E_IMG" sh -c 'node /opt/bekle.cjs bostest-api:3001 web:3000 \
    && node e2e/seed/defne.mjs && node e2e/seed/defne.mjs \
    && npx playwright test "$@"' sh "$@"
