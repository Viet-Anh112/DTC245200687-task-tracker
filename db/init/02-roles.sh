#!/bin/sh
# Hardening DB: tao role toi thieu quyen cho ung dung va cho exporter
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
CREATE ROLE tt_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
CREATE ROLE tt_monitor LOGIN PASSWORD '${MONITOR_DB_PASSWORD}';
GRANT pg_monitor TO tt_monitor;

REVOKE ALL ON DATABASE ${POSTGRES_DB} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO tt_app, tt_monitor;
GRANT USAGE ON SCHEMA public TO tt_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tt_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tt_app;
EOSQL
