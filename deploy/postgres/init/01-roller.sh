#!/bin/bash
# İlk açılışta (boş veri dizini) bir kez çalışır: dört rol + iki veritabanı.
#   canlı   : veritabanı beautyos          sahip app_owner, uygulama app_user
#   staging : veritabanı beautyos_staging  sahip stg_owner, uygulama stg_user
# Parolalar yalnız .env.db'den gelir (APP_OWNER_PASSWORD, APP_USER_PASSWORD, STG_OWNER_PASSWORD, STG_USER_PASSWORD)
# ve psql değişkeni olarak SQL'e geçer (:'ad' güvenli tırnaklar); betik içinde yazılmaz, günlüğe düşmez.
set -euo pipefail

for ad in APP_OWNER_PASSWORD APP_USER_PASSWORD STG_OWNER_PASSWORD STG_USER_PASSWORD; do
  if [ -z "${!ad:-}" ]; then
    echo "HATA: $ad .env.db içinde tanımlı olmalı" >&2
    exit 1
  fi
done

if [ "$POSTGRES_DB" != "beautyos" ]; then
  echo "HATA: POSTGRES_DB 'beautyos' olmalı (canlı veritabanı adı)" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_owner_pw="$APP_OWNER_PASSWORD" -v app_user_pw="$APP_USER_PASSWORD" \
  -v stg_owner_pw="$STG_OWNER_PASSWORD" -v stg_user_pw="$STG_USER_PASSWORD" <<'SQL'
-- Sahip rolleri veri migration'larını tüm satırlarda çalıştırır (BYPASSRLS); yalnız migrate servisleri kullanır.
CREATE ROLE app_owner LOGIN PASSWORD :'app_owner_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
CREATE ROLE app_user  LOGIN PASSWORD :'app_user_pw'  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE stg_owner LOGIN PASSWORD :'stg_owner_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
CREATE ROLE stg_user  LOGIN PASSWORD :'stg_user_pw'  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

ALTER DATABASE beautyos OWNER TO app_owner;
CREATE DATABASE beautyos_staging OWNER stg_owner;

-- Çapraz erişim yok: PUBLIC'ten CONNECT alınır, her rol yalnız kendi veritabanına bağlanır.
REVOKE CONNECT ON DATABASE beautyos FROM PUBLIC;
REVOKE CONNECT ON DATABASE beautyos_staging FROM PUBLIC;
GRANT CONNECT ON DATABASE beautyos TO app_owner, app_user;
GRANT CONNECT ON DATABASE beautyos_staging TO stg_owner, stg_user;
SQL

# Yetkiler veritabanı başınadır; varsayılan yetkiler sahibin ileride oluşturacağı tüm nesneleri kapsar.
yetki_ver() {
  local db="$1" sahip="$2" kullanici="$3"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" \
    -v sahip="$sahip" -v kullanici="$kullanici" <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO :"sahip";
GRANT USAGE ON SCHEMA public TO :"kullanici";
ALTER DEFAULT PRIVILEGES FOR ROLE :"sahip" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"kullanici";
ALTER DEFAULT PRIVILEGES FOR ROLE :"sahip" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"kullanici";
SQL
}

yetki_ver beautyos app_owner app_user
yetki_ver beautyos_staging stg_owner stg_user

echo "Roller ve veritabanları hazır: beautyos (app_owner/app_user), beautyos_staging (stg_owner/stg_user)"
