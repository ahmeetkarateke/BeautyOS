#!/usr/bin/env bash
# Eski BeautyOS imajlarını temizler (ADR-0018). Kullanım:  imaj-temizle.sh [--dry-run] [--tut <sayı>]
# Her imaj ailesi için (beautyos-api, beautyos-web-prod, beautyos-web-staging) en yeni 3 sürüm kalır (oluşturma zamanına göre).
# Yalnız derle.sh'ın ürettiği <sha12> biçimli etiketler yönetilir; "test" gibi diğer etiketlere dokunulmaz.
# ASLA silinmez: herhangi bir konteynerin (çalışan ya da durmuş) kullandığı imaj, .env içindeki BEAUTYOS_VERSION ve
# BEAUTYOS_STAGING_VERSION sürümlerinin imajları.
# Silinen etiketler BEAUTYOS_DIR/imaj-temizle.log dosyasına yazılır. Kurucu kuralı onaylamadan otomatik çağrılmamalıdır.
# Ortam (yalnız test için): BEAUTYOS_DIR.
set -euo pipefail

BASE="${BEAUTYOS_DIR:-/srv/beautyos}"
LOG="$BASE/imaj-temizle.log"
TUT=3
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --tut)
      shift
      TUT="${1:-}"
      if ! [[ "$TUT" =~ ^[0-9]+$ ]] || [ "$TUT" -lt 1 ]; then
        echo "HATA: --tut pozitif tam sayı ister" >&2
        exit 2
      fi ;;
    *) echo "Kullanım: imaj-temizle.sh [--dry-run] [--tut <sayı>]" >&2; exit 2 ;;
  esac
  shift
done

# .env'den yalnız iki sürüm anahtarı okunur (dosya source edilmez); tırnak varsa atılır.
surum_oku() {
  local anahtar="$1" satir
  [ -f "$BASE/.env" ] || return 0
  satir="$(sed -n "s/^${anahtar}=//p" "$BASE/.env" | head -n 1)"
  satir="${satir%\"}"; satir="${satir#\"}"; satir="${satir%\'}"; satir="${satir#\'}"
  printf '%s' "$satir"
}
SURUM_CANLI="$(surum_oku BEAUTYOS_VERSION)"
SURUM_STAGING="$(surum_oku BEAUTYOS_STAGING_VERSION)"

declare -A KORUMALI=()
korumali_ekle() { [ -z "$1" ] || KORUMALI["$1"]=1; }
korumali_ekle "${SURUM_CANLI:+beautyos-api:$SURUM_CANLI}"
korumali_ekle "${SURUM_CANLI:+beautyos-web:$SURUM_CANLI-prod}"
korumali_ekle "${SURUM_STAGING:+beautyos-api:$SURUM_STAGING}"
korumali_ekle "${SURUM_STAGING:+beautyos-web:$SURUM_STAGING-staging}"

# Konteynerlerin (durmuş olanlar dahil) kullandığı imaj kimlikleri
declare -A KULLANIMDA=()
while read -r kimlik; do
  [ -z "$kimlik" ] || KULLANIMDA["$kimlik"]=1
done < <(docker ps -a -q | xargs -r docker inspect --format '{{.Image}}')

# aile|oluşturma-zamanı|etiket|kimlik satırları, ailede en yeniden eskiye
liste="$(docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E '^beautyos-(api|web):[0-9a-f]{12}(-prod|-staging)?$' || true)"

silinecek=()
declare -A SAYAC=()
while IFS='|' read -r _ etiket; do
  [ -n "$etiket" ] || continue
  repo="${etiket%%:*}"; tag="${etiket#*:}"
  case "$tag" in
    *-prod) aile="$repo-prod" ;;
    *-staging) aile="$repo-staging" ;;
    *) aile="$repo" ;;
  esac
  SAYAC[$aile]=$(( ${SAYAC[$aile]:-0} + 1 ))
  if [ "${SAYAC[$aile]}" -le "$TUT" ]; then
    continue
  fi
  kimlik="$(docker image inspect -f '{{.Id}}' "$etiket")"
  if [ -n "${KORUMALI[$etiket]:-}" ]; then
    echo "KORUNDU (.env sürümü)   $etiket"
    continue
  fi
  if [ -n "${KULLANIMDA[$kimlik]:-}" ]; then
    echo "KORUNDU (konteyner)     $etiket"
    continue
  fi
  silinecek+=("$etiket")
done < <(
  while read -r e; do
    [ -n "$e" ] && printf '%s|%s\n' "$(docker image inspect -f '{{.Created}}' "$e")" "$e"
  done <<<"$liste" | sort -r
)

zaman="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ "${#silinecek[@]}" -eq 0 ]; then
  echo "Silinecek imaj yok."
fi
for etiket in "${silinecek[@]}"; do
  if [ "$DRY" -eq 1 ]; then
    echo "SİLİNECEK (dry-run)     $etiket"
  elif docker rmi "$etiket" >/dev/null 2>&1; then
    echo "SİLİNDİ                 $etiket"
    echo "$zaman silindi $etiket" >>"$LOG"
  else
    echo "ATLANDI (rmi reddetti)  $etiket" >&2
  fi
done

# ─── K10: kaynak paketleri (kaynak/<sha12>/) ────────────────────────────────────────
# En yeni $TUT paket (değişiklik zamanına göre) kalır; daha eskilerden, sha12'si hâlâ var olan bir imajın etiketinde
# geçenler de kalır (imajın kaynağı silinmez). Dry-run'da imajlar silinmediği için silinecekler çıkarılarak hesaplanır.
if [ -d "$BASE/kaynak" ]; then
  declare -A SILINECEK_ETIKET=()
  if [ "$DRY" -eq 1 ]; then
    for e in "${silinecek[@]}"; do SILINECEK_ETIKET["$e"]=1; done
  fi
  var_olan="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^beautyos-(api|web):[0-9a-f]{12}(-prod|-staging)?$' || true)"
  sira=0
  # shellcheck disable=SC2012
  while read -r dizin; do
    [ -n "$dizin" ] || continue
    ad="$(basename "$dizin")"
    [[ "$ad" =~ ^[0-9a-f]{12}$ ]] || continue
    sira=$((sira + 1))
    if [ "$sira" -le "$TUT" ]; then continue; fi
    kullanimda=0
    while read -r e; do
      [ -n "$e" ] || continue
      if [[ "$e" == *":$ad"* ]] && [ -z "${SILINECEK_ETIKET[$e]:-}" ]; then kullanimda=1; fi
    done <<<"$var_olan"
    if [ "$kullanimda" -eq 1 ]; then
      echo "KORUNDU (imajı var)     kaynak/$ad"
    elif [ "$DRY" -eq 1 ]; then
      echo "SİLİNECEK (dry-run)     kaynak/$ad"
    else
      rm -r -- "$dizin"
      echo "SİLİNDİ                 kaynak/$ad"
      echo "$zaman silindi kaynak/$ad" >>"$LOG"
    fi
  done < <(ls -dt "$BASE"/kaynak/*/ 2>/dev/null | sed 's#/$##')
fi
