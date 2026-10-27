#!/usr/bin/env bash
# BeautyOS veri taşıma: kaynak (Supabase) -> şirket sunucusundaki Postgres 17.
# Kullanım:  veri-aktar.sh <alt-komut> [argüman]
#   on-kontrol                 Kaynağa yalnız OKUR: sürüm, RLS/politika, auth./storage./extensions. bağımlılığı, sayımlar.
#   dok                        Kaynaktan pg_dump -Fc (yalnız public) -> tasima/dok-<zaman>.dump
#   yukle <hedef> [dosya]      Boş hedefe yükler (dosya verilmezse en yeni dok-*.dump). Hedef: canli | staging | konteyner:<ad>
#   yedekten-ac <dosya>        Panelden indirilen küme yedeğini (düz SQL, .gz olabilir) geçici ağsız ara konteynerde açar,
#                              denetler, public şemasının -Fc dökümünü üretir.
# Kaynak bağlantısı yalnız libpq değişkenleri olarak --env-file ile konteynere girer (PGHOST, PGPORT, PGUSER, PGPASSWORD,
# PGDATABASE, PGSSLMODE). Betikte, argümanlarda ve çıktıda bağlantı bilgisi ya da satır içeriği yoktur: yalnız sayılar ve özetler.
# Ortam (yalnız test için): BEAUTYOS_DIR, BEAUTYOS_ENV_KAYNAK, BEAUTYOS_KAYNAK_AG, BEAUTYOS_HEDEF_DB, BEAUTYOS_HEDEF_SAHIP.
set -euo pipefail

BASE="${BEAUTYOS_DIR:-/srv/beautyos}"
TASIMA="$BASE/tasima"
ENV_KAYNAK="${BEAUTYOS_ENV_KAYNAK:-$BASE/.env.supabase}"
KAYNAK_AG="${BEAUTYOS_KAYNAK_AG:-}"
PG_IMAGE="postgres:17.11-bookworm"
PG_ANA_SURUM=17
DIGEST_TABLOLARI=(tenants users customers appointments)

kullanim() {
  cat >&2 <<'EOF'
Kullanım: veri-aktar.sh <on-kontrol | dok | yukle <hedef> [dosya] | yedekten-ac <dosya>>
  hedef: canli | staging | konteyner:<ad>
EOF
}

hata() { echo "HATA: $*" >&2; }

hazirla_dizin() {
  umask 077
  mkdir -p "$TASIMA"
  chmod 700 "$TASIMA"
}

zaman() { date -u +%Y%m%dT%H%M%SZ; }

# ─── Kaynak/ara konteyner üzerinde psql çalıştırıcıları ────────────────────────
# PSQL_KAYNAK dizisi: stdin'den SQL okuyan, "anahtar|değer" satırları üreten komut.
kaynak_psql_kur() {
  [ -f "$ENV_KAYNAK" ] || { hata "kaynak bağlantı dosyası yok: $ENV_KAYNAK"; exit 1; }
  PSQL_KAYNAK=(docker run --rm -i --env-file "$ENV_KAYNAK" --user "$(id -u):$(id -g)")
  if [ -n "$KAYNAK_AG" ]; then
    PSQL_KAYNAK+=(--network "$KAYNAK_AG")
  fi
  PSQL_KAYNAK+=("$PG_IMAGE" psql -X -At -v ON_ERROR_STOP=1 -F '|')
}

# ─── SQL: denetimler ve sayımlar (yalnız sayı ve özet döndürür) ────────────────
kontrol_sql() {
  cat <<'SQL'
SELECT 'surum|' || current_setting('server_version_num')::int / 10000;
SELECT 'rls_tablo|' || count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity;
SELECT 'politika|' || count(*) FROM pg_policies WHERE schemaname = 'public';
SELECT 'varsayilan_bagimlilik|' || count(*) FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
  WHERE c.relnamespace = 'public'::regnamespace AND pg_get_expr(d.adbin, d.adrelid) ~ '\m(auth|storage|extensions)\.';
SELECT 'yabanci_anahtar|' || count(*) FROM pg_constraint k JOIN pg_class r ON r.oid = k.confrelid
  WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace
    AND r.relnamespace::regnamespace::text IN ('auth', 'storage', 'extensions');
SELECT 'fonksiyon_bagimlilik|' || count(*) FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p') AND p.prosrc ~ '\m(auth|storage|extensions)\.';
SELECT 'gorunum_bagimlilik|' || count(*) FROM pg_views
  WHERE schemaname = 'public' AND definition ~ '\m(auth|storage|extensions)\.';
SELECT 'tetikleyici|' || count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace;
SELECT 'uzantilar|' || coalesce(string_agg(extname, ',' ORDER BY extname), '') FROM pg_extension;
SQL
}

sayim_sql() {
  cat <<'SQL'
SELECT 'satir|' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
SQL
  local t
  for t in "${DIGEST_TABLOLARI[@]}"; do
    printf "SELECT 'ozet|%s|' || coalesce(md5(string_agg(id::text, ',' ORDER BY id)), 'bos') FROM public.%s;\n" "$t" "$t"
  done
}

# kontrol_calistir <etiket>: PSQL_KAYNAK ile denetimleri koşar, sayım dosyasını yazar, ihlalde 1 döner.
kontrol_calistir() {
  local etiket="$1" cikti sayim durum=0 satir anahtar deger
  cikti="$("${PSQL_KAYNAK[@]}" < <(kontrol_sql))" || { hata "denetim sorguları çalışmadı"; return 1; }
  echo "── Denetimler (${etiket}) ──"
  while IFS='|' read -r anahtar deger; do
    printf '  %-24s %s\n' "$anahtar" "$deger"
    case "$anahtar" in
      surum) [ "$deger" -le "$PG_ANA_SURUM" ] || { hata "kaynak sürüm $deger > $PG_ANA_SURUM"; durum=1; } ;;
      rls_tablo | politika | varsayilan_bagimlilik | yabanci_anahtar | fonksiyon_bagimlilik | gorunum_bagimlilik)
        [ "$deger" -eq 0 ] || { hata "$anahtar = $deger (0 olmalı)"; durum=1; } ;;
      *) ;;
    esac
  done <<<"$cikti"

  sayim="$TASIMA/sayim-${etiket}-$(zaman).txt"
  "${PSQL_KAYNAK[@]}" < <(sayim_sql) >"$sayim" || { hata "sayım sorguları çalışmadı"; return 1; }
  chmod 600 "$sayim"
  satir="$(grep -c '^satir|' "$sayim" || true)"
  echo "── Sayım ── tablo: $satir · dosya: $sayim"
  grep '^ozet|' "$sayim" | sed 's/^/  /'
  return "$durum"
}

# ─── Alt komutlar ───────────────────────────────────────────────────────────────
komut_on_kontrol() {
  hazirla_dizin
  kaynak_psql_kur
  kontrol_calistir kaynak
}

komut_dok() {
  hazirla_dizin
  [ -f "$ENV_KAYNAK" ] || { hata "kaynak bağlantı dosyası yok: $ENV_KAYNAK"; exit 1; }
  local dosya ag=()
  dosya="dok-$(zaman).dump"
  if [ -n "$KAYNAK_AG" ]; then ag=(--network "$KAYNAK_AG"); fi
  docker run --rm --env-file "$ENV_KAYNAK" --user "$(id -u):$(id -g)" "${ag[@]}" -v "$TASIMA:/tasima" "$PG_IMAGE" \
    pg_dump -Fc --schema=public --no-owner --no-privileges -f "/tasima/$dosya"
  chmod 600 "$TASIMA/$dosya"
  echo "Döküm yazıldı: $TASIMA/$dosya ($(du -h "$TASIMA/$dosya" | cut -f1))"
}

# hedef_coz <hedef>: HEDEF_KAP, HEDEF_DB, HEDEF_SAHIP, HEDEF_UYGULAMA ayarlar (sonuncusunu veri-dogrula.sh kullanır).
# shellcheck disable=SC2034
hedef_coz() {
  case "$1" in
    canli)
      HEDEF_KAP="$(docker compose -f "$BASE/compose.yml" -p beautyos ps -q postgres)"
      HEDEF_DB=beautyos; HEDEF_SAHIP=app_owner; HEDEF_UYGULAMA=app_user ;;
    staging)
      HEDEF_KAP="$(docker compose -f "$BASE/compose.yml" -p beautyos ps -q postgres)"
      HEDEF_DB=beautyos_staging; HEDEF_SAHIP=stg_owner; HEDEF_UYGULAMA=stg_user ;;
    konteyner:?*)
      HEDEF_KAP="${1#konteyner:}"
      HEDEF_DB="${BEAUTYOS_HEDEF_DB:-beautyos}"
      HEDEF_SAHIP="${BEAUTYOS_HEDEF_SAHIP:-app_owner}"
      HEDEF_UYGULAMA="${BEAUTYOS_HEDEF_UYGULAMA:-app_user}" ;;
    *) hata "bilinmeyen hedef: $1"; kullanim; exit 2 ;;
  esac
  [ -n "$HEDEF_KAP" ] || { hata "hedef postgres konteyneri bulunamadı ($1)"; exit 1; }
}

# hedef_psql <psql argümanları...>: hedef konteynerde süper kullanıcıyla yerel soketten çalışır.
hedef_psql() {
  docker exec -i "$HEDEF_KAP" sh -c 'exec psql -U "$POSTGRES_USER" -X -At -v ON_ERROR_STOP=1 -F "|" "$@"' sh "$@"
}

komut_yukle() {
  [ $# -ge 1 ] || { kullanim; exit 2; }
  hazirla_dizin
  hedef_coz "$1"
  local dosya="${2:-}" tablolar
  if [ -z "$dosya" ]; then
    # shellcheck disable=SC2012
    dosya="$(ls -t "$TASIMA"/dok-*.dump 2>/dev/null | head -n 1 || true)"
  fi
  if [ -z "$dosya" ] || [ ! -f "$dosya" ]; then
    hata "yüklenecek döküm bulunamadı"
    exit 1
  fi

  tablolar="$(hedef_psql -d "$HEDEF_DB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  if [ "$tablolar" != "0" ]; then
    hata "hedef boş değil (public'te $tablolar tablo); yükleme yapılmadı"
    exit 1
  fi

  # Geçici dosyalar hedef konteynerin /tmp'sindedir (tmpfs); iş bitince her durumda silinir.
  trap 'docker exec "$HEDEF_KAP" rm -f /tmp/veri.dump /tmp/veri.list >/dev/null 2>&1 || true' EXIT
  docker exec -i "$HEDEF_KAP" sh -c 'cat > /tmp/veri.dump' <"$dosya"
  docker exec "$HEDEF_KAP" sh -c "pg_restore -l /tmp/veri.dump | awk '!/ SCHEMA - public /' > /tmp/veri.list"
  docker exec "$HEDEF_KAP" sh -c \
    'exec pg_restore -U "$POSTGRES_USER" -d "$1" --single-transaction --exit-on-error --no-owner --role="$2" -L /tmp/veri.list /tmp/veri.dump' \
    sh "$HEDEF_DB" "$HEDEF_SAHIP"
  hedef_psql -d "$HEDEF_DB" -c 'ANALYZE'
  tablolar="$(hedef_psql -d "$HEDEF_DB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  echo "Yükleme tamam: hedef=$1 veritabanı=$HEDEF_DB tablo=$tablolar"
}

# ─── yedekten-ac: ara konteyner ─────────────────────────────────────────────────
dosya_gzip_mi() { [ "$(head -c 2 -- "$1" | od -An -tx1 | tr -d ' \n')" = "1f8b" ]; }

dosya_oku() {
  if dosya_gzip_mi "$1"; then gzip -dc -- "$1"; else cat -- "$1"; fi
}

# Yalnız ilk 120 satırdan "Dumped from database version N[.M]" başlığını okur.
dosya_surumu() {
  local satir
  satir="$( { dosya_oku "$1" 2>/dev/null || true; } | awk '
    NR > 120 { exit }
    /^-- Dumped from database version/ { if (match($0, /version [0-9]+/)) print substr($0, RSTART + 8, RLENGTH - 8); exit }' || true)"
  printf '%s' "$satir"
}

ara_temizle() {
  docker rm -f "$ARA_AD" >/dev/null 2>&1 || true
  docker volume rm "$ARA_AD" >/dev/null 2>&1 || true
}

# Ara konteyner günlüğündeki hataları sınıflandırır; yalnız sayı ve nesne adı yazar. public hatası varsa 1 döner.
ara_hatalari_degerlendir() {
  local ozet toplam yetki public_hata
  ozet="$(docker logs "$ARA_AD" 2>&1 | awk '
    / ERROR:  / { toplam++ }
    /STATEMENT:  / {
      s = $0; sub(/^.*STATEMENT:  /, "", s)
      if (s ~ /^(ALTER .* OWNER TO|GRANT |REVOKE |ALTER DEFAULT PRIVILEGES|COMMENT ON)/) { if (s ~ /public/) yetki++; next }
      if (s ~ /(^|[^A-Za-z0-9_])public\./ || s ~ /SCHEMA public/) {
        public_hata++
        tur = s; n = split(s, w, " "); tur = w[1] (n > 1 ? " " w[2] : "")
        nesne = ""; if (match(s, /public\.[A-Za-z0-9_"]+/)) nesne = substr(s, RSTART, RLENGTH)
        print "PUBLIC_HATA " tur " " nesne
      }
    }
    END { print "TOPLAM " toplam + 0; print "YETKI " yetki + 0; print "PUBLIC " public_hata + 0 }')"
  toplam="$(awk '$1=="TOPLAM"{print $2}' <<<"$ozet")"
  yetki="$(awk '$1=="YETKI"{print $2}' <<<"$ozet")"
  public_hata="$(awk '$1=="PUBLIC"{print $2}' <<<"$ozet")"
  echo "── Yükleme hataları ── toplam: $toplam · public dışı/önemsiz beklenen: $((toplam - public_hata)) · atılan sahiplik/yetki: $yetki · PUBLIC: $public_hata"
  if [ "$public_hata" -gt 0 ]; then
    grep '^PUBLIC_HATA' <<<"$ozet" | head -n 20 | sed 's/^/  /' >&2 || true
    hata "public nesnelerinde yükleme hatası var; devam edilmiyor"
    return 1
  fi
}

komut_yedekten_ac() {
  [ $# -eq 1 ] || { kullanim; exit 2; }
  local dosya="$1" surum zaman_damgasi cikti
  [ -f "$dosya" ] || { hata "dosya yok: $dosya"; exit 1; }
  hazirla_dizin

  surum="$(dosya_surumu "$dosya")"
  case "$surum" in
    '' | *[!0-9]*) hata "dosya başlığında 'Dumped from database version' bulunamadı"; exit 1 ;;
    *) ;;
  esac
  if [ "$surum" -gt "$PG_ANA_SURUM" ]; then
    hata "kaynak sürüm $surum > $PG_ANA_SURUM; hedef bu sürümü yükleyemez"
    exit 1
  fi
  echo "Kaynak sürüm (dosya başlığından): $surum"

  local imaj="postgres:${surum}-bookworm"
  if [ "$surum" = "$PG_ANA_SURUM" ]; then imaj="$PG_IMAGE"; fi
  ARA_AD="beautyos-ara-$$"
  trap ara_temizle EXIT

  # Ağsız: kişisel veri ara konteynerden dışarı çıkamaz. Kimlik doğrulama gerekmez (yalnız bu konteynerin soketi).
  docker run -d --name "$ARA_AD" --network none -e POSTGRES_HOST_AUTH_METHOD=trust \
    -v "$ARA_AD:/var/lib/postgresql/data" --shm-size=256m "$imaj" >/dev/null
  local bekle=0 hazir=0
  while [ "$bekle" -lt 90 ]; do
    hazir="$(docker logs "$ARA_AD" 2>&1 | grep -c 'database system is ready to accept connections' || true)"
    if [ "$hazir" -ge 2 ]; then break; fi
    sleep 1; bekle=$((bekle + 1))
  done
  [ "$hazir" -ge 2 ] || { hata "ara konteyner hazır olmadı"; exit 1; }

  echo "Yedek ara konteynere yükleniyor (hatalar sayılır, durdurulmaz)..."
  dosya_oku "$dosya" | docker exec -i "$ARA_AD" psql -U postgres -X -q -d postgres -v ON_ERROR_STOP=0 -f - >/dev/null 2>&1 || true
  ara_hatalari_degerlendir || exit 1

  PSQL_KAYNAK=(docker exec -i "$ARA_AD" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -F '|')
  kontrol_calistir yedek || exit 1

  zaman_damgasi="$(zaman)"
  cikti="$TASIMA/dok-${zaman_damgasi}.dump"
  docker exec "$ARA_AD" pg_dump -U postgres -d postgres -Fc --schema=public --no-owner --no-privileges >"$cikti"
  chmod 600 "$cikti"
  echo "Döküm yazıldı: $cikti ($(du -h "$cikti" | cut -f1))"

  # Düz SQL yedeğinde kişisel veri vardır; kopya yalnız iş başarıyla bittiğinde silinir. Hata durumunda
  # sunucudaki dosya tek kopya olabileceğinden (kurucu bilgisayarından siliyor) korunur.
  rm -f -- "$dosya"
  echo "Düz SQL yedeği silindi. Ara konteyner ve volume temizleniyor."
}

main() {
  local komut="${1:-}"
  [ $# -gt 0 ] && shift
  case "$komut" in
    on-kontrol) komut_on_kontrol ;;
    dok) komut_dok ;;
    yukle) komut_yukle "$@" ;;
    yedekten-ac) komut_yedekten_ac "$@" ;;
    *) kullanim; exit 2 ;;
  esac
}

# veri-dogrula.sh bu dosyayı "source" eder; doğrudan çalıştırılırsa main çalışır.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
