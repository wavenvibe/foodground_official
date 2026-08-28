"""
VS-2 Approval B resume -- intermediate state check (read-only, no writes)
Verifies the exact remote state after 5 completed loads, before remaining 2.
Exits 0 if state matches exactly. Exits 1 on any mismatch or error.
URL and credentials are never printed.
"""
import os
import sys

PUBLIC_TABLES = [
    'facilities',
    'ingredients',
    'recipes',
    'recipe_ingredients',
    'standard_foods',
    'substitute_pairs',
    'ingredient_name_match',
]

# Tables already loaded (expected exact counts)
STAGING_LOADED = [
    ('standard_foods',         686),
    ('substitute_pairs',   234_955),
    ('ingredient_name_match', 23_806),
    ('recipes',             70_165),
    ('ingredients',         18_932),
]

# Tables not yet loaded (must be 0)
STAGING_EMPTY = [
    'recipe_ingredients',
    'facilities',
]

EXPECTED_MIGRATIONS = 10


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

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        print('[OK] Connection successful')
    except Exception:
        print('[ERR] Connection failed (credentials omitted)', file=sys.stderr)
        sys.exit(1)

    failed = False

    # -- migrations ----------------------------------------------------
    try:
        cur.execute('SELECT COUNT(*) FROM supabase_migrations.schema_migrations')
        count = cur.fetchone()[0]
        if count == EXPECTED_MIGRATIONS:
            print(f'[OK] migrations: {count}/{EXPECTED_MIGRATIONS}')
        else:
            print(f'[ERR] migrations: {count} (expected {EXPECTED_MIGRATIONS})',
                  file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] migration check: {exc}', file=sys.stderr)
        failed = True

    # -- public: all 0 -------------------------------------------------
    try:
        total = 0
        for t in PUBLIC_TABLES:
            cur.execute(f'SELECT COUNT(*) FROM public.{t}')
            total += cur.fetchone()[0]
        if total == 0:
            print(f'[OK] public schema: {len(PUBLIC_TABLES)} tables, 0 rows')
        else:
            print(f'[ERR] public schema: {total} rows (expected 0)', file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] public check: {exc}', file=sys.stderr)
        failed = True

    # -- staging: loaded tables ----------------------------------------
    for table, expected in STAGING_LOADED:
        try:
            cur.execute(f'SELECT COUNT(*) FROM staging.{table}')
            count = cur.fetchone()[0]
            if count == expected:
                print(f'[OK] staging.{table}: {count:,}')
            else:
                print(f'[ERR] staging.{table}: {count:,} (expected {expected:,})',
                      file=sys.stderr)
                failed = True
        except Exception as exc:
            print(f'[ERR] staging.{table}: {exc}', file=sys.stderr)
            failed = True

    # -- staging: not-yet-loaded tables must be 0 ----------------------
    for table in STAGING_EMPTY:
        try:
            cur.execute(f'SELECT COUNT(*) FROM staging.{table}')
            count = cur.fetchone()[0]
            if count == 0:
                print(f'[OK] staging.{table}: 0 (pending load)')
            else:
                print(f'[ERR] staging.{table}: {count:,} (expected 0 -- already written?)',
                      file=sys.stderr)
                failed = True
        except Exception as exc:
            print(f'[ERR] staging.{table}: {exc}', file=sys.stderr)
            failed = True

    cur.close()
    conn.close()

    if failed:
        print('[FAIL] State mismatch -- do not proceed with load', file=sys.stderr)
        sys.exit(1)

    print('[PASS] Intermediate state confirmed -- safe to resume load')
    sys.exit(0)


if __name__ == '__main__':
    main()
