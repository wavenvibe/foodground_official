"""
VS-2 Approval B -- read-only preflight check (no writes)
Verifies: connection, 10 migrations applied, public 7 tables = 0 rows,
          staging 7 tables = 0 rows.
SUPABASE_DB_URL must be set. Exits 0 on pass, 1 on any failure.
URL and credentials are never printed.
"""
import os
import sys

EXPECTED_MIGRATIONS = 10
TABLES = [
    'facilities',
    'ingredients',
    'recipes',
    'recipe_ingredients',
    'standard_foods',
    'substitute_pairs',
    'ingredient_name_match',
]


def main() -> None:
    db_url = os.environ.get('SUPABASE_DB_URL', '').strip()
    if not db_url:
        print('[ERR] SUPABASE_DB_URL not set', file=sys.stderr)
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print('[ERR] psycopg2 not installed. Run: pip install psycopg2-binary',
              file=sys.stderr)
        sys.exit(1)

    failed = False

    # -- connect -------------------------------------------------------
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        print('[OK] Connection successful')
    except Exception:
        print('[ERR] Connection failed (credentials omitted)', file=sys.stderr)
        sys.exit(1)

    # -- migration count -----------------------------------------------
    try:
        cur.execute(
            'SELECT COUNT(*) FROM supabase_migrations.schema_migrations'
        )
        count = cur.fetchone()[0]
        if count == EXPECTED_MIGRATIONS:
            print(f'[OK] Migrations applied: {count}/{EXPECTED_MIGRATIONS}')
        else:
            print(
                f'[ERR] Migrations: {count}/{EXPECTED_MIGRATIONS}'
                f' (expected {EXPECTED_MIGRATIONS})',
                file=sys.stderr,
            )
            failed = True
    except Exception as exc:
        print(f'[ERR] Migration check failed: {exc}', file=sys.stderr)
        failed = True

    # -- public schema: 0 rows -----------------------------------------
    try:
        total = 0
        for t in TABLES:
            cur.execute(f'SELECT COUNT(*) FROM public.{t}')
            total += cur.fetchone()[0]
        if total == 0:
            print(f'[OK] public schema: {len(TABLES)} tables, 0 rows')
        else:
            print(
                f'[ERR] public schema: {total} rows found (expected 0)',
                file=sys.stderr,
            )
            failed = True
    except Exception as exc:
        print(f'[ERR] public table check failed: {exc}', file=sys.stderr)
        failed = True

    # -- staging schema: 0 rows ----------------------------------------
    try:
        total = 0
        for t in TABLES:
            cur.execute(f'SELECT COUNT(*) FROM staging.{t}')
            total += cur.fetchone()[0]
        if total == 0:
            print(f'[OK] staging schema: {len(TABLES)} tables, 0 rows')
        else:
            print(
                f'[ERR] staging schema: {total} rows found (expected 0)',
                file=sys.stderr,
            )
            failed = True
    except Exception as exc:
        print(f'[ERR] staging table check failed: {exc}', file=sys.stderr)
        failed = True

    cur.close()
    conn.close()

    if failed:
        sys.exit(1)

    print('[PASS] All preflight checks passed')
    sys.exit(0)


if __name__ == '__main__':
    main()
