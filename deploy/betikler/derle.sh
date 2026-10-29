#!/usr/bin/env bash
# BeautyOS imajlarını SUNUCUDA derler (ADR-0018, ADR-0019). Kullanım:  derle.sh <tam-commit-sha>
#   <tam-commit-sha>: 40 haneli küçük harfli onaltılık commit kimliği. Kısa sha, dal adı, etiket ya da HEAD kabul edilmez (çıkış 2).
# Sunucu GitHub'dan ÇEKMEZ (deploy key yok). Müdür onaylı commit'i kendi bilgisayarında paketleyip aktarır:
#   /srv/beautyos/kaynak/<sha12>/{kaynak.tar, commit.txt, kaynak.tar.sha256}
#   Paket komutu: git -c core.autocrlf=false archive --format=tar <tam-sha> -o kaynak.tar  (Windows'ta CRLF'yi önler; betik CRLF bulursa durur)
# Bu betik paketi doğrular (sha256, tar içindeki commit kimliği, commit.txt, argüman), boş agac/ altına açar ve derler.
# Üretilenler (hepsi org.opencontainers.image.revision=<tam sha> etiketli, latest yok):
#   beautyos-api:<sha12>   beautyos-web:<sha12>-prod   beautyos-web:<sha12>-staging
# Web değerleri yalnız paketteki deploy/derleme.conf dosyasından gelir; .env* okunmaz.
# Yük: derlemeler sırayla çalışır, flock ile aynı anda tek derleme; bellek/CPU sınırlı buildx builder denenir.
# Ortam (yalnız test için): BEAUTYOS_DIR, BEAUTYOS_SAGLIK_KAP.
set -euo pipefail
export LC_ALL=C

BASE="${BEAUTYOS_DIR:-/srv/beautyos}"
SAGLIK_KAP="${BEAUTYOS_SAGLIK_KAP:-beautyos-api-1}"
BUILDER="beautyos-derle"
WEB_HEAP_MB=1536

kullanim() {
  echo "Kullanım: derle.sh <tam-commit-sha>   (40 haneli küçük harfli onaltılık kimlik; kısa sha, dal, etiket ya da HEAD olmaz)" >&2
}

hata() { echo "HATA: $*" >&2; }

# ─── K1: girdi ───────────────────────────────────────────────────────────────────
if [ $# -ne 1 ] || ! [[ "$1" =~ ^[0-9a-f]{40}$ ]]; then
  kullanim
  exit 2
fi
SHA_TAM="$1"
SHA12="${SHA_TAM:0:12}"

# ─── Tek derleme ─────────────────────────────────────────────────────────────────
exec 9>"$BASE/derle.lock"
if ! flock -n 9; then
  hata "başka bir derleme sürüyor; bitmesi beklenmeli"
  exit 1
fi

# ─── K2: paket doğrulaması (derleme başlamadan önce; hiçbir hatada docker build çalışmaz) ──
command -v git >/dev/null 2>&1 || { hata "git kurulu değil (paketin commit kimliğini okumak için gerekli): apt install git"; exit 1; }
PAKET="$BASE/kaynak/$SHA12"
for dosya in kaynak.tar commit.txt kaynak.tar.sha256; do
  [ -f "$PAKET/$dosya" ] || { hata "paket eksik: $PAKET/$dosya"; exit 1; }
done
if ! (cd "$PAKET" && sha256sum -c kaynak.tar.sha256 >/dev/null 2>&1); then
  hata "kaynak.tar sha256 doğrulaması başarısız (bozuk ya da değişmiş paket)"
  exit 1
fi
TAR_SHA="$(git get-tar-commit-id <"$PAKET/kaynak.tar" 2>/dev/null || true)"
COMMIT_TXT="$(tr -d '[:space:]' <"$PAKET/commit.txt")"
if [ "$TAR_SHA" != "$SHA_TAM" ]; then
  hata "tar içindeki commit kimliği argümanla eşleşmiyor (tar: ${TAR_SHA:-okunamadı}, istenen: $SHA_TAM)"
  exit 1
fi
if [ "$COMMIT_TXT" != "$SHA_TAM" ]; then
  hata "commit.txt argümanla eşleşmiyor"
  exit 1
fi
# Satır sonu: .sh ve Dockerfile* dosyalarında CR (CRLF) varsa derleme başlamaz. Windows'ta `git archive`
# autocrlf yüzünden bu dosyalara CRLF yazabilir; imajdaki betikler "bad interpreter" ile düşer.
# Paket şöyle üretilmeli:  git -c core.autocrlf=false archive --format=tar <tam-sha> -o kaynak.tar
UYUMSUZ=""
LISTE="$(tar -tf "$PAKET/kaynak.tar" 2>/dev/null || true)"
while IFS= read -r uye; do
  case "$uye" in
    */) continue ;;
    *.sh | Dockerfile | Dockerfile.* | */Dockerfile | */Dockerfile.*)
      CR_SAYISI="$(tar -xOf "$PAKET/kaynak.tar" -- "$uye" 2>/dev/null | tr -cd '\r' | wc -c || true)"
      if [ "${CR_SAYISI:-0}" -gt 0 ]; then UYUMSUZ="$UYUMSUZ $uye"; fi ;;
  esac
done <<<"$LISTE"
if [ -n "$UYUMSUZ" ]; then
  hata "pakette CRLF içeren dosya(lar):$UYUMSUZ ; paketi 'git -c core.autocrlf=false archive' ile yeniden üretin (derleme başlamadı)"
  exit 1
fi
AGAC="$PAKET/agac"
if [ -d "$AGAC" ] && [ -n "$(ls -A "$AGAC")" ]; then
  hata "$AGAC dolu; önceki açılım temizlenmeden derleme yapılmaz"
  exit 1
fi
mkdir -p "$AGAC"
tar -xf "$PAKET/kaynak.tar" -C "$AGAC" || { hata "tar açılamadı"; exit 1; }
echo "Kaynak: $SHA_TAM (paket doğrulandı, $AGAC)"

# ─── K5: değerler yalnız deploy/derleme.conf'tan (source edilmez; yalnız ANAHTAR=değer okunur) ──
declare -A DEGER=()
if [ ! -f "$AGAC/deploy/derleme.conf" ]; then
  hata "deploy/derleme.conf pakette yok"
  exit 1
fi
while IFS='=' read -r anahtar deger; do
  case "$anahtar" in
    '' | \#*) continue ;;
    NEXT_PUBLIC_API_URL_PROD | NEXT_PUBLIC_API_URL_STAGING | NEXT_PUBLIC_TURNSTILE_SITE_KEY | NEXT_PUBLIC_BOT_FEATURES_ENABLED | NEXT_PUBLIC_UI_V2_PROD | NEXT_PUBLIC_UI_V2_STAGING | NEXT_PUBLIC_UI_V2_SHOWCASE_STAGING)
      DEGER[$anahtar]="$deger" ;;
    # Tasarım sistemi vitrini canlıda ASLA açılmaz: canlı için vitrin anahtarı tanımlanamaz (boş bile olsa reddedilir).
    NEXT_PUBLIC_UI_V2_SHOWCASE_PROD | NEXT_PUBLIC_UI_V2_SHOWCASE)
      hata "derleme.conf: $anahtar tanımlanamaz (vitrin yalnız staging imajında açılır: NEXT_PUBLIC_UI_V2_SHOWCASE_STAGING)"; exit 1 ;;
    *) hata "derleme.conf içinde bilinmeyen anahtar: $anahtar"; exit 1 ;;
  esac
done <"$AGAC/deploy/derleme.conf"
for zorunlu in NEXT_PUBLIC_API_URL_PROD NEXT_PUBLIC_API_URL_STAGING; do
  [ -n "${DEGER[$zorunlu]:-}" ] || { hata "derleme.conf: $zorunlu boş"; exit 1; }
done
# Yüzey bayrağı: boş ya da tanımsız geçerlidir (v2 kapalı); doluysa yalnız [a-z,] (docker build-arg'a güvenli girer).
for bayrak in NEXT_PUBLIC_UI_V2_PROD NEXT_PUBLIC_UI_V2_STAGING; do
  if ! [[ "${DEGER[$bayrak]:-}" =~ ^[a-z,]*$ ]]; then
    hata "derleme.conf: $bayrak yalnız küçük harf ve virgül içerebilir"
    exit 1
  fi
done
# Vitrin bayrağı (yalnız staging): boş/tanımsız = kapalı; açık değer yalnız "1" (kodda raw === '1').
if ! [[ "${DEGER[NEXT_PUBLIC_UI_V2_SHOWCASE_STAGING]:-}" =~ ^1?$ ]]; then
  hata "derleme.conf: NEXT_PUBLIC_UI_V2_SHOWCASE_STAGING boş ya da 1 olmalı"
  exit 1
fi

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
  (cd "$AGAC" && "${KOMUT_INSA[@]}" -f "$dockerfile" -t "$etiket" \
    --label "org.opencontainers.image.revision=$SHA_TAM" "$@" .) >/dev/null
  SURELER+=("$ad $((SECONDS - t0)) sn")
}

web_argumanlari() { # api_url ui_v2 [vitrin]  (vitrin yalnız staging çağrısında verilir; canlıda build-arg HİÇ eklenmez)
  printf '%s\n' --build-arg "NEXT_PUBLIC_API_URL=$1" \
    --build-arg "NEXT_PUBLIC_UI_V2=${2:-}" \
    ${3:+--build-arg "NEXT_PUBLIC_UI_V2_SHOWCASE=$3"} \
    --build-arg "NEXT_PUBLIC_TURNSTILE_SITE_KEY=${DEGER[NEXT_PUBLIC_TURNSTILE_SITE_KEY]:-}" \
    --build-arg "NEXT_PUBLIC_BOT_FEATURES_ENABLED=${DEGER[NEXT_PUBLIC_BOT_FEATURES_ENABLED]:-false}" \
    --build-arg "NODE_HEAP_MB=$WEB_HEAP_MB"
}

insa api "beautyos-api:$SHA12" apps/api/Dockerfile
mapfile -t ARG_PROD < <(web_argumanlari "${DEGER[NEXT_PUBLIC_API_URL_PROD]}" "${DEGER[NEXT_PUBLIC_UI_V2_PROD]:-}")
insa web-prod "beautyos-web:${SHA12}-prod" apps/web/Dockerfile "${ARG_PROD[@]}"
mapfile -t ARG_STAGING < <(web_argumanlari "${DEGER[NEXT_PUBLIC_API_URL_STAGING]}" "${DEGER[NEXT_PUBLIC_UI_V2_STAGING]:-}" "${DEGER[NEXT_PUBLIC_UI_V2_SHOWCASE_STAGING]:-}")
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
  { n++; if ($2 > mem) mem = $2; if ($3 > swp) swp = $3; durum[$4]++ }
  END {
    printf "  tepe bellek (sistem): %d MB · tepe swap: %d MB · örnek: %d\n", mem, swp, n
    if (n > 0) { printf "  api sağlığı:"; for (d in durum) printf " %s=%d", d, durum[d]; printf "\n" }
  }' "$OLCUM"
