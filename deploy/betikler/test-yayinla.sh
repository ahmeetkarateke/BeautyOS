#!/usr/bin/env bash
# yayinla.sh testi: gerçek Docker/ağ kullanılmaz; PATH'e sahte docker, flock, curl, sleep konur.
# NOT: "sonraki --env-file kazanır" davranışını sahte docker kendisi uygular; gerçek compose'ta kanıtı sunucuda alınır
# (sirket/sunucu.md işlem günlüğü) ve geçişte `compose config` ile tekrarlanır.
# Kullanım: bash deploy/betikler/test-yayinla.sh   (çıkış 0 = tüm vakalar geçti)
set -uo pipefail
AD="$(cd "$(dirname "$0")" && pwd)"
YAYIN="$AD/yayinla.sh"
T="$(mktemp -d)"
trap 'rm -rf -- "$T"' EXIT
mkdir -p "$T/bin" "$T/base"

# --- sahte araçlar ---
cat >"$T/bin/flock" <<'EOF'
#!/bin/sh
exit 0
EOF
cat >"$T/bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
cat >"$T/bin/curl" <<'EOF'
#!/bin/sh
# $FAKE/curl_kod varsa her çağrıda o kodu döndürür (dış kontrol hatası taklidi)
if [ -f "$FAKE/curl_kod" ]; then cat "$FAKE/curl_kod"; exit 0; fi
for a in "$@"; do u="$a"; done
# $FAKE/curl_web200: staging web beklenen 401 yerine 200 döner (web dış kontrolü hata taklidi)
if [ -f "$FAKE/curl_web200" ]; then case "$u" in *//yeni.*) echo 200; exit 0 ;; esac; fi
case "$u" in
  *yeni-api*|*api.beautyossapp*) echo 200 ;;
  *yeni.*) echo 401 ;;
  *) echo 200 ;;
esac
EOF
cat >"$T/bin/docker" <<'EOF'
#!/bin/bash
# Durum: $FAKE/calisan (servis=etiket), $FAKE/olay (komut günlüğü), $FAKE/bozuk (sağlıksız etiketler, satır satır),
# $FAKE/imajsiz, $FAKE/migrate_hata (varsa migration başarısız)
F="$FAKE"
if [ "$1" = image ] && [ "$2" = inspect ]; then
  grep -qxF "$3" "$F/imajsiz" 2>/dev/null && exit 1
  exit 0
fi
if [ "$1" = inspect ]; then
  svc="${*: -1}"; svc="${svc#id-}"
  tag="$(awk -F= -v s="$svc" '$1==s{print $2}' "$F/calisan")"
  if [ -n "$tag" ] && grep -qxF "$tag" "$F/bozuk" 2>/dev/null; then echo unhealthy; else echo healthy; fi
  exit 0
fi
[ "$1" = compose ] || exit 1
shift
envdosyalari=(); profil=0
while [ $# -gt 0 ]; do
  case "$1" in
    -p|-f) shift 2 ;;
    --profile) profil=1; shift 2 ;;
    --env-file) envdosyalari+=("$2"); shift 2 ;;
    *) break ;;
  esac
done
alt="$1"; shift
ver() { # ver <ANAHTAR>: kabuk ortamı > son env dosyası (gerçek compose önceliği)
  local k="$1" v="" d x
  for d in "${envdosyalari[@]}"; do
    x="$(awk -F= -v k="$k" '$1==k{print substr($0,length(k)+2)}' "$d" 2>/dev/null | tail -n1)"
    [ -n "$x" ] && v="$x"
  done
  [ -n "${!k:-}" ] && v="${!k}"
  printf '%s' "$v"
}
case "$alt" in
  up)
    for a in "$@"; do
      case "$a" in
        -d|--no-deps) ;;
        api|api-staging|web|web-staging)
          case "$a" in
            api) t="$(ver BEAUTYOS_VERSION)" ;;
            web) t="$(ver BEAUTYOS_VERSION)-prod" ;;
            api-staging) t="$(ver BEAUTYOS_STAGING_VERSION)" ;;
            web-staging) t="$(ver BEAUTYOS_STAGING_VERSION)-staging" ;;
          esac
          grep -v "^$a=" "$F/calisan" >"$F/calisan.n" 2>/dev/null || true
          echo "$a=$t" >>"$F/calisan.n"; mv "$F/calisan.n" "$F/calisan"
          echo "up $a $t" >>"$F/olay" ;;
      esac
    done ;;
  run)
    svc="${*: -1}"
    case "$svc" in migrate) t="$(ver BEAUTYOS_VERSION)" ;; *) t="$(ver BEAUTYOS_STAGING_VERSION)" ;; esac
    echo "migrate $svc $t" >>"$F/olay"
    if [ -f "$F/migrate_hata" ]; then echo "migration hatasi (taklit)" >&2; exit 1; fi ;;
  ps) echo "id-${*: -1}" ;;
  config)
    echo "services:"
    echo "  api:"; echo "    image: beautyos-api:$(ver BEAUTYOS_VERSION)"; echo "    environment:"; echo "      JWT_SECRET: cok-gizli-deger"
    echo "  api-staging:"; echo "    image: beautyos-api:$(ver BEAUTYOS_STAGING_VERSION)"
    echo "  web:"; echo "    image: beautyos-web:$(ver BEAUTYOS_VERSION)-prod"
    echo "  web-staging:"; echo "    image: beautyos-web:$(ver BEAUTYOS_STAGING_VERSION)-staging" ;;
esac
exit 0
EOF
chmod +x "$T/bin/"*
export PATH="$T/bin:$PATH" FAKE="$T" BEAUTYOS_DIR="$T/base" BEAUTYOS_SAGLIK_BEKLE=3

BAS=0; HATA=0
tamam() { BAS=$((BAS + 1)); echo "  ok   $1"; }
kaldi() { HATA=$((HATA + 1)); echo "  KALDI $1"; }
dogru() { if eval "$2"; then tamam "$1"; else kaldi "$1"; fi; }

hazirla() { # hazirla <canli> <staging> <onceki>   (ortam dosyasında sürüm anahtarı YOK: geçiş sonrası hâli)
  : >"$T/olay"; : >"$T/imajsiz"; : >"$T/bozuk"; rm -f "$T/curl_kod" "$T/curl_web200" "$T/migrate_hata"
  printf '%s\n' "api=$1" "web=$1-prod" "api-staging=$2" "web-staging=$2-staging" >"$T/calisan"
  : >"$T/base/compose.yml"
  printf '%s\n' "IMAGE_PREFIX=" >"$T/base/.env"
  printf '%s\n' "BEAUTYOS_VERSION=$1" "BEAUTYOS_STAGING_VERSION=$2" "BEAUTYOS_PREVIOUS_VERSION=$3" >"$T/base/surum.conf"
  rm -f "$T/base/yayinla.log"
}
conf() { awk -F= -v k="$1" '$1==k{print substr($0,length(k)+2)}' "$T/base/surum.conf"; }
olay() { tr '\n' , <"$T/olay"; }

A=aaaaaaaaaaaa; B=bbbbbbbbbbbb; C=cccccccccccc

echo "V1 staging başarılı: önce api sonra web, canlıya dokunulmaz"
hazirla $A $B ""
out="$(bash "$YAYIN" staging $C 2>&1)"; rc=$?
dogru "rc=0" "[ $rc -eq 0 ]"
dogru "sıra api-staging -> web-staging" "[ \"\$(olay)\" = 'up api-staging cccccccccccc,up web-staging cccccccccccc-staging,' ]"
dogru "surum.conf staging yeni, canlı aynı" "[ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $C ] && [ \"\$(conf BEAUTYOS_VERSION)\" = $A ]"
dogru "çıktıda gizli değer yok" "! grep -q cok-gizli <<<\"\$out\""

echo "V2 staging api sağlıksız: iki servis birlikte geri alınır"
hazirla $A $B ""; echo "$C" >"$T/bozuk"
out="$(bash "$YAYIN" staging $C 2>&1)"; rc=$?
dogru "rc=1" "[ $rc -eq 1 ]"
dogru "surum.conf eski" "[ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ]"
dogru "api-staging ve web-staging eski etikette" "grep -qx 'api-staging=$B' $T/calisan && grep -qx 'web-staging=$B-staging' $T/calisan"
dogru "web yeni sürüme hiç alınmadı" "! grep -q 'up web-staging $C' $T/olay"

echo "V3 canlı: --onayli yoksa reddedilir, sürüm staging ile aynı olmalı"
hazirla $A $B ""
bash "$YAYIN" canli $B >/dev/null 2>&1; rc=$?
dogru "onaysız rc=2" "[ $rc -eq 2 ] && [ ! -s $T/olay ]"
bash "$YAYIN" --onayli canli $C >/dev/null 2>&1; rc=$?
dogru "staging'de olmayan sürüm rc=2" "[ $rc -eq 2 ] && [ ! -s $T/olay ]"

echo "V4 canlı başarılı: önceki sürüm taşınır, staging aynı kalır"
hazirla $A $B ""
bash "$YAYIN" --onayli canli $B >/dev/null 2>&1; rc=$?
dogru "rc=0" "[ $rc -eq 0 ]"
dogru "PREVIOUS eski canlı" "[ \"\$(conf BEAUTYOS_PREVIOUS_VERSION)\" = $A ] && [ \"\$(conf BEAUTYOS_VERSION)\" = $B ]"
dogru "sıra api sonra web" "[ \"\$(olay)\" = 'up api bbbbbbbbbbbb,up web bbbbbbbbbbbb-prod,' ]"

echo "V5 canlı web sağlıksız: api ve web birlikte eski etikete döner"
hazirla $A $B "$C"; echo "$B-prod" >"$T/bozuk"
bash "$YAYIN" --onayli canli $B >/dev/null 2>&1; rc=$?
dogru "rc=1" "[ $rc -eq 1 ]"
dogru "geri alındı (api ve web eski)" "grep -qx 'api=$A' $T/calisan && grep -qx 'web=$A-prod' $T/calisan"
dogru "PREVIOUS eski haline döndü" "[ \"\$(conf BEAUTYOS_PREVIOUS_VERSION)\" = $C ] && [ \"\$(conf BEAUTYOS_VERSION)\" = $A ]"

echo "V6 imaj yok: hiçbir şey değişmez"
hazirla $A $B ""; echo "beautyos-web:$C-staging" >"$T/imajsiz"
bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
dogru "rc=2, olay yok, conf aynı" "[ $rc -eq 2 ] && [ ! -s $T/olay ] && [ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ]"

echo "V7 --kuru değişiklik yapmaz, gizli değer yazmaz"
hazirla $A $B ""
out="$(bash "$YAYIN" --kuru staging $C 2>&1)"; rc=$?
dogru "rc=0, olay yok, conf aynı" "[ $rc -eq 0 ] && [ ! -s $T/olay ] && [ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ]"
dogru "gizli değer çıktıda yok" "! grep -q cok-gizli <<<\"\$out\""
dogru "config imajları surum.conf'tan" "grep -q 'api-staging beautyos-api:$B' <<<\"\$out\""

echo "V8 ortam dosyasında eski sürüm ANAHTARI kalmışsa gerçek yayın reddedilir"
for satir in "BEAUTYOS_VERSION=$A" "BEAUTYOS_STAGING_VERSION=$B" "BEAUTYOS_PREVIOUS_VERSION=" "export BEAUTYOS_VERSION=$A"; do
  hazirla $A $B ""
  printf '%s\n' "IMAGE_PREFIX=" "$satir" >"$T/base/.env"
  bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
  dogru "rc=2, hiçbir şey değişmedi ($satir)" "[ $rc -eq 2 ] && [ ! -s $T/olay ] && [ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ]"
done
hazirla $A $B ""; printf '%s\n' "IMAGE_PREFIX=" "BEAUTYOS_VERSION=$A" >"$T/base/.env"
out="$(bash "$YAYIN" --kuru staging $C 2>&1)"; rc=$?
dogru "--kuru yalnız uyarır (rc=0)" "[ $rc -eq 0 ] && grep -q 'GEÇİŞ İÇİN SİLİNMELİ' <<<\"\$out\""
hazirla $A $B ""; printf '%s\n' "IMAGE_PREFIX=" "BEAUTYOS_VERSIONX=1" "XBEAUTYOS_VERSION=1" >"$T/base/.env"
bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
dogru "benzer ama farklı anahtarlar reddedilmez" "[ $rc -eq 0 ]"

echo "V9 geçersiz girdi"
hazirla $A $B ""
bash "$YAYIN" staging ABC >/dev/null 2>&1; dogru "kısa sürüm rc=2" "[ $? -eq 2 ]"
bash "$YAYIN" test $C >/dev/null 2>&1; dogru "bilinmeyen ortam rc=2" "[ $? -eq 2 ]"
bash "$YAYIN" staging $B >/dev/null 2>&1; dogru "zaten bu sürümde rc=2" "[ $? -eq 2 ]"

echo "V10 dış kontrol hataları geri almayı tetikler"
hazirla $A $B ""; echo 500 >"$T/curl_kod"
bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
dogru "api dış kontrolü başarısız: rc=1, iki servis eski" "[ $rc -eq 1 ] && grep -qx 'api-staging=$B' $T/calisan && grep -qx 'web-staging=$B-staging' $T/calisan && [ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ]"
dogru "web hiç yeni sürüme alınmadı" "! grep -q 'up web-staging $C' $T/olay"
# web dış kontrolü: api kontrolü geçer (200), web beklenen 401 yerine 200 döner
hazirla $A $B ""
touch "$T/curl_web200"
bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
dogru "web dış kontrolü başarısız: rc=1, geri alındı" "[ $rc -eq 1 ] && grep -qx 'web-staging=$B-staging' $T/calisan && [ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ]"

echo "V11 geri alma da başarısız: rc=3, surum.conf eski değerlerde"
hazirla $A $B ""; printf '%s\n' "$C" "$B" >"$T/bozuk"
bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
dogru "rc=3" "[ $rc -eq 3 ]"
dogru "surum.conf eski değerlere döndürüldü" "[ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ] && [ \"\$(conf BEAUTYOS_VERSION)\" = $A ]"
dogru "günlükte GERI-ALMA-BASARISIZ" "grep -q GERI-ALMA-BASARISIZ $T/base/yayinla.log"

echo "V12 kabuk ortamındaki sürüm değişkeni surum.conf'u ezmez"
hazirla $A $B ""
BEAUTYOS_STAGING_VERSION=zzzzzzzzzzzz bash "$YAYIN" staging $C >/dev/null 2>&1; rc=$?
dogru "rc=0, api-staging kabuktaki değil surum.conf'taki yeni etikette" "[ $rc -eq 0 ] && grep -qx 'api-staging=$C' $T/calisan"

echo "V13 --migrate: yeni imajla, api'den önce; hata olursa hiçbir şey değişmez"
hazirla $A $B ""
bash "$YAYIN" --migrate staging $C >/dev/null 2>&1; rc=$?
dogru "staging: önce migration (yeni sürümle), sonra api, sonra web" "[ $rc -eq 0 ] && [ \"\$(olay)\" = 'migrate migrate-staging cccccccccccc,up api-staging cccccccccccc,up web-staging cccccccccccc-staging,' ]"
hazirla $A $B ""
bash "$YAYIN" --migrate --onayli canli $B >/dev/null 2>&1; rc=$?
dogru "canlı: migration yeni sürümle, sonra api, sonra web" "[ $rc -eq 0 ] && [ \"\$(olay)\" = 'migrate migrate bbbbbbbbbbbb,up api bbbbbbbbbbbb,up web bbbbbbbbbbbb-prod,' ]"
hazirla $A $B ""; touch "$T/migrate_hata"
out="$(bash "$YAYIN" --migrate staging $C 2>&1)"; rc=$?
dogru "migration hatası: rc=1, conf ve servisler eski, up çağrılmadı" "[ $rc -eq 1 ] && [ \"\$(conf BEAUTYOS_STAGING_VERSION)\" = $B ] && ! grep -q '^up' $T/olay && grep -qx 'api-staging=$B' $T/calisan"
dogru "hata nedeni (compose son satırları) gösterilir" "grep -q 'compose: migration hatasi' <<<\"\$out\""
hazirla $A $B ""
bash "$YAYIN" staging $C >/dev/null 2>&1
dogru "--migrate yoksa migration çalışmaz" "! grep -q '^migrate' $T/olay"

echo
echo "Sonuç: $BAS geçti, $HATA kaldı"
[ "$HATA" -eq 0 ]
