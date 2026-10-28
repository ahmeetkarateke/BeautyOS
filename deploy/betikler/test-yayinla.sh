#!/usr/bin/env bash
# yayinla.sh testi: gerçek Docker/ağ kullanılmaz; PATH'e sahte docker, flock, curl, sleep konur.
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
for a in "$@"; do u="$a"; done
case "$u" in
  *yeni-api*|*api.beautyossapp*) echo 200 ;;
  *yeni.*) echo 401 ;;
  *) echo 200 ;;
esac
EOF
cat >"$T/bin/docker" <<'EOF'
#!/bin/bash
# Durum: $FAKE/calisan (servis=etiket), $FAKE/olay (komut günlüğü), $FAKE/bozuk (sağlıksız etiket), $FAKE/imajsiz
F="$FAKE"
if [ "$1" = image ] && [ "$2" = inspect ]; then
  grep -qxF "$3" "$F/imajsiz" 2>/dev/null && exit 1
  exit 0
fi
if [ "$1" = inspect ]; then
  svc="${*: -1}"; svc="${svc#id-}"
  tag="$(awk -F= -v s="$svc" '$1==s{print $2}' "$F/calisan")"
  if [ -n "$tag" ] && [ "$tag" = "$(cat "$F/bozuk" 2>/dev/null)" ]; then echo unhealthy; else echo healthy; fi
  exit 0
fi
[ "$1" = compose ] || exit 1
shift
envdosyalari=()
while [ $# -gt 0 ]; do
  case "$1" in
    -p|-f) shift 2 ;;
    --env-file) envdosyalari+=("$2"); shift 2 ;;
    *) break ;;
  esac
done
alt="$1"; shift
ver() { # ver <ANAHTAR>: son env dosyası kazanır
  local k="$1" v="" d x
  for d in "${envdosyalari[@]}"; do
    x="$(awk -F= -v k="$k" '$1==k{print substr($0,length(k)+2)}' "$d" 2>/dev/null | tail -n1)"
    [ -n "$x" ] && v="$x"
  done
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

hazirla() { # hazirla <canli> <staging> <onceki> [env satırı]
  : >"$T/olay"; : >"$T/imajsiz"; : >"$T/bozuk"
  printf '%s\n' "api=beautyos-api:$1" >/dev/null
  printf '%s\n' "api=$1" "web=$1-prod" "api-staging=$2" "web-staging=$2-staging" >"$T/calisan"
  : >"$T/base/compose.yml"
  # .env'de ESKİ sürüm satırları var (surum.conf'un üstüne yazması kanıtlanır); gizli değer YOK
  printf '%s\n' "BEAUTYOS_VERSION=000000000000" "BEAUTYOS_STAGING_VERSION=000000000000" >"$T/base/.env"
  printf '%s\n' "BEAUTYOS_VERSION=$1" "BEAUTYOS_STAGING_VERSION=$2" "BEAUTYOS_PREVIOUS_VERSION=$3" >"$T/base/surum.conf"
  rm -f "$T/base/yayinla.log"
}
conf() { awk -F= -v k="$1" '$1==k{print substr($0,length(k)+2)}' "$T/base/surum.conf"; }

A=aaaaaaaaaaaa; B=bbbbbbbbbbbb; C=cccccccccccc

echo "V1 staging başarılı: önce api sonra web, canlıya dokunulmaz"
hazirla $A $B ""
out="$(bash "$YAYIN" staging $C 2>&1)"; rc=$?
dogru "rc=0" "[ $rc -eq 0 ]"
dogru "sıra api-staging -> web-staging" "[ \"\$(cat $T/olay | tr '\n' ,)\" = 'up api-staging cccccccccccc,up web-staging cccccccccccc-staging,' ]"
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
dogru "sıra api sonra web" "[ \"\$(cat $T/olay | tr '\n' ,)\" = 'up api bbbbbbbbbbbb,up web bbbbbbbbbbbb-prod,' ]"

echo "V5 canlı web sağlıksız: api ve web birlikte eski etikete döner"
hazirla $A $B "$C"; echo "$B-prod" >"$T/bozuk"
# sağlıksız tespiti etikete göre: web için etiket tam '-prod'lu; sahte inspect yalnız servis etiketini karşılaştırır
echo "web=$B-prod" >/dev/null
printf '%s\n' "$B-prod" >"$T/bozuk"
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

echo "V8 .env'deki eski satır surum.conf'u ezmez (config imajları surum.conf'tan)"
hazirla $A $B ""
out="$(bash "$YAYIN" --kuru staging $C 2>&1)"
dogru "config api-staging etiketi surum.conf'tan" "grep -q 'api-staging beautyos-api:$B' <<<\"\$out\""

echo "V9 geçersiz girdi"
hazirla $A $B ""
bash "$YAYIN" staging ABC >/dev/null 2>&1; dogru "kısa sürüm rc=2" "[ $? -eq 2 ]"
bash "$YAYIN" test $C >/dev/null 2>&1; dogru "bilinmeyen ortam rc=2" "[ $? -eq 2 ]"
bash "$YAYIN" staging $B >/dev/null 2>&1; dogru "zaten bu sürümde rc=2" "[ $? -eq 2 ]"

echo
echo "Sonuç: $BAS geçti, $HATA kaldı"
[ "$HATA" -eq 0 ]
