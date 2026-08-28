"""
VS-2 Approval C -- Post-publish verification (read-only queries, no writes)
Verifies published data correctness and RLS/ACL enforcement for anon and authenticated roles.
Requires SUPABASE_DB_URL (service-role connection).
Optionally requires SUPABASE_URL + SUPABASE_ANON_KEY for Data API smoke test (skip if absent).
Exits 0 if all checks pass. Exits 1 on any failure.
"""
import os
import sys

PUBLIC_EXPECTED = [
    ('standard_foods',        686),
    ('substitute_pairs',   234_955),
    ('ingredient_name_match', 23_806),
    ('recipes',             70_165),
    ('ingredients',         18_932),
    ('recipe_ingredients', 679_457),
    ('facilities',          94_723),
]

FACILITIES_APPROVED_COLS = [
    'mgt_no', 'name', 'region_sido', 'region_sigungu', 'business_type',
    'is_haccp', 'status', 'tel', 'homepage', 'created_at', 'ingest_run_id',
]

EXPECTED_AMOUNT_GRAM_NULLS = 1


def _set_role(conn, cur, role):
    conn.autocommit = False
    cur.execute(f'SET LOCAL ROLE {role}')


def _rollback(conn):
    try:
        conn.rollback()
    except Exception:
        pass
    conn.autocommit = True


def check_role_select_allowed(conn, cur, role, table, column, label, failed):
    """Verify that role can SELECT the given column from the table."""
    try:
        _set_role(conn, cur, role)
        cur.execute(f'SELECT {column} FROM public.{table} LIMIT 1')
        cur.fetchone()
        _rollback(conn)
        print(f'[OK] {label} SELECT public.{table} ({column}): allowed')
    except Exception as exc:
        _rollback(conn)
        print(f'[ERR] {label} SELECT public.{table} ({column}): {type(exc).__name__}',
              file=sys.stderr)
        return True
    return failed


def check_role_write_blocked(conn, cur, role, table, stmt, op, label, failed):
    """Verify that role cannot execute the given DML statement."""
    try:
        _set_role(conn, cur, role)
        cur.execute(stmt)
        _rollback(conn)
        print(f'[ERR] {label} {op} public.{table}: NOT blocked (should be denied)',
              file=sys.stderr)
        return True
    except Exception:
        _rollback(conn)
        print(f'[OK] {label} {op} public.{table}: blocked')
    return failed


def check_role_schema_blocked(conn, cur, role, schema, table, label, failed):
    """Verify that role cannot SELECT from schema.table."""
    try:
        _set_role(conn, cur, role)
        cur.execute(f'SELECT COUNT(*) FROM {schema}.{table}')
        cur.fetchone()
        _rollback(conn)
        print(f'[ERR] {label} SELECT {schema}.{table}: NOT blocked', file=sys.stderr)
        return True
    except Exception:
        _rollback(conn)
        print(f'[OK] {label} SELECT {schema}.{table}: blocked')
    return failed


def check_role_column_blocked(conn, cur, role, table, column, label, failed):
    """Verify that role cannot SELECT the specified column."""
    try:
        _set_role(conn, cur, role)
        cur.execute(f'SELECT {column} FROM public.{table} LIMIT 1')
        cur.fetchone()
        _rollback(conn)
        print(f'[ERR] {label} SELECT {column} from {table}: NOT blocked (should be denied)',
              file=sys.stderr)
        return True
    except Exception:
        _rollback(conn)
        print(f'[OK] {label} SELECT {column} from {table}: blocked')
    return failed


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

    # ── Check 1: public table counts match expected ──────────────────────
    print('\n-- Check 1: public table counts')
    for table, expected in PUBLIC_EXPECTED:
        try:
            cur.execute(f'SELECT COUNT(*) FROM public.{table}')
            count = cur.fetchone()[0]
            if count == expected:
                print(f'[OK] public.{table}: {count:,}')
            else:
                print(f'[ERR] public.{table}: {count:,} (expected {expected:,})',
                      file=sys.stderr)
                failed = True
        except Exception as exc:
            print(f'[ERR] public.{table} count: {exc}', file=sys.stderr)
            failed = True

    # ── Check 2: public counts match staging counts ───────────────────────
    print('\n-- Check 2: public counts match staging counts')
    for table, _ in PUBLIC_EXPECTED:
        try:
            cur.execute(f'SELECT COUNT(*) FROM public.{table}')
            pub = cur.fetchone()[0]
            cur.execute(f'SELECT COUNT(*) FROM staging.{table}')
            stg = cur.fetchone()[0]
            if pub == stg:
                print(f'[OK] {table}: public={pub:,} == staging={stg:,}')
            else:
                print(f'[ERR] {table}: public={pub:,} != staging={stg:,}',
                      file=sys.stderr)
                failed = True
        except Exception as exc:
            print(f'[ERR] {table} public/staging compare: {exc}', file=sys.stderr)
            failed = True

    # ── Check 3: anon SELECT allowed on all public tables ────────────────
    print('\n-- Check 3: anon SELECT allowed (public tables)')
    for table, _ in PUBLIC_EXPECTED:
        col = 'mgt_no' if table == 'facilities' else 'COUNT(*)'
        failed = check_role_select_allowed(
            conn, cur, 'anon', table, col, 'anon', failed)

    # ── Check 4: anon INSERT blocked ─────────────────────────────────────
    print('\n-- Check 4: anon INSERT blocked')
    insert_tests = [
        ('standard_foods',
         "INSERT INTO public.standard_foods (standard_food_id, name) VALUES ('_test_', '_test_')"),
        ('facilities',
         "INSERT INTO public.facilities (mgt_no, name, status) VALUES ('_test_', '_test_', '_test_')"),
        ('recipes',
         "INSERT INTO public.recipes (recipe_id, title) VALUES (0, '_test_')"),
    ]
    for table, stmt in insert_tests:
        failed = check_role_write_blocked(conn, cur, 'anon', table, stmt, 'INSERT', 'anon', failed)

    # ── Check 5: anon UPDATE blocked ─────────────────────────────────────
    print('\n-- Check 5: anon UPDATE blocked')
    update_tests = [
        ('recipes', "UPDATE public.recipes SET title = '_test_' WHERE recipe_id = 0"),
        ('facilities', "UPDATE public.facilities SET name = '_test_' WHERE mgt_no = '_none_'"),
    ]
    for table, stmt in update_tests:
        failed = check_role_write_blocked(conn, cur, 'anon', table, stmt, 'UPDATE', 'anon', failed)

    # ── Check 5b: anon DELETE blocked ────────────────────────────────────
    print('\n-- Check 5b: anon DELETE blocked')
    delete_tests = [
        ('recipes', "DELETE FROM public.recipes WHERE recipe_id = 0"),
        ('facilities', "DELETE FROM public.facilities WHERE mgt_no = '_none_'"),
    ]
    for table, stmt in delete_tests:
        failed = check_role_write_blocked(conn, cur, 'anon', table, stmt, 'DELETE', 'anon', failed)

    # ── Check 6: anon staging access blocked ────────────────────────────
    print('\n-- Check 6: anon staging access blocked')
    failed = check_role_schema_blocked(conn, cur, 'anon', 'staging', 'facilities', 'anon', failed)

    # ── Check 7: anon private access blocked ─────────────────────────────
    print('\n-- Check 7: anon private.data_lineage access blocked')
    failed = check_role_schema_blocked(conn, cur, 'anon', 'private', 'data_lineage', 'anon', failed)

    # ── Check 8: facilities anon column ACL (migration 0025b) ────────────
    print('\n-- Check 8: facilities anon column ACL (migration 0025b)')

    # 8a: approved columns selectable — use mgt_no (a real column, not COUNT)
    try:
        conn.autocommit = False
        cur.execute('SET LOCAL ROLE anon')
        cur.execute('SELECT mgt_no FROM public.facilities LIMIT 1')
        cur.fetchone()
        _rollback(conn)
        print('[OK] anon SELECT mgt_no from facilities: allowed')
    except Exception as exc:
        _rollback(conn)
        print(f'[ERR] anon SELECT mgt_no from facilities: {type(exc).__name__}',
              file=sys.stderr)
        failed = True

    # 8b: all 11 approved columns selectable together
    approved_select = ', '.join(FACILITIES_APPROVED_COLS)
    try:
        conn.autocommit = False
        cur.execute('SET LOCAL ROLE anon')
        cur.execute(f'SELECT {approved_select} FROM public.facilities LIMIT 1')
        cur.fetchone()
        _rollback(conn)
        print('[OK] anon SELECT approved 11 columns from facilities: allowed')
    except Exception as exc:
        _rollback(conn)
        print(f'[ERR] anon SELECT approved 11 columns: {type(exc).__name__}',
              file=sys.stderr)
        failed = True

    # 8c: road_addr blocked (if column exists)
    try:
        conn.autocommit = True
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'facilities'
              AND column_name = 'road_addr'
        """)
        road_addr_exists = cur.fetchone()[0] > 0
    except Exception as exc:
        print(f'[WARN] Could not check road_addr existence: {exc}')
        road_addr_exists = False

    if road_addr_exists:
        failed = check_role_column_blocked(
            conn, cur, 'anon', 'facilities', 'road_addr', 'anon', failed)
    else:
        print('[OK] facilities.road_addr column does not exist '
              '(0025 schema only -- no non-approved columns present)')

    # ── Check 9: amount_gram NULL preserved ──────────────────────────────
    print('\n-- Check 9: public.recipe_ingredients amount_gram NULL preserved')
    try:
        conn.autocommit = True
        cur.execute(
            'SELECT COUNT(*) FROM public.recipe_ingredients WHERE amount_gram IS NULL'
        )
        count = cur.fetchone()[0]
        if count == EXPECTED_AMOUNT_GRAM_NULLS:
            print(f'[OK] public.recipe_ingredients amount_gram NULL: {count} '
                  f'(confirmed anomaly preserved)')
        else:
            print(f'[ERR] public.recipe_ingredients amount_gram NULL: {count} '
                  f'(expected {EXPECTED_AMOUNT_GRAM_NULLS})', file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] amount_gram NULL check: {exc}', file=sys.stderr)
        failed = True

    # ── Check 10: authenticated role — SELECT allowed on public tables ───
    print('\n-- Check 10: authenticated SELECT allowed (public tables)')
    for table, _ in PUBLIC_EXPECTED:
        col = 'mgt_no' if table == 'facilities' else 'COUNT(*)'
        failed = check_role_select_allowed(
            conn, cur, 'authenticated', table, col, 'authenticated', failed)

    # ── Check 11: authenticated INSERT blocked ───────────────────────────
    print('\n-- Check 11: authenticated INSERT blocked')
    for table, stmt in insert_tests:
        failed = check_role_write_blocked(
            conn, cur, 'authenticated', table, stmt, 'INSERT', 'authenticated', failed)

    # ── Check 12: authenticated UPDATE blocked ───────────────────────────
    print('\n-- Check 12: authenticated UPDATE blocked')
    for table, stmt in update_tests:
        failed = check_role_write_blocked(
            conn, cur, 'authenticated', table, stmt, 'UPDATE', 'authenticated', failed)

    # ── Check 13: authenticated DELETE blocked ───────────────────────────
    print('\n-- Check 13: authenticated DELETE blocked')
    for table, stmt in delete_tests:
        failed = check_role_write_blocked(
            conn, cur, 'authenticated', table, stmt, 'DELETE', 'authenticated', failed)

    # ── Check 14: authenticated staging access blocked ───────────────────
    print('\n-- Check 14: authenticated staging access blocked')
    failed = check_role_schema_blocked(
        conn, cur, 'authenticated', 'staging', 'facilities', 'authenticated', failed)

    # ── Check 15: authenticated private access blocked ───────────────────
    print('\n-- Check 15: authenticated private.data_lineage access blocked')
    failed = check_role_schema_blocked(
        conn, cur, 'authenticated', 'private', 'data_lineage', 'authenticated', failed)

    # ── Check 16: authenticated facilities approved column ACL ──────────
    print('\n-- Check 16: authenticated facilities column ACL')
    failed = check_role_select_allowed(
        conn, cur, 'authenticated', 'facilities', 'mgt_no', 'authenticated', failed)
    if road_addr_exists:
        failed = check_role_column_blocked(
            conn, cur, 'authenticated', 'facilities', 'road_addr', 'authenticated', failed)
    else:
        print('[OK] authenticated: facilities.road_addr column does not exist')

    cur.close()
    conn.close()

    # ── Check 17: Data API (REST) smoke test — optional ──────────────────
    print('\n-- Check 17: Data API (REST) smoke test (skipped if env vars absent)')
    supabase_url = os.environ.get('SUPABASE_URL', '').strip()
    anon_key = os.environ.get('SUPABASE_ANON_KEY', '').strip()

    if not supabase_url or not anon_key:
        print('[ERR] SUPABASE_URL or SUPABASE_ANON_KEY not set -- '
              'Data API smoke test is required for Approval C. '
              'Set both env vars and re-run.', file=sys.stderr)
        failed = True
    else:
        import urllib.request
        import urllib.error

        endpoint = f'{supabase_url}/rest/v1/facilities?select=mgt_no&limit=1'
        req = urllib.request.Request(
            endpoint,
            headers={
                'apikey': anon_key,
                'Authorization': f'Bearer {anon_key}',
                'Accept': 'application/json',
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.status
                body = resp.read(256)
            if status == 200 and body:
                print('[OK] Data API GET /facilities (anon): HTTP 200, body non-empty')
            else:
                print(f'[ERR] Data API GET /facilities: HTTP {status}, body={body!r}',
                      file=sys.stderr)
                failed = True
        except urllib.error.HTTPError as exc:
            print(f'[ERR] Data API GET /facilities: HTTP {exc.code}', file=sys.stderr)
            failed = True
        except Exception as exc:
            print(f'[ERR] Data API GET /facilities: {type(exc).__name__}', file=sys.stderr)
            failed = True

    print()
    if failed:
        print('[FAIL] Approval C verification failed', file=sys.stderr)
        sys.exit(1)

    print('[PASS] Approval C verification complete -- public data is correct and access controls are enforced')
    sys.exit(0)


if __name__ == '__main__':
    main()
