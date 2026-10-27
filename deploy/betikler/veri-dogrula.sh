#!/usr/bin/env bash
# BeautyOS veri taşıma doğrulaması: kaynak sayımı ile hedef eşit mi?
# Kullanım:  veri-dogrula.sh <hedef> [--bos-mu] [--sayim <dosya>]
#   hedef:     canli | staging | konteyner:<ad>   (veri-aktar.sh yukle ile aynı)
#   --bos-mu   yalnız hedefin public şemasının boş olduğunu denetler (yukle öncesi); boşsa 0, değilse 1.
#   --sayim    karşılaştırılacak kaynak sayım dosyası (varsayılan: tasima/ altındaki en yeni sayim-*.txt).
# Denetler: tablo başına satır sayısı, tenants/users/customers/appointments kimlik özeti, prisma migration durumu,
# uygulama rolünün süper kullanıcı olmaması ve RLS'yi atlayamaması. Fark varsa tabloyu adlandırarak 1 ile çıkar.
# Çıktıda satır içeriği yoktur: yalnız tablo adları, sayılar ve özetler.
set -euo pipefail

BETIK_DIZINI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=veri-aktar.sh
source "$BETIK_DIZINI/veri-aktar.sh"

kullanim_dogrula() {
  echo "Kullanım: veri-dogrula.sh <canli|staging|konteyner:<ad>> [--bos-mu] [--sayim <dosya>]" >&2
}

hedef_tablo_sayisi() {
  hedef_psql -d "$HEDEF_DB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
}

# Kaynak ve hedef sayımlarını anahtar (satir|tablo, ozet|tablo) bazında karşılaştırır; farklı anahtarları yazar.
sayim_karsilastir() {
  local kaynak="$1" hedef="$2"
  awk -F'|' '
    NR == FNR { k[$1 "|" $2] = $3; next }
    { h[$1 "|" $2] = $3 }
    END {
      fark = 0
      for (a in k) {
        if (!(a in h)) { print "EKSIK   " a " (hedefte yok)"; fark++ }
        else if (k[a] != h[a]) { print "FARKLI  " a " kaynak=" k[a] " hedef=" h[a]; fark++ }
      }
      for (a in h) if (!(a in k)) { print "FAZLA   " a " (kaynakta yok)"; fark++ }
      exit fark > 0 ? 1 : 0
    }' "$kaynak" "$hedef"
}

prisma_durumu() {
  local bozuk bitmis
  bitmis="$(hedef_psql -d "$HEDEF_DB" -c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")"
  bozuk="$(hedef_psql -d "$HEDEF_DB" -c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL")"
  echo "  _prisma_migrations: tamamlanan=$bitmis yarım/geri alınan=$bozuk"
  if [ "$bitmis" -eq 0 ] || [ "$bozuk" -ne 0 ]; then
    hata "migration kayıtları tutarsız"
    return 1
  fi
  # Canlı/staging yığınında Prisma'nın kendi durum denetimi de koşar (bekleyen migration varsa sıfır dışı döner).
  case "$HEDEF_ADI" in
    canli | staging)
      local servis=migrate
      [ "$HEDEF_ADI" = staging ] && servis=migrate-staging
      if docker compose -f "$BASE/compose.yml" -p beautyos --profile migrate run --rm "$servis" \
        sh -c 'DATABASE_URL="$MIGRATION_DATABASE_URL" DIRECT_URL="$MIGRATION_DATABASE_URL" exec node_modules/.bin/prisma migrate status' \
        >/dev/null 2>&1; then
        echo "  prisma migrate status: güncel"
      else
        hata "prisma migrate status güncel değil"
        return 1
      fi
      ;;
    *) echo "  prisma migrate status: yalnız canli/staging yığınında koşar (konteyner hedefinde tablo denetimi yeterli sayıldı)" ;;
  esac
}

rol_denetimi() {
  local nitelik
  nitelik="$(hedef_psql -d postgres -c "SELECT rolsuper::text || '|' || rolbypassrls::text FROM pg_roles WHERE rolname = '$HEDEF_UYGULAMA'")"
  echo "  $HEDEF_UYGULAMA (rolsuper|rolbypassrls): ${nitelik:-yok}"
  if [ "$nitelik" != "false|false" ]; then
    hata "$HEDEF_UYGULAMA rolü süper kullanıcı/BYPASSRLS ya da yok"
    return 1
  fi
}

main_dogrula() {
  local hedef="" bos_mu=0 sayim="" durum=0 tablolar hedef_sayim
  while [ $# -gt 0 ]; do
    case "$1" in
      --bos-mu) bos_mu=1 ;;
      --sayim) shift; sayim="${1:-}" ;;
      -*) kullanim_dogrula; exit 2 ;;
      *)
        if [ -n "$hedef" ]; then kullanim_dogrula; exit 2; fi
        hedef="$1" ;;
    esac
    shift
  done
  [ -n "$hedef" ] || { kullanim_dogrula; exit 2; }
  HEDEF_ADI="${hedef%%:*}"
  hedef_coz "$hedef"

  if [ "$bos_mu" -eq 1 ]; then
    tablolar="$(hedef_tablo_sayisi)"
    if [ "$tablolar" = "0" ]; then echo "Hedef boş (public'te tablo yok)."; exit 0; fi
    hata "hedef boş değil (public'te $tablolar tablo)"
    exit 1
  fi

  hazirla_dizin
  if [ -z "$sayim" ]; then
    # shellcheck disable=SC2012
    sayim="$(ls -t "$TASIMA"/sayim-*.txt 2>/dev/null | head -n 1 || true)"
  fi
  if [ -z "$sayim" ] || [ ! -f "$sayim" ]; then
    hata "kaynak sayım dosyası bulunamadı (önce on-kontrol ya da yedekten-ac)"
    exit 1
  fi

  echo "Kaynak sayımı: $sayim"
  hedef_sayim="$(mktemp "$TASIMA/hedef-sayim.XXXXXX")"
  # Çıkışta değişken kapsam dışı kalacağından yol trap kurulurken genişletilir.
  # shellcheck disable=SC2064
  trap "rm -f '$hedef_sayim'" EXIT
  hedef_psql -d "$HEDEF_DB" <<<"$(sayim_sql)" >"$hedef_sayim"

  echo "── Sayı ve kimlik özeti karşılaştırması ──"
  if sayim_karsilastir "$sayim" "$hedef_sayim"; then
    echo "  eşit ($(grep -c '^satir|' "$sayim" || true) tablo, ${#DIGEST_TABLOLARI[@]} kimlik özeti)"
  else
    durum=1
  fi
  echo "── Migration durumu ──"
  prisma_durumu || durum=1
  echo "── Rol denetimi ──"
  rol_denetimi || durum=1

  if [ "$durum" -eq 0 ]; then echo "SONUÇ: DOĞRULANDI"; else echo "SONUÇ: FARK VAR" >&2; fi
  return "$durum"
}

main_dogrula "$@"
