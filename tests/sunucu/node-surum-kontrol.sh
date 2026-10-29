#!/usr/bin/env bash
# S9: tum Node taban imajlari ve CI ayni Node 22 hattinda, sabit etiketli olmali (ADR-0024).
# Depo kokunden calistirilir: bash tests/sunucu/node-surum-kontrol.sh
set -euo pipefail

hata=0
bul='^[[:space:]]*FROM[[:space:]]+(--platform=[^[:space:]]+[[:space:]]+)?node[:@]'
beklenen='^[[:space:]]*FROM[[:space:]]+(--platform=[^[:space:]]+[[:space:]]+)?node:22[.][0-9]+[.][0-9]+-bookworm-slim([[:space:]]+AS[[:space:]]+[A-Za-z0-9_-]+)?[[:space:]]*$'

for dosya in apps/api/Dockerfile apps/web/Dockerfile tests/sunucu/Dockerfile.api-test tests/sunucu/Dockerfile.web-test; do
  if [ ! -f "$dosya" ]; then
    echo "EKSIK: $dosya"; hata=1; continue
  fi
  satirlar=$(grep -Ei "$bul" "$dosya" || true)
  if [ -z "$satirlar" ]; then
    echo "HATA: $dosya icinde node tabanli FROM yok"; hata=1; continue
  fi
  while IFS= read -r satir; do
    if ! printf '%s\n' "$satir" | grep -Eiq "$beklenen"; then
      echo "HATA: $dosya -> $satir (node:22.x.y-bookworm-slim bekleniyor)"; hata=1
    fi
  done <<< "$satirlar"
done

surumler=$(grep -E "node-version:" .github/workflows/ci.yml | sed -E "s/.*node-version:[[:space:]]*'?([0-9]+).*/\1/")
if [ -z "$surumler" ]; then
  echo "HATA: ci.yml icinde node-version yok"; hata=1
elif [ "$(printf '%s\n' "$surumler" | sort -u)" != "22" ]; then
  echo "HATA: ci.yml node-version degerleri 22 degil: $(printf '%s ' $surumler)"; hata=1
fi

if ! grep -Eq '"node": ">=22\.0\.0"' package.json; then
  echo "HATA: package.json engines.node >=22.0.0 degil"; hata=1
fi

[ "$hata" -eq 0 ] && echo "Node surum kontrolu: tamam (22 hatti)"
exit "$hata"
