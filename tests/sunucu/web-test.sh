#!/usr/bin/env bash
# Web birim/bileşen testlerini (Vitest + jsdom) sunucuda, ağsız ve bellek sınırlı bir konteynerde çalıştırır.
#   Kullanım: web-test.sh <açılmış-kaynak-dizini> [vitest argümanları...]
# Veritabanı ya da ağ gerekmez; konteyner `--network none` ile çalışır. Çıkışta imaj silinir.
set -euo pipefail

SRC="${1:?kaynak dizini gerekli}"
shift || true
RUN="bostest-web-$$"
IMG="bostest-webunit:$$"
MIN_AVAIL_MB=600
avail_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }

# Canlı siteyle ortak sunucu: derleme sürüyorsa ya da bellek azsa koşma; koşu sırasında eşiğin altına inerse konteyneri sil.
if pgrep -f 'derle[.]sh' >/dev/null 2>&1 || [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then
  echo "derle.sh calisiyor ya da bellek az, web testi kosulmadi" >&2
  exit 3
fi
MAIN_PID=$$
(
  while :; do
    if [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then
      echo "BEKCI: kullanilabilir bellek $(avail_mb) MB < ${MIN_AVAIL_MB}, konteyner siliniyor" >&2
      docker rm -f "$RUN" >/dev/null 2>&1 || true
      kill -TERM "$MAIN_PID" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 2
  done
) &
WATCH_PID=$!
cleanup() {
  kill "$WATCH_PID" >/dev/null 2>&1 || true
  docker rm -f "$RUN" >/dev/null 2>&1 || true
  docker rmi "$IMG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -q --memory 1g --memory-swap 1g -f "$SRC/tests/sunucu/Dockerfile.web-test" -t "$IMG" "$SRC" >/dev/null
docker run --rm --name "$RUN" --network none --memory 1g --memory-swap 1g -e TZ=UTC -e CI=1 \
  "$IMG" npx --no-install vitest run "$@"
