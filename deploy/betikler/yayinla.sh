#!/usr/bin/env bash
# BeautyOS yayını: imaj sürümünü surum.conf'ta değiştirir, servisleri sırayla yeniden oluşturur, sağlığı doğrular,
# hata olursa iki servisi (api + web) birlikte önceki sürüme döndürür. Kullanım:
#   yayinla.sh [--kuru] [--onayli] [--migrate] <staging|canli> <sha12>
#   --kuru     hiçbir şey değiştirmez; yalnız plan ve compose imaj satırları yazılır.
#   --onayli   canlı için zorunlu: çağıran, yetkili onayın (denetçi ONAY + test GEÇTİ + izin; migration varsa onun [ONAY]'ı dahil) alındığını beyan eder.
#   --migrate  api yeniden oluşturulmadan ÖNCE, YENİ imajla migration çalıştırır (staging: migrate-staging, canlı: migrate).
#              Migration hata verirse hiçbir şey değişmez (surum.conf, servisler) ve çıkış 1 olur; veri geri yüklemesi elle ve [ONAY]'lıdır.
# Sürüm değişkenleri (BEAUTYOS_VERSION, BEAUTYOS_STAGING_VERSION, BEAUTYOS_PREVIOUS_VERSION) GİZLİ DEĞİLDİR ve .env'de değil
# BASE/surum.conf dosyasındadır (adı ".env" ile başlamaz; yetkili kişi okuyup yazabilir). Compose
#   --env-file BASE/.env --env-file BASE/surum.conf
# ile çalışır: aynı değişken iki dosyada varsa SONUNCUSU (surum.conf) kazanır.
# ZORUNLU GEÇİŞ ADIMI: .env'deki üç sürüm satırı SİLİNİR. Kalırlarsa sıradan `docker compose up` (surum.conf'suz) canlıyı eski
# sürüme döndürür (devCode açığı). Bu yüzden betik, ortam dosyasında bu üç ANAHTAR varsa (yalnız anahtar adı aranır, değer
# okunmaz) gerçek yayında exit 2 verir; --kuru yalnız uyarır ki silmeden önce doğrulanabilsin. Silindikten sonra surum.conf'suz
# sıradan `docker compose` "tanımlı olmalı" hatasıyla güvenli biçimde durur.
# Betik .env'i başka hiçbir amaçla OKUMAZ ve YAZMAZ; compose'a yalnız dosya yolunu verir. `compose config` çıktısı gizli değer
# içerir: betik onu yalnız "servis adı + image" satırlarına süzerek gösterir. Kabuk ortamındaki BEAUTYOS_*VERSION değişkenleri
# (compose'ta env-file'ı ezer) her çağrıda `env -u` ile temizlenir.
#
# Kurallar:
#  - Sıra: önce api, sonra web (denetim: yalnız web yeni, api eski kalırsa devCode açığı yeniden açılır).
#  - Geri alma her zaman api ve web BİRLİKTE yapılır (surum.conf eski haline döner, iki servis yeniden oluşturulur).
#  - Canlıya yalnız staging'de çalışan sürüm alınır (<sha12> = mevcut BEAUTYOS_STAGING_VERSION).
#  - Canlı yayında eski BEAUTYOS_VERSION, BEAUTYOS_PREVIOUS_VERSION'a taşınır (imaj-temizle bunu korur).
#  - Migration yalnız açıkça --migrate verilirse çalışır (yeni imajla, api'den önce); yoksa YAPILMAZ.
#  - İmajlar derle.sh ile önceden derlenmiş olmalıdır; yoksa hiçbir şey değişmeden çıkılır.
# Çıkış: 0 başarılı, 1 yayın başarısız ve geri alındı, 2 kullanım/ön koşul hatası, 3 geri alma da başarısız (elle müdahale).
# Ortam (yalnız test için): BEAUTYOS_DIR, BEAUTYOS_SAGLIK_BEKLE (saniye, varsayılan 150), BEAUTYOS_DIS_KONTROL=0 (dış curl atlanır).
set -euo pipefail
export LC_ALL=C

BASE="${BEAUTYOS_DIR:-/srv/beautyos}"
BEKLE="${BEAUTYOS_SAGLIK_BEKLE:-150}"
DIS_KONTROL="${BEAUTYOS_DIS_KONTROL:-1}"
CONF="$BASE/surum.conf"
GUNLUK="$BASE/yayinla.log"

kullanim() { echo "Kullanım: yayinla.sh [--kuru] [--onayli] [--migrate] <staging|canli> <sha12>" >&2; }
hata() { echo "HATA: $*" >&2; }

KURU=0
ONAYLI=0
MIGRATE=0
ARG=()
for a in "$@"; do
  case "$a" in
    --kuru) KURU=1 ;;
    --onayli) ONAYLI=1 ;;
    --migrate) MIGRATE=1 ;;
    -*) kullanim; exit 2 ;;
    *) ARG+=("$a") ;;
  esac
done
if [ "${#ARG[@]}" -ne 2 ]; then kullanim; exit 2; fi
ORTAM="${ARG[0]}"
YENI="${ARG[1]}"
case "$ORTAM" in
  staging) API=api-staging; WEB=web-staging; ANAHTAR=BEAUTYOS_STAGING_VERSION; WEB_ETIKET="${YENI}-staging"
           SAGLIK_URL="https://yeni-api.beautyossapp.com/health"; WEB_URL="https://yeni.beautyossapp.com/"; WEB_BEKLENEN=401 ;;
  canli)   API=api; WEB=web; ANAHTAR=BEAUTYOS_VERSION; WEB_ETIKET="${YENI}-prod"
           SAGLIK_URL="https://api.beautyossapp.com/health"; WEB_URL="https://beautyossapp.com/"; WEB_BEKLENEN=200 ;;
  *) kullanim; exit 2 ;;
esac
if ! [[ "$YENI" =~ ^[0-9a-f]{12}$ ]]; then hata "sürüm 12 haneli küçük harfli onaltılık commit kimliği olmalı"; exit 2; fi
if [ "$ORTAM" = "canli" ] && [ "$KURU" -eq 0 ] && [ "$ONAYLI" -ne 1 ]; then
  hata "canlı yayın --onayli ister (denetçi ONAY + test mühendisi TEST GEÇTİ + yetkili izin alınmış olmalı)"
  exit 2
fi

[ -f "$BASE/compose.yml" ] || { hata "$BASE/compose.yml yok"; exit 2; }
[ -f "$CONF" ] || { hata "$CONF yok. Önce mevcut çalışan etiketlerle oluşturulmalı (üç satır: BEAUTYOS_VERSION, BEAUTYOS_STAGING_VERSION, BEAUTYOS_PREVIOUS_VERSION)"; exit 2; }

# Tek yayın aynı anda.
exec 8>"$BASE/yayinla.lock"
flock -n 8 || { hata "başka bir yayın sürüyor"; exit 2; }

# Ortam dosyasında eski sürüm ANAHTARLARI kalmış mı? Yalnız anahtar adı aranır (awk çıkış kodu); değer okunmaz ya da yazılmaz.
# Kalmışsa sıradan `docker compose up` (surum.conf'suz) canlıyı eski sürüme döndürebilir: gerçek yayın reddedilir.
ESKI_ANAHTAR=0
if [ -f "$BASE/.env" ] && awk -F= '$1 ~ /^[[:space:]]*(export[[:space:]]+)?BEAUTYOS_(STAGING_|PREVIOUS_)?VERSION[[:space:]]*$/ { f = 1 } END { exit !f }' "$BASE/.env"; then
  ESKI_ANAHTAR=1
  if [ "$KURU" -eq 1 ]; then
    echo "UYARI: ortam dosyasında BEAUTYOS_*VERSION satırı var; GEÇİŞ İÇİN SİLİNMELİ (kurucu). Silinene kadar gerçek yayın yapılmaz." >&2
  else
    hata "ortam dosyasında BEAUTYOS_VERSION / BEAUTYOS_STAGING_VERSION / BEAUTYOS_PREVIOUS_VERSION satırı var. Sürümler yalnız surum.conf'ta durmalı: bu üç satır silinmeden yayın yapılmaz (kalırsa surum.conf'suz bir 'docker compose up' canlıyı eski sürüme döndürür)"
    exit 2
  fi
fi

# Hedef ortamın dosyasında uygulamanın ZORUNLU değişkenleri dolu mu? Yalnız "AD=" sonrasında en az bir karakter var/yok bakılır
# (awk çıkış kodu); değer okunmaz, yazdırılmaz. Eksik varsa yalnız ADI yazılır, yayın (ve --kuru) çıkış 2 ile durur.
# LİSTE apps/api/src/lib/env.ts içindeki REQUIRED_IN_PRODUCTION ile SENKRON kalmalıdır (test-yayinla.sh karşılaştırır).
ZORUNLU_ORTAM=(DATABASE_URL REDIS_URL JWT_SECRET ALLOWED_ORIGINS PUBLIC_URL FRONTEND_URL)
if [ "$ORTAM" = "canli" ]; then ORTAM_DOSYASI="$BASE/.env"; else ORTAM_DOSYASI="$BASE/.env.staging"; fi
EKSIK_ORTAM=""
if [ ! -f "$ORTAM_DOSYASI" ]; then
  hata "hedef ortam dosyası yok: $ORTAM_DOSYASI"
  exit 2
fi
for ad in "${ZORUNLU_ORTAM[@]}"; do
  if ! awk -v k="$ad" 'index($0, k "=") == 1 && length($0) > length(k) + 1 { f = 1 } END { exit !f }' "$ORTAM_DOSYASI"; then
    EKSIK_ORTAM="$EKSIK_ORTAM $ad"
  fi
done
if [ -n "$EKSIK_ORTAM" ]; then
  hata "$ORTAM ortam dosyasında zorunlu değişken(ler) boş ya da yok:$EKSIK_ORTAM (kurucu doldurmalı; adlar .env.example'da). Yayın başlamadı"
  exit 2
fi

# surum.conf'tan yalnız ANAHTAR=değer okunur (source edilmez).
oku() { awk -F= -v k="$1" '$1 == k { print substr($0, length(k) + 2); exit }' "$CONF"; }
CANLI_ESKI="$(oku BEAUTYOS_VERSION)"
STAGING_ESKI="$(oku BEAUTYOS_STAGING_VERSION)"
ONCEKI_ESKI="$(oku BEAUTYOS_PREVIOUS_VERSION)"
for v in "$CANLI_ESKI" "$STAGING_ESKI"; do
  [[ "$v" =~ ^[0-9a-f]{12}$ ]] || { hata "surum.conf geçersiz: BEAUTYOS_VERSION ve BEAUTYOS_STAGING_VERSION 12 haneli sürüm olmalı"; exit 2; }
done
if [ -n "$ONCEKI_ESKI" ] && ! [[ "$ONCEKI_ESKI" =~ ^[0-9a-f]{12}$ ]]; then hata "surum.conf geçersiz: BEAUTYOS_PREVIOUS_VERSION"; exit 2; fi
if [ "$ORTAM" = "canli" ]; then ESKI="$CANLI_ESKI"; else ESKI="$STAGING_ESKI"; fi

if [ "$ORTAM" = "canli" ] && [ "$YENI" != "$STAGING_ESKI" ]; then
  hata "canlıya yalnız staging'de çalışan sürüm alınır (staging: $STAGING_ESKI, istenen: $YENI)"
  exit 2
fi
if [ "$YENI" = "$ESKI" ]; then hata "$ORTAM zaten $YENI sürümünde; yapılacak bir şey yok"; exit 2; fi

# İmajlar var mı (yoksa hiçbir şey değişmez).
for imaj in "beautyos-api:$YENI" "beautyos-web:$WEB_ETIKET"; do
  docker image inspect "$imaj" >/dev/null 2>&1 || { hata "imaj yok: $imaj (önce derle.sh)"; exit 2; }
done

# Kabuktaki BEAUTYOS_*VERSION değişkenleri compose'ta env-file'ı ezer: her çağrıda temizlenir. DCENV: yalnız o çağrıya özel atamalar
# (migration için yeni sürüm). Ortam dosyası sürüm anahtarı içermediği için (yukarıdaki denetim) --env-file sırası güvenlidir.
DCENV=()
dc() {
  env -u BEAUTYOS_VERSION -u BEAUTYOS_STAGING_VERSION -u BEAUTYOS_PREVIOUS_VERSION ${DCENV[@]+"${DCENV[@]}"} \
    docker compose -p beautyos -f "$BASE/compose.yml" --env-file "$BASE/.env" --env-file "$CONF" "$@"
}
# Yalnız servis adı ve image satırları (config çıktısı gizli değer içerir; başka satır asla yazılmaz).
imaj_satirlari() {
  local cikti
  cikti="$(dc config 2>/dev/null)" || { echo "(config okunamadı)"; return 0; }
  awk '/^  [a-z-]+:$/ { s=$1; sub(/:$/, "", s) } /^    image:/ { print "  " s " " $2 }' <<<"$cikti"
}

yaz_conf() { # yaz_conf <canli> <staging> <onceki>
  local gecici
  gecici="$(mktemp "$BASE/surum.conf.XXXXXX")"
  printf '%s\n' "BEAUTYOS_VERSION=$1" "BEAUTYOS_STAGING_VERSION=$2" "BEAUTYOS_PREVIOUS_VERSION=$3" >"$gecici"
  chmod 644 "$gecici"
  mv -f "$gecici" "$CONF"
}

gunluk() { printf '%s %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$ORTAM" "$*" >>"$GUNLUK" 2>/dev/null || true; }

saglikli_bekle() { # saglikli_bekle <servis>
  local servis="$1" son=$(( $(date +%s) + BEKLE )) id durum=""
  while [ "$(date +%s)" -lt "$son" ]; do
    id="$(dc ps -q "$servis" 2>/dev/null || true)"
    id="$(printf '%s' "$id" | tr -d '\r' | sed -n '1p')"
    if [ -n "$id" ]; then
      durum="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)"
      [ "$durum" = "healthy" ] && return 0
    fi
    sleep 3
  done
  echo "  $servis sağlıklı olmadı (son durum: ${durum:-bilinmiyor})" >&2
  return 1
}

dis_kontrol() { # dis_kontrol <etiket> <url> <beklenen kod>
  [ "$DIS_KONTROL" = "1" ] || return 0
  local kod
  for _ in 1 2 3 4 5 6; do
    kod="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$2" 2>/dev/null || true)"
    [ "$kod" = "$3" ] && return 0
    sleep 3
  done
  echo "  $2 beklenen $3 yerine ${kod:-yok} döndü" >&2
  return 1
}

if [ "$ORTAM" = "canli" ]; then
  YENI_CANLI="$YENI"; YENI_STAGING="$STAGING_ESKI"; YENI_ONCEKI="$CANLI_ESKI"
else
  YENI_CANLI="$CANLI_ESKI"; YENI_STAGING="$YENI"; YENI_ONCEKI="$ONCEKI_ESKI"
fi

echo "Plan: $ORTAM $ESKI -> $YENI (sıra: $API, sonra $WEB; migration: $([ "$MIGRATE" -eq 1 ] && echo "evet, api'den önce" || echo "hayır"))"
echo "Şimdiki imajlar:"; imaj_satirlari
if [ "$KURU" -eq 1 ]; then
  echo "(--kuru: değişiklik yapılmadı; geçiş sonrası surum.conf: BEAUTYOS_VERSION=$YENI_CANLI BEAUTYOS_STAGING_VERSION=$YENI_STAGING BEAUTYOS_PREVIOUS_VERSION=$YENI_ONCEKI)"
  exit 0
fi

HATA_DOSYA="$(mktemp)"
trap 'rm -f -- "$HATA_DOSYA"' EXIT
# Başarısız compose çağrısının son satırları (hata satırları değer içermez; değerler yalnız `config` çıktısındadır).
son_hata() { tail -n 5 "$HATA_DOSYA" 2>/dev/null | sed 's/^/    compose: /' >&2 || true; }

geri_al() {
  echo "GERİ ALMA: $API ve $WEB birlikte $ESKI sürümüne dönüyor" >&2
  yaz_conf "$CANLI_ESKI" "$STAGING_ESKI" "$ONCEKI_ESKI"
  if dc up -d --no-deps "$API" "$WEB" >/dev/null 2>"$HATA_DOSYA" && saglikli_bekle "$API" && saglikli_bekle "$WEB"; then
    gunluk "GERI-ALINDI $YENI -> $ESKI"
    echo "Geri alındı; $ORTAM $ESKI sürümünde." >&2
    exit 1
  fi
  gunluk "GERI-ALMA-BASARISIZ $YENI -> $ESKI"
  son_hata
  hata "geri alma da başarısız; elle müdahale gerekir (surum.conf eski değerlere döndürüldü)"
  exit 3
}

# Migration (yalnız --migrate): YENİ imajla, api'den ÖNCE. Kabuk ataması yalnız bu çağrıya girer ve surum.conf'u ezer.
# Hata olursa hiçbir şey değişmemiştir (surum.conf ve servisler eski); veri geri yüklemesi elle ve [ONAY]'lıdır.
if [ "$MIGRATE" -eq 1 ]; then
  if [ "$ORTAM" = "canli" ]; then MIG_SERVIS=migrate; DCENV=("BEAUTYOS_VERSION=$YENI"); else MIG_SERVIS=migrate-staging; DCENV=("BEAUTYOS_STAGING_VERSION=$YENI"); fi
  echo "0/2 migration: $MIG_SERVIS ($YENI imajıyla)"
  if ! dc --profile migrate run --rm "$MIG_SERVIS" >/dev/null 2>"$HATA_DOSYA"; then
    son_hata
    gunluk "MIGRATION-BASARISIZ $ESKI -> $YENI"
    hata "migration başarısız; surum.conf ve servisler DEĞİŞMEDİ. Migration kısmen uygulanmış olabilir: elle incele (veri geri yükleme [ONAY] gerektirir)"
    exit 1
  fi
  DCENV=()
  gunluk "MIGRATION-TAMAM $YENI"
fi

yaz_conf "$YENI_CANLI" "$YENI_STAGING" "$YENI_ONCEKI"
gunluk "BASLA $ESKI -> $YENI"

echo "1/2 $API"
dc up -d --no-deps "$API" >/dev/null 2>"$HATA_DOSYA" || { son_hata; hata "$API yeniden oluşturulamadı"; geri_al; }
saglikli_bekle "$API" || geri_al
dis_kontrol "$API" "$SAGLIK_URL" 200 || geri_al

echo "2/2 $WEB"
dc up -d --no-deps "$WEB" >/dev/null 2>"$HATA_DOSYA" || { son_hata; hata "$WEB yeniden oluşturulamadı"; geri_al; }
saglikli_bekle "$WEB" || geri_al
dis_kontrol "$WEB" "$WEB_URL" "$WEB_BEKLENEN" || geri_al

gunluk "TAMAM $ESKI -> $YENI"
echo "Tamam: $ORTAM $YENI sürümünde. Önceki: ${YENI_ONCEKI:-yok}. İmajlar:"
imaj_satirlari
