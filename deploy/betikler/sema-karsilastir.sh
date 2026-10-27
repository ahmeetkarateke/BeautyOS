#!/usr/bin/env bash
# BeautyOS şema uyum kontrolü (ADR-0017): Supabase'deki canlı şema, depodaki migration'larla kurulan şemayla aynı mı?
# Veri TAŞINMAZ ve HİÇBİR uygulama tablosundan satır okunmaz; yalnız şema dökümü, _prisma_migrations kayıtları ve katalog sayıları.
#
# Kullanım:  sema-karsilastir.sh <alt-komut>
#   kaynak       (yalnız kurucu) Supabase'e libpq env-file ile bağlanıp sema-kaynak.sql, migrations-kaynak.txt, kaynak-bilgi.txt üretir.
#   hedef        Geçici postgres:17 + geçici --internal ağ + api imajıyla `prisma migrate deploy`; sema-hedef.sql ve
#                migrations-hedef.txt üretir. API imajı BEAUTYOS_API_IMAGE ile verilir (gizli bilgi gerekmez).
#   karsilastir  İki dökümü normalleştirip diff -u alır -> sema-fark.txt. Fark yoksa 0, varsa 1.
# Çıktılar BEAUTYOS_DIR/tasima altındadır (dizin 700, dosyalar 600) ve kişisel veri içermez.
# Kaynak bağlantısı yalnız --env-file ile (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE) konteynere girer;
# betikte, argümanlarda ve çıktıda bağlantı bilgisi yoktur.
# Ortam (yalnız test için): BEAUTYOS_DIR, BEAUTYOS_ENV_KAYNAK, BEAUTYOS_KAYNAK_AG.
set -euo pipefail

BASE="${BEAUTYOS_DIR:-/srv/beautyos}"
TASIMA="$BASE/tasima"
ENV_KAYNAK="${BEAUTYOS_ENV_KAYNAK:-$BASE/.env.supabase}"
KAYNAK_AG="${BEAUTYOS_KAYNAK_AG:-}"
PG_IMAGE="postgres:17.11-bookworm"
PG_ANA_SURUM=17
# Şema dökümü her iki tarafta da aynı bayraklarla alınır; veri bayrağı (--data-only, --inserts, ...) yoktur.
PG_DUMP_BAYRAKLARI=(--schema-only --schema=public --no-owner --no-privileges --no-publications --no-subscriptions)

kullanim() {
  echo "Kullanım: sema-karsilastir.sh <kaynak | hedef | karsilastir>" >&2
}

hata() { echo "HATA: $*" >&2; }

hazirla_dizin() {
  umask 077
  mkdir -p "$TASIMA"
  chmod 700 "$TASIMA"
}

# ─── Kaynak (Supabase) erişimi ─────────────────────────────────────────────────
kaynak_docker_kur() {
  [ -f "$ENV_KAYNAK" ] || { hata "kaynak bağlantı dosyası yok: $ENV_KAYNAK"; exit 1; }
  KAYNAK_DOCKER=(docker run --rm -i --env-file "$ENV_KAYNAK" --user "$(id -u):$(id -g)")
  if [ -n "$KAYNAK_AG" ]; then
    KAYNAK_DOCKER+=(--network "$KAYNAK_AG")
  fi

  # Önce salt okunur oturumla dene (yazma girişimi sunucuda reddedilir). Bazı havuzlayıcılar (Supabase Supavisor)
  # "options" başlangıç parametresini kabul etmeyebilir; o zaman PGOPTIONS'suz denenir ve durum açıkça yazılır.
  # Betiğin tüm sorguları zaten yalnız SELECT'tir ve pg_dump salt okunur işlemle çalışır.
  local salt_okunur=(-e "PGOPTIONS=-c default_transaction_read_only=on")
  if "${KAYNAK_DOCKER[@]}" "${salt_okunur[@]}" "$PG_IMAGE" psql -X -At -c 'SELECT 1' >/dev/null 2>&1; then
    KAYNAK_DOCKER+=("${salt_okunur[@]}")
    echo "Bağlantı: salt okunur oturum (default_transaction_read_only=on) etkin."
  elif "${KAYNAK_DOCKER[@]}" "$PG_IMAGE" psql -X -At -c 'SELECT 1' >/dev/null 2>&1; then
    echo "UYARI: kaynak PGOPTIONS (salt okunur oturum) kabul etmiyor; PGOPTIONS'suz devam ediliyor." >&2
    echo "       Betik yalnız SELECT ve pg_dump --schema-only çalıştırır; yazma yapmaz." >&2
  else
    hata "kaynağa bağlanılamadı (.env.supabase değerleri, Session pooler 5432 ve ağ erişimini kontrol edin)"
    exit 1
  fi
}

# ─── SQL: yalnız katalog tabloları ve _prisma_migrations ──────────────────────
migrations_sql() {
  cat <<'SQL'
SELECT migration_name || '|' || checksum || '|' ||
  CASE WHEN rolled_back_at IS NOT NULL THEN 'geri-alindi'
       WHEN finished_at IS NOT NULL THEN 'bitti'
       ELSE 'yarim' END
FROM _prisma_migrations ORDER BY migration_name;
SQL
}

bilgi_sql() {
  cat <<'SQL'
SELECT 'surum|' || current_setting('server_version');
SELECT 'uzantilar|' || coalesce(string_agg(extname || ' ' || extversion, ', ' ORDER BY extname), '') FROM pg_extension;
SELECT 'rls_tablolari|' || coalesce(string_agg(c.relname, ',' ORDER BY c.relname), '')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity;
SELECT 'politikalar|' || coalesce(string_agg(tablename || '.' || policyname, ',' ORDER BY tablename, policyname), '')
  FROM pg_policies WHERE schemaname = 'public';
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
SQL
}

# ─── kaynak ──────────────────────────────────────────────────────────────────────
komut_kaynak() {
  hazirla_dizin
  kaynak_docker_kur
  local psql=("${KAYNAK_DOCKER[@]}" "$PG_IMAGE" psql -X -At -v ON_ERROR_STOP=1 -F '|')

  # pg_dump istemcisi (17) kaynaktan eski olamaz; daha yeni bir kaynak sürümde döküm anlamsız hatayla düşerdi.
  local surum_no
  surum_no="$("${psql[@]}" -c 'SHOW server_version_num')"
  if [ $((surum_no / 10000)) -gt "$PG_ANA_SURUM" ]; then
    hata "kaynak sürüm $((surum_no / 10000)) > $PG_ANA_SURUM; pg_dump imajı güncellenmeli"
    exit 1
  fi

  "${psql[@]}" < <(bilgi_sql) >"$TASIMA/kaynak-bilgi.txt"
  "${psql[@]}" < <(migrations_sql) >"$TASIMA/migrations-kaynak.txt"
  # pg_dump kaynağın sürümünden eski olamaz; yeni istemci eski sunucuyu okuyabilir. Dökümde yalnız şema vardır.
  "${KAYNAK_DOCKER[@]}" -v "$TASIMA:/tasima" "$PG_IMAGE" \
    pg_dump "${PG_DUMP_BAYRAKLARI[@]}" -f /tasima/sema-kaynak.sql
  chmod 600 "$TASIMA"/kaynak-bilgi.txt "$TASIMA"/migrations-kaynak.txt "$TASIMA"/sema-kaynak.sql

  echo "── Kaynak bilgisi ──"
  sed 's/^/  /' "$TASIMA/kaynak-bilgi.txt"
  echo "Migration kaydı: $(wc -l <"$TASIMA/migrations-kaynak.txt") · şema dökümü: $(wc -l <"$TASIMA/sema-kaynak.sql") satır"
  echo "Dosyalar: $TASIMA/{sema-kaynak.sql,migrations-kaynak.txt,kaynak-bilgi.txt}"
}

# ─── hedef ───────────────────────────────────────────────────────────────────────
hedef_temizle() {
  docker rm -f "$HEDEF_AD" >/dev/null 2>&1 || true
  docker network rm "$HEDEF_AD" >/dev/null 2>&1 || true
}

komut_hedef() {
  if [ -z "${BEAUTYOS_API_IMAGE:-}" ]; then
    hata "BEAUTYOS_API_IMAGE tanımlı olmalı (örn. ghcr.io/ahmeetkarateke/beautyos-api:<sha12>)"
    exit 1
  fi
  hazirla_dizin
  HEDEF_AD="beautyos-sema-$$"
  trap hedef_temizle EXIT

  # Rastgele geçici parola; yalnız bu çalıştırma için, ortam değişkeni olarak (komut satırında değer yok).
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  export POSTGRES_PASSWORD
  # --internal: ara ağdan dışarı çıkış yok. tmpfs: veri diske yazılmaz, konteyner silinince yok olur.
  docker network create --internal "$HEDEF_AD" >/dev/null
  docker run -d --name "$HEDEF_AD" --network "$HEDEF_AD" --tmpfs /var/lib/postgresql/data --shm-size=128m \
    -e POSTGRES_PASSWORD "$PG_IMAGE" >/dev/null

  local bekle=0 hazir=0
  while [ "$bekle" -lt 90 ]; do
    hazir="$(docker logs "$HEDEF_AD" 2>&1 | grep -c 'database system is ready to accept connections' || true)"
    if [ "$hazir" -ge 2 ]; then break; fi
    sleep 1
    bekle=$((bekle + 1))
  done
  [ "$hazir" -ge 2 ] || { hata "geçici postgres hazır olmadı"; exit 1; }

  DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@${HEDEF_AD}:5432/postgres"
  DIRECT_URL="$DATABASE_URL"
  export DATABASE_URL DIRECT_URL
  echo "Migration'lar boş geçici veritabanına uygulanıyor..."
  docker run --rm --network "$HEDEF_AD" --read-only --tmpfs /tmp -e HOME=/tmp -e DATABASE_URL -e DIRECT_URL \
    "$BEAUTYOS_API_IMAGE" node_modules/.bin/prisma migrate deploy >/dev/null

  docker exec -i "$HEDEF_AD" psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -F '|' \
    < <(migrations_sql) >"$TASIMA/migrations-hedef.txt"
  docker exec "$HEDEF_AD" pg_dump -U postgres -d postgres "${PG_DUMP_BAYRAKLARI[@]}" >"$TASIMA/sema-hedef.sql"
  chmod 600 "$TASIMA"/migrations-hedef.txt "$TASIMA"/sema-hedef.sql
  echo "Migration kaydı: $(wc -l <"$TASIMA/migrations-hedef.txt") · şema dökümü: $(wc -l <"$TASIMA/sema-hedef.sql") satır"
  echo "Dosyalar: $TASIMA/{sema-hedef.sql,migrations-hedef.txt}"
}

# ─── karsilastir ─────────────────────────────────────────────────────────────────
# Normalleştirme kuralları (her biri gerekçeli; yalnız anlamsız gürültü atılır, nesne tanımı atılmaz):
#  1. "--" ile başlayan satırlar: pg_dump başlığı (istemci/sunucu sürümü, tarih) ve "-- Name: ..." açıklamaları iki tarafta farklıdır.
#  2. "SET ..." ve set_config: oturum ayarları (search_path, default_table_access_method) sürüme ve oturuma bağlıdır, şemayı tanımlamaz.
#  3. \restrict / \unrestrict: pg_dump 17.6+ her çalıştırmada rastgele bir anahtar yazar; içerik değildir.
#  4. COMMENT ON SCHEMA public 'standard public schema': PG 14 ve öncesi sunucular bunu yazar, 15+ yazmaz (ana sürüm farkı).
#  5. Boş satırlar: biçim farkıdır.
normalle() {
  sed -E \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog\.set_config/d' \
    -e '/^\\(un)?restrict /d' \
    -e "/^COMMENT ON SCHEMA public IS 'standard public schema';\$/d" \
    -e '/^[[:space:]]*$/d' \
    "$1"
}

komut_karsilastir() {
  hazirla_dizin
  local f durum=0 fark="$TASIMA/sema-fark.txt" gecici
  for f in sema-kaynak.sql sema-hedef.sql migrations-kaynak.txt migrations-hedef.txt; do
    [ -f "$TASIMA/$f" ] || { hata "$f yok; önce 'kaynak' ve 'hedef' çalıştırılmalı"; exit 1; }
  done
  gecici="$(mktemp -d "$TASIMA/karsilastir.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -r '$gecici'" EXIT
  normalle "$TASIMA/sema-kaynak.sql" >"$gecici/kaynak.sql"
  normalle "$TASIMA/sema-hedef.sql" >"$gecici/hedef.sql"

  : >"$fark"
  chmod 600 "$fark"
  {
    echo "### Şema farkı (- kaynak/Supabase, + hedef/migration'larla kurulan)"
    diff -u --label kaynak --label hedef "$gecici/kaynak.sql" "$gecici/hedef.sql" || durum=1
    echo "### Migration listesi farkı (ad|checksum|durum)"
    diff -u --label kaynak --label hedef "$TASIMA/migrations-kaynak.txt" "$TASIMA/migrations-hedef.txt" || durum=1
  } >>"$fark"

  echo "── Kaynak bilgisi ──"
  if [ -f "$TASIMA/kaynak-bilgi.txt" ]; then sed 's/^/  /' "$TASIMA/kaynak-bilgi.txt"; fi
  if [ "$durum" -eq 0 ]; then
    echo "SONUÇ: FARK YOK (şema ve migration listesi eşit)"
  else
    echo "SONUÇ: FARK VAR ($(grep -c '^[-+][^-+]' "$fark" || true) farklı satır) · ayrıntı: $fark" >&2
    grep '^[-+]' "$fark" | head -n 40 | sed 's/^/  /' >&2 || true
  fi
  return "$durum"
}

main() {
  local komut="${1:-}"
  case "$komut" in
    kaynak) komut_kaynak ;;
    hedef) komut_hedef ;;
    karsilastir) komut_karsilastir ;;
    *) kullanim; exit 2 ;;
  esac
}

main "$@"
