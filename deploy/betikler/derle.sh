#!/usr/bin/env bash
# BeautyOS imajlarını SUNUCUDA derler (ADR-0018). Kullanım:  derle.sh <commit-sha>
#   <commit-sha>: en az 12 haneli küçük harfli onaltılık commit kimliği. Dal adı, etiket ya da HEAD kabul edilmez (çıkış 2).
# Kaynak /srv/beautyos/kaynak deposundan gelir; bağlantı salt okunur deploy key takma adıyla yapılır (anahtar yolu burada yok).
# Üretilenler (hepsi org.opencontainers.image.revision=<tam sha> etiketli, latest yok):
#   beautyos-api:<sha12>   beautyos-web:<sha12>-prod   beautyos-web:<sha12>-staging
# Web değerleri yalnız derlenen commit'teki deploy/derleme.conf dosyasından gelir; .env* okunmaz.
# Yük: derlemeler sırayla çalışır, flock ile aynı anda tek derleme; bellek/CPU sınırlı buildx builder denenir.
# Ortam (yalnız test için): BEAUTYOS_DIR, BEAUTYOS_KAYNAK, BEAUTYOS_SAGLIK_KAP.
set -euo pipefail

BASE="${BEAUTYOS_DIR:-/srv/beautyos}"
KAYNAK="${BEAUTYOS_KAYNAK:-$BASE/kaynak}"
SAGLIK_KAP="${BEAUTYOS_SAGLIK_KAP:-beautyos-api-1}"
BUILDER="beautyos-derle"
WEB_HEAP_MB=1536

kullanim() {
  echo "Kullanım: derle.sh <commit-sha>   (≥ 12 haneli onaltılık commit kimliği; dal, etiket ya da HEAD olmaz)" >&2
}

hata() { echo "HATA: $*" >&2; }

# ─── K1: girdi ───────────────────────────────────────────────────────────────────
if [ $# -ne 1 ] || ! [[ "$1" =~ ^[0-9a-f]{12,40}$ ]]; then
  kullanim
  exit 2
fi
SHA_GIRDI="$1"

# ─── Tek derleme ─────────────────────────────────────────────────────────────────
exec 9>"$BASE/derle.lock"
if ! flock -n 9; then
  hata "başka bir derleme sürüyor; bitmesi beklenmeli"
  exit 1
fi

# ─── K2: kaynak ──────────────────────────────────────────────────────────────────
[ -d "$KAYNAK/.git" ] || { hata "kaynak deposu yok: $KAYNAK"; exit 1; }
git -C "$KAYNAK" fetch --quiet origin || { hata "git fetch başarısız (deploy key ve ağ erişimini kontrol edin)"; exit 1; }
if [ -n "$(git -C "$KAYNAK" status --porcelain)" ]; then
  hata "kaynak deposunun çalışma ağacı temiz değil; derleme durdu"
  exit 1
fi
if ! git -C "$KAYNAK" cat-file -e "${SHA_GIRDI}^{commit}" 2>/dev/null; then
  hata "commit bulunamadı: $SHA_GIRDI (fetch sonrası da yok; yanlış sha ya da push edilmemiş)"
  exit 1
fi
SHA_TAM="$(git -C "$KAYNAK" rev-parse "${SHA_GIRDI}^{commit}")"
SHA12="${SHA_TAM:0:12}"
git -C "$KAYNAK" checkout --quiet --detach "$SHA_TAM"
echo "Kaynak: $SHA_TAM"

# ─── K5: değerler yalnız deploy/derleme.conf'tan (source edilmez; yalnız ANAHTAR=değer okunur) ──
declare -A DEGER=()
if [ ! -f "$KAYNAK/deploy/derleme.conf" ]; then
  hata "deploy/derleme.conf bu commit'te yok"
  exit 1
fi
while IFS='=' read -r anahtar deger; do
  case "$anahtar" in
    '' | \#*) continue ;;
    NEXT_PUBLIC_API_URL_PROD | NEXT_PUBLIC_API_URL_STAGING | NEXT_PUBLIC_TURNSTILE_SITE_KEY | NEXT_PUBLIC_BOT_FEATURES_ENABLED)
      DEGER[$anahtar]="$deger" ;;
    *) hata "derleme.conf içinde bilinmeyen anahtar: $anahtar"; exit 1 ;;
  esac
done <"$KAYNAK/deploy/derleme.conf"
for zorunlu in NEXT_PUBLIC_API_URL_PROD NEXT_PUBLIC_API_URL_STAGING; do
  [ -n "${DEGER[$zorunlu]:-}" ] || { hata "derleme.conf: $zorunlu boş"; exit 1; }
done

# ─── K4: sınırlı builder (olmazsa gerekçesiyle varsayılan builder) ────────────────
KOMUT_INSA=(docker build)
if docker buildx inspect "$BUILDER" >/dev/null 2>&1 \
  || docker buildx create --name "$BUILDER" --driver docker-container \
    --driver-opt "memory=2g,memory-swap=3g,cpu-period=100000,cpu-quota=150000" >/dev/null 2>&1; then
  if docker buildx inspect --bootstrap "$BUILDER" >/dev/null 2>&1; then
    KOMUT_INSA=(docker buildx build --builder "$BUILDER" --load)
    echo "Builder: $BUILDER (bellek 2g + swap 3g, CPU 1,5 çekirdek)"
  else
    echo "UYARI: sınırlı builder başlatılamadı; varsayılan builder kullanılıyor (bellek sınırı yok)." >&2
  fi
else
  echo "UYARI: sınırlı builder oluşturulamadı; varsayılan builder kullanılıyor (bellek sınırı yok)." >&2
fi

# ─── Ölçüm: 2 sn'de bir kullanılan bellek, swap ve canlı api sağlığı ───────────────
OLCUM="$(mktemp)"
olc_dongusu() {
  local toplam kullanilabilir swap_t swap_s saglik
  while true; do
    toplam="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
    kullanilabilir="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
    swap_t="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)"
    swap_s="$(awk '/^SwapFree:/ {print $2}' /proc/meminfo)"
    saglik="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$SAGLIK_KAP" 2>/dev/null || echo yok)"
    echo "$(date +%s) $(((toplam - kullanilabilir) / 1024)) $(((swap_t - swap_s) / 1024)) $saglik" >>"$OLCUM"
    sleep 2
  done
}
olc_dongusu &
OLC_PID=$!
kapat() {
  kill "$OLC_PID" 2>/dev/null || true
  wait "$OLC_PID" 2>/dev/null || true
  rm -f "$OLCUM"
  docker buildx stop "$BUILDER" >/dev/null 2>&1 || true
}
trap kapat EXIT

SURELER=()
insa() { # ad etiket dockerfile [ek argümanlar...]
  local ad="$1" etiket="$2" dockerfile="$3" t0=$SECONDS
  shift 3
  echo "── Derleniyor: $etiket"
  (cd "$KAYNAK" && "${KOMUT_INSA[@]}" -f "$dockerfile" -t "$etiket" \
    --label "org.opencontainers.image.revision=$SHA_TAM" "$@" .) >/dev/null
  SURELER+=("$ad $((SECONDS - t0)) sn")
}

web_argumanlari() { # api_url
  printf '%s\n' --build-arg "NEXT_PUBLIC_API_URL=$1" \
    --build-arg "NEXT_PUBLIC_TURNSTILE_SITE_KEY=${DEGER[NEXT_PUBLIC_TURNSTILE_SITE_KEY]:-}" \
    --build-arg "NEXT_PUBLIC_BOT_FEATURES_ENABLED=${DEGER[NEXT_PUBLIC_BOT_FEATURES_ENABLED]:-false}" \
    --build-arg "NODE_HEAP_MB=$WEB_HEAP_MB"
}

insa api "beautyos-api:$SHA12" apps/api/Dockerfile
mapfile -t ARG_PROD < <(web_argumanlari "${DEGER[NEXT_PUBLIC_API_URL_PROD]}")
insa web-prod "beautyos-web:${SHA12}-prod" apps/web/Dockerfile "${ARG_PROD[@]}"
mapfile -t ARG_STAGING < <(web_argumanlari "${DEGER[NEXT_PUBLIC_API_URL_STAGING]}")
insa web-staging "beautyos-web:${SHA12}-staging" apps/web/Dockerfile "${ARG_STAGING[@]}"

# ─── K3: etiket doğrulaması ──────────────────────────────────────────────────────
for etiket in "beautyos-api:$SHA12" "beautyos-web:${SHA12}-prod" "beautyos-web:${SHA12}-staging"; do
  rev="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$etiket")"
  if [ "$rev" != "$SHA_TAM" ]; then
    hata "$etiket revision etiketi beklenenle uyuşmuyor"
    exit 1
  fi
done

# ─── Rapor ───────────────────────────────────────────────────────────────────────
echo "── Derleme tamam: $SHA12 ──"
printf '  süre: %s\n' "${SURELER[@]}"
awk '
  { n++; if ($2 > mem) mem = $2; if ($3 > swp) swp = $3; if ($4 != "healthy") kotu++; durum[$4]++ }
  END {
    printf "  tepe bellek (sistem): %d MB · tepe swap: %d MB · örnek: %d\n", mem, swp, n
    if (n > 0) { printf "  api sağlığı:"; for (d in durum) printf " %s=%d", d, durum[d]; printf "\n" }
  }' "$OLCUM"
