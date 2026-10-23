#!/bin/sh
# ============================================================================
# 02-roles.sh: Hardening DB - Tao role toi thieu quyen (Least Privilege)
# Role tt_app: Chi co SELECT, INSERT, UPDATE, DELETE; khong co DROP TABLE/CREATE ROLE
# Role tt_monitor: Cho phep postgres-exporter doc metrics CSDL
# ============================================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
-- 1. Tao role ung dung tt_app
CREATE ROLE tt_app LOGIN PASSWORD '${APP_DB_PASSWORD}';

-- 2. Tao role tt_monitor cho cong cu giam sat postgres-exporter
CREATE ROLE tt_monitor LOGIN PASSWORD '${MONITOR_DB_PASSWORD}';
GRANT pg_monitor TO tt_monitor;

-- 3. Bao ve co so du lieu: Thu hoi toan bo quyen tu PUBLIC
REVOKE ALL ON DATABASE "${POSTGRES_DB}" FROM PUBLIC;

-- 4. Cap quyen ket noi (CONNECT) chi cho cac tai khoan hop le
GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO tt_app, tt_monitor;

-- 5. Cap quyen tren schema public cho tt_app
GRANT USAGE ON SCHEMA public TO tt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tt_app;

-- 6. Dam bao cac bang tao ve sau van giu nguyen dac quyen toi thieu
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tt_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tt_app;
EOSQL
