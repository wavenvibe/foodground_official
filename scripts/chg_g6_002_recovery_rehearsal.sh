#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_HOST=""
REMOTE_PORT=""
REMOTE_USER=""
REMOTE_DATABASE=""
PROJECT_REF=""
RUN_ID=""
VERIFY_SQL=""
REPORT_PATH=""
LOCAL_PORT="5433"
LOCAL_DB="foodground_restore_rehearsal"
PG17="/usr/lib/postgresql/17/bin"

if [[ "${1:-}" == "--transport-self-test" ]]; then
  IFS= read -r TEST_PAYLOAD
  TEST_PAYLOAD="${TEST_PAYLOAD%$'\r'}"
  TEST_VALUE=$(printf '%s' "$TEST_PAYLOAD" | base64 -d) || exit 24
  [[ "$TEST_VALUE" == "FoodGround-UTF8-pipe-test-Az09-_" ]] || exit 25
  exit 0
fi

if [[ "${1:-}" == "--local-restore-self-test" ]]; then
  TEST_ID="$$"
  TEST_SOURCE_DB="fg_recovery_source_${TEST_ID}"
  TEST_TARGET_DB="fg_recovery_target_${TEST_ID}"
  TEST_ARCHIVE="/tmp/fg-recovery-archive-${TEST_ID}"
  TEST_VERIFY_SQL="/tmp/fg-recovery-verify-${TEST_ID}.sql"
  cleanup_self_test() {
    sudo -u postgres "${PG17}/dropdb" --if-exists -p "$LOCAL_PORT" "$TEST_TARGET_DB" >/dev/null 2>&1 || true
    sudo -u postgres "${PG17}/dropdb" --if-exists -p "$LOCAL_PORT" "$TEST_SOURCE_DB" >/dev/null 2>&1 || true
    rm -rf -- "$TEST_ARCHIVE" "$TEST_VERIFY_SQL"
  }
  trap cleanup_self_test EXIT INT TERM
  pg_ctlcluster 17 main start >/dev/null 2>&1 || true
  cleanup_self_test
  sudo -u postgres "${PG17}/createdb" -p "$LOCAL_PORT" "$TEST_SOURCE_DB"
  sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -v ON_ERROR_STOP=1 -d postgres <<'SQL' >/dev/null
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'anon', 'authenticated', 'service_role', 'authenticator',
    'supabase_admin', 'dashboard_user', 'supabase_auth_admin',
    'supabase_storage_admin', 'supabase_functions_admin',
    'supabase_read_only_user', 'pgbouncer'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
  END LOOP;
END $$;
ALTER ROLE service_role BYPASSRLS;
SQL
  sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -v ON_ERROR_STOP=1 -d "$TEST_SOURCE_DB" \
    -c 'CREATE TABLE public.restore_probe(id integer PRIMARY KEY); INSERT INTO public.restore_probe VALUES (1); ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;' >/dev/null
  sudo -u postgres "${PG17}/pg_dump" -p "$LOCAL_PORT" -d "$TEST_SOURCE_DB" \
    --format=directory --no-owner --schema=public --file="$TEST_ARCHIVE"
  sudo -u postgres "${PG17}/createdb" -p "$LOCAL_PORT" "$TEST_TARGET_DB"
  sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -v ON_ERROR_STOP=1 -d "$TEST_TARGET_DB" \
    -c 'DROP SCHEMA public CASCADE;' >/dev/null
  sudo -u postgres "${PG17}/pg_restore" -p "$LOCAL_PORT" -d "$TEST_TARGET_DB" \
    --no-owner --exit-on-error "$TEST_ARCHIVE"
  printf '%s\n' 'SELECT COUNT(*) FROM public.restore_probe;' > "$TEST_VERIFY_SQL"
  chmod 600 "$TEST_VERIFY_SQL"
  chown postgres:postgres "$TEST_VERIFY_SQL"
  TEST_COUNT=$(sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -d "$TEST_TARGET_DB" -Atqf "$TEST_VERIFY_SQL")
  [[ "$TEST_COUNT" == "1" ]] || exit 26
  echo "[PASS] Local PostgreSQL 17 public-schema dump/restore self-test."
  exit 0
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) REMOTE_HOST="$2"; shift 2 ;;
    --port) REMOTE_PORT="$2"; shift 2 ;;
    --user) REMOTE_USER="$2"; shift 2 ;;
    --database) REMOTE_DATABASE="$2"; shift 2 ;;
    --project-ref) PROJECT_REF="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    --verify-sql) VERIFY_SQL="$2"; shift 2 ;;
    --report) REPORT_PATH="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument" >&2; exit 2 ;;
  esac
done

for required in REMOTE_HOST REMOTE_PORT REMOTE_USER REMOTE_DATABASE PROJECT_REF RUN_ID VERIFY_SQL REPORT_PATH; do
  if [[ -z "${!required}" ]]; then
    echo "ERROR: missing required recovery argument" >&2
    exit 2
  fi
done

if [[ "$PROJECT_REF" != "glczrbadvfgmblmkpgfj" ]]; then
  echo "ERROR: unapproved project ref" >&2
  exit 2
fi
if [[ "$REMOTE_DATABASE" != "postgres" || "$REMOTE_PORT" != "5432" ]]; then
  echo "ERROR: recovery source must use the approved postgres database and Session pooler/direct port 5432" >&2
  exit 2
fi
if [[ "$REMOTE_HOST" == "db.${PROJECT_REF}.supabase.co" ]]; then
  [[ "$REMOTE_USER" == "postgres" ]] || { echo "ERROR: invalid direct user" >&2; exit 2; }
elif [[ "$REMOTE_HOST" == *.pooler.supabase.com ]]; then
  [[ "$REMOTE_USER" == "postgres.${PROJECT_REF}" ]] || { echo "ERROR: invalid pooler user" >&2; exit 2; }
else
  echo "ERROR: unapproved recovery source host" >&2
  exit 2
fi

IFS= read -r DB_SECRET_BASE64
# wsl.exe can translate the Windows pipe newline to CRLF. Strip only the
# transport carriage return; the Base64 payload itself never contains CR.
DB_SECRET_BASE64="${DB_SECRET_BASE64%$'\r'}"
if [[ -z "$DB_SECRET_BASE64" ]]; then
  echo "ERROR: empty database password" >&2
  exit 2
fi
if ! DB_PASSWORD=$(printf '%s' "$DB_SECRET_BASE64" | base64 -d); then
  echo "ERROR: invalid password transport encoding" >&2
  exit 2
fi
DB_SECRET_BASE64=""
if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: decoded database password is empty" >&2
  exit 2
fi

RUN_DIR="/tmp/foodground-recovery-${RUN_ID}"
ARCHIVE_DIR="${RUN_DIR}/archive"
REMOTE_DSN="host=${REMOTE_HOST} port=${REMOTE_PORT} dbname=${REMOTE_DATABASE} user=${REMOTE_USER} sslmode=require connect_timeout=15"
START_EPOCH="$(date +%s)"
LOCAL_CREATED=0

cleanup() {
  local exit_code=$?
  unset PGPASSWORD DB_PASSWORD DB_SECRET_BASE64 REMOTE_DSN
  if [[ "$LOCAL_CREATED" -eq 1 ]]; then
    sudo -u postgres "${PG17}/dropdb" --if-exists -p "$LOCAL_PORT" "$LOCAL_DB" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$RUN_DIR"
  if [[ $exit_code -ne 0 ]]; then
    echo "[cleanup] Ephemeral archive and local restore database removed after failure." >&2
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

mkdir -m 700 -p "$RUN_DIR"
mkdir -p "$(dirname "$REPORT_PATH")"
PGPASSWORD=$DB_PASSWORD
export PGPASSWORD
DB_PASSWORD=""

COUNTS_SQL=$(cat <<'SQL'
SELECT object_name || '=' || row_count
FROM (
  SELECT 'public.standard_foods' object_name, COUNT(*)::bigint row_count FROM public.standard_foods
  UNION ALL SELECT 'public.substitute_pairs', COUNT(*) FROM public.substitute_pairs
  UNION ALL SELECT 'public.ingredient_name_match', COUNT(*) FROM public.ingredient_name_match
  UNION ALL SELECT 'public.recipes', COUNT(*) FROM public.recipes
  UNION ALL SELECT 'public.ingredients', COUNT(*) FROM public.ingredients
  UNION ALL SELECT 'public.recipe_ingredients', COUNT(*) FROM public.recipe_ingredients
  UNION ALL SELECT 'public.facilities', COUNT(*) FROM public.facilities
  UNION ALL SELECT 'public.products_public', COUNT(*) FROM public.products_public
  UNION ALL SELECT 'public.facility_products_public', COUNT(*) FROM public.facility_products_public
  UNION ALL SELECT 'public.haccp_certifications_public', COUNT(*) FROM public.haccp_certifications_public
  UNION ALL SELECT 'public.facility_safety_public', COUNT(*) FROM public.facility_safety_public
  UNION ALL SELECT 'public.manufacturing_profiles_public', COUNT(*) FROM public.manufacturing_profiles_public
  UNION ALL SELECT 'private.company_profile_mapping', COUNT(*) FROM private.company_profile_mapping
  UNION ALL SELECT 'staging.production_log_raw', COUNT(*) FROM staging.production_log_raw
  UNION ALL SELECT 'staging.haccp_cert_raw', COUNT(*) FROM staging.haccp_cert_raw
  UNION ALL SELECT 'staging.sales_suspension_raw', COUNT(*) FROM staging.sales_suspension_raw
  UNION ALL SELECT 'staging.company_profiles_raw', COUNT(*) FROM staging.company_profiles_raw
) counts
ORDER BY object_name;
SQL
)

echo "[1/7] Confirming source server and application counts (read-only)..."
REMOTE_VERSION_NUM=$("${PG17}/psql" "$REMOTE_DSN" -X -v ON_ERROR_STOP=1 -Atqc 'SHOW server_version_num')
if (( REMOTE_VERSION_NUM < 170000 )); then
  echo "ERROR: expected PostgreSQL 17 source" >&2
  exit 3
fi
SNAPSHOT_UTC=$("${PG17}/psql" "$REMOTE_DSN" -X -v ON_ERROR_STOP=1 -Atqc "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")
REMOTE_COUNTS=$("${PG17}/psql" "$REMOTE_DSN" -X -v ON_ERROR_STOP=1 -Atqc "$COUNTS_SQL")

echo "[2/7] Creating application-schema logical backup..."
DUMP_START=$(date +%s)
"${PG17}/pg_dump" "$REMOTE_DSN" \
  --format=directory --jobs=4 --no-owner \
  --schema=public --schema=private --schema=staging \
  --file="$ARCHIVE_DIR"
DUMP_END=$(date +%s)
unset PGPASSWORD

# pg_dump runs as root because the password arrives through the root-owned
# runner, while pg_restore intentionally runs as the local postgres account.
# Transfer ownership only after the remote read has completed so postgres can
# traverse the 0700 run directory and read the directory-format archive.
chown -R postgres:postgres "$RUN_DIR"
chmod 700 "$RUN_DIR" "$ARCHIVE_DIR"
chown postgres:postgres "$VERIFY_SQL"
chmod 600 "$VERIFY_SQL"

ARCHIVE_BYTES=$(du -sb "$ARCHIVE_DIR" | awk '{print $1}')
ARCHIVE_HASH=$(find "$ARCHIVE_DIR" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')

echo "[3/7] Preparing clean PostgreSQL 17 restore target..."
pg_ctlcluster 17 main start >/dev/null 2>&1 || true
sudo -u postgres "${PG17}/dropdb" --if-exists -p "$LOCAL_PORT" "$LOCAL_DB" >/dev/null 2>&1 || true
sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -v ON_ERROR_STOP=1 -d postgres <<'SQL' >/dev/null
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'anon', 'authenticated', 'service_role', 'authenticator',
    'supabase_admin', 'dashboard_user', 'supabase_auth_admin',
    'supabase_storage_admin', 'supabase_functions_admin',
    'supabase_read_only_user', 'pgbouncer'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
  END LOOP;
END $$;
ALTER ROLE service_role BYPASSRLS;
SQL
sudo -u postgres "${PG17}/createdb" -p "$LOCAL_PORT" "$LOCAL_DB"
LOCAL_CREATED=1
sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -v ON_ERROR_STOP=1 -d "$LOCAL_DB" <<'SQL' >/dev/null
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
-- createdb supplies an empty public schema from template1.  The logical
-- archive contains its own public schema definition, so remove only this
-- fresh local copy before pg_restore to avoid CREATE SCHEMA collisions.
DROP SCHEMA public CASCADE;
SQL

echo "[4/7] Restoring archive into ephemeral local database..."
RESTORE_START=$(date +%s)
sudo -u postgres "${PG17}/pg_restore" \
  --port="$LOCAL_PORT" --dbname="$LOCAL_DB" \
  --jobs=4 --no-owner --exit-on-error "$ARCHIVE_DIR"
RESTORE_END=$(date +%s)

echo "[5/7] Comparing source and restored counts..."
LOCAL_COUNTS=$(sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -d "$LOCAL_DB" -X -v ON_ERROR_STOP=1 -Atqc "$COUNTS_SQL")
if [[ "$REMOTE_COUNTS" != "$LOCAL_COUNTS" ]]; then
  echo "ERROR: source/restored application counts differ" >&2
  diff -u <(printf '%s\n' "$REMOTE_COUNTS") <(printf '%s\n' "$LOCAL_COUNTS") >&2 || true
  exit 4
fi

echo "[6/7] Running Approval C integrity, FK, RLS, ACL, and lineage verification..."
VERIFY_START=$(date +%s)
sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -d "$LOCAL_DB" -X -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"
NULL_ANOMALY=$(sudo -u postgres "${PG17}/psql" -p "$LOCAL_PORT" -d "$LOCAL_DB" -X -v ON_ERROR_STOP=1 -Atqc 'SELECT COUNT(*) FROM public.recipe_ingredients WHERE amount_gram IS NULL')
if [[ "$NULL_ANOMALY" != "1" ]]; then
  echo "ERROR: expected one preserved recipe_ingredients amount_gram NULL anomaly" >&2
  exit 5
fi
VERIFY_END=$(date +%s)

END_EPOCH=$(date +%s)
DUMP_SECONDS=$((DUMP_END - DUMP_START))
RESTORE_SECONDS=$((RESTORE_END - RESTORE_START))
VERIFY_SECONDS=$((VERIFY_END - VERIFY_START))
RTO_SECONDS=$((VERIFY_END - RESTORE_START))
TOTAL_SECONDS=$((END_EPOCH - START_EPOCH))

echo "[7/7] Writing sanitized recovery evidence and removing ephemeral data..."
cat > "$REPORT_PATH" <<EOF
# CHG-G6-002 logical recovery rehearsal

- Run ID: \`${RUN_ID}\`
- Source: approved official Supabase project \`${PROJECT_REF}\` (read-only)
- Source snapshot UTC: \`${SNAPSHOT_UTC}\`
- Source PostgreSQL: \`${REMOTE_VERSION_NUM}\`
- Restore target: ephemeral local WSL PostgreSQL 17, database deleted after verification
- Schemas: \`public\`, \`private\`, \`staging\`
- Archive size: \`${ARCHIVE_BYTES}\` bytes
- Archive manifest SHA-256: \`${ARCHIVE_HASH}\`
- Logical backup duration: \`${DUMP_SECONDS}\` seconds
- Restore duration: \`${RESTORE_SECONDS}\` seconds
- Verification duration: \`${VERIFY_SECONDS}\` seconds
- Measured restore-to-verification time: \`${RTO_SECONDS}\` seconds
- Total rehearsal duration: \`${TOTAL_SECONDS}\` seconds

## Verification

- Source/restored application object counts: MATCH (17 objects)
- Approval C row count, PK, FK, VIEW, mapping, private-column, RLS, ACL, lineage checks: PASS
- \`recipe_ingredients.amount_gram IS NULL\` confirmed anomaly: 1 row preserved
- Remote writes: none
- Ephemeral archive and restored database: deleted by cleanup trap

## Interpretation boundary

This is a fresh logical backup-and-restore rehearsal of the official application-owned schemas. It validates recoverability of the current database state and measures a local logical restore time. It is not a restore of a Supabase scheduled physical backup, does not validate Storage objects, and is not a Production outage RTO guarantee.
EOF

echo "[PASS] Source/restored counts match; Approval C verification passed; local RTO=${RTO_SECONDS}s."
