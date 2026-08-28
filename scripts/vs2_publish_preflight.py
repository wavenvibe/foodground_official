"""
VS-2 Approval C -- Pre-publish integrity checks (read-only, no writes)
8 checks before staging->public publish.
Exits 0 if all pass. Exits 1 on any failure.
URL and credentials are never printed.
"""
import os
import sys

STAGING_EXPECTED = [
    ('standard_foods',        686),
    ('substitute_pairs',   234_955),
    ('ingredient_name_match', 23_806),
    ('recipes',             70_165),
    ('ingredients',         18_932),
    ('recipe_ingredients', 679_457),
    ('facilities',          94_723),
]

PUBLIC_TABLES = [t for t, _ in STAGING_EXPECTED]

# recipe_ingredients has no ingest_run_id column by design; exclude from lineage check.
LINEAGE_TABLES = [
    'standard_foods',
    'substitute_pairs',
    'ingredient_name_match',
    'recipes',
    'ingredients',
    'facilities',
]

EXPECTED_AMOUNT_GRAM_NULLS = 1       # confirmed anomaly: recipe_id=6936777
MAX_SUB_SOURCE_ORPHANS    = 0        # zero orphans required for PASS
MAX_SUB_CANDIDATE_ORPHANS = 0        # zero orphans required for PASS


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

    # ── Check 1: staging row counts ──────────────────────────────────────
    print('\n-- Check 1: staging row counts')
    for table, expected in STAGING_EXPECTED:
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

    # ── Check 2: public tables are empty ────────────────────────────────
    print('\n-- Check 2: public tables are empty')
    for table in PUBLIC_TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM public.{table}')
            count = cur.fetchone()[0]
            if count == 0:
                print(f'[OK] public.{table}: 0 rows')
            else:
                print(f'[ERR] public.{table}: {count:,} rows (expected 0)',
                      file=sys.stderr)
                failed = True
        except Exception as exc:
            print(f'[ERR] public.{table}: {exc}', file=sys.stderr)
            failed = True

    # ── Check 3: recipe_ingredients -> recipes FK orphans ───────────────
    print('\n-- Check 3: recipe_ingredients->recipes FK orphans')
    try:
        cur.execute("""
            SELECT COUNT(*) FROM staging.recipe_ingredients ri
            WHERE NOT EXISTS (
                SELECT 1 FROM staging.recipes r WHERE r.recipe_id = ri.recipe_id
            )
        """)
        count = cur.fetchone()[0]
        if count == 0:
            print('[OK] recipe_ingredients->recipes orphans: 0')
        else:
            print(f'[ERR] recipe_ingredients->recipes orphans: {count:,}',
                  file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] FK check recipe_ingredients->recipes: {exc}', file=sys.stderr)
        failed = True

    # ── Check 4: recipe_ingredients -> ingredients FK orphans ────────────
    print('\n-- Check 4: recipe_ingredients->ingredients FK orphans')
    try:
        cur.execute("""
            SELECT COUNT(*) FROM staging.recipe_ingredients ri
            WHERE NOT EXISTS (
                SELECT 1 FROM staging.ingredients i WHERE i.ingredient_id = ri.ingredient_id
            )
        """)
        count = cur.fetchone()[0]
        if count == 0:
            print('[OK] recipe_ingredients->ingredients orphans: 0')
        else:
            print(f'[ERR] recipe_ingredients->ingredients orphans: {count:,}',
                  file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] FK check recipe_ingredients->ingredients: {exc}', file=sys.stderr)
        failed = True

    # ── Check 5: substitute_pairs source food ID orphans ─────────────────
    print('\n-- Check 5: substitute_pairs source food ID orphans')
    try:
        cur.execute("""
            SELECT COUNT(DISTINCT "기준식품ID")
            FROM staging.substitute_pairs sp
            WHERE NOT EXISTS (
                SELECT 1 FROM staging.standard_foods sf
                WHERE sf.standard_food_id = sp."기준식품ID"
            )
        """)
        count = cur.fetchone()[0]
        if count == MAX_SUB_SOURCE_ORPHANS:
            print(f'[OK] substitute_pairs 기준식품ID orphans: {count} (expected 0)')
        else:
            print(f'[ERR] substitute_pairs 기준식품ID orphans: {count} '
                  f'(expected 0)', file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] substitute_pairs source orphan check: {exc}', file=sys.stderr)
        failed = True

    # ── Check 6: substitute_pairs candidate food ID orphans ──────────────
    print('\n-- Check 6: substitute_pairs candidate food ID orphans')
    try:
        cur.execute("""
            SELECT COUNT(DISTINCT "후보식품ID")
            FROM staging.substitute_pairs sp
            WHERE NOT EXISTS (
                SELECT 1 FROM staging.standard_foods sf
                WHERE sf.standard_food_id = sp."후보식품ID"
            )
        """)
        count = cur.fetchone()[0]
        if count == MAX_SUB_CANDIDATE_ORPHANS:
            print(f'[OK] substitute_pairs 후보식품ID orphans: {count} (expected 0)')
        else:
            print(f'[ERR] substitute_pairs 후보식품ID orphans: {count} '
                  f'(expected 0)', file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] substitute_pairs candidate orphan check: {exc}', file=sys.stderr)
        failed = True

    # ── Check 7: ingredient_name_match non-NULL standard_food_id orphans ─
    print('\n-- Check 7: ingredient_name_match->standard_foods orphans')
    try:
        cur.execute("""
            SELECT COUNT(*) FROM staging.ingredient_name_match inm
            WHERE inm.standard_food_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM staging.standard_foods sf
                WHERE sf.standard_food_id = inm.standard_food_id
              )
        """)
        count = cur.fetchone()[0]
        if count == 0:
            print('[OK] ingredient_name_match->standard_foods orphans: 0')
        else:
            print(f'[ERR] ingredient_name_match->standard_foods orphans: {count:,}',
                  file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] ingredient_name_match orphan check: {exc}', file=sys.stderr)
        failed = True

    # ── Check 8a: ingest_run_id -> private.data_lineage orphans ─────────
    # recipe_ingredients excluded: no ingest_run_id column by design.
    print('\n-- Check 8a: ingest_run_id->private.data_lineage orphans (6 tables)')
    for table in LINEAGE_TABLES:
        try:
            cur.execute(f"""
                SELECT COUNT(DISTINCT ingest_run_id)
                FROM staging.{table}
                WHERE ingest_run_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM private.data_lineage dl
                    WHERE dl.id = staging.{table}.ingest_run_id
                  )
            """)
            count = cur.fetchone()[0]
            if count == 0:
                print(f'[OK] staging.{table} ingest_run_id->lineage: valid')
            else:
                print(f'[ERR] staging.{table} ingest_run_id orphans: {count}',
                      file=sys.stderr)
                failed = True
        except Exception as exc:
            print(f'[ERR] staging.{table} lineage check: {exc}', file=sys.stderr)
            failed = True

    # ── Check 8b: amount_gram NULL count exactly 1 ───────────────────────
    print('\n-- Check 8b: amount_gram NULL = 1 (confirmed anomaly)')
    try:
        cur.execute(
            'SELECT COUNT(*) FROM staging.recipe_ingredients WHERE amount_gram IS NULL'
        )
        count = cur.fetchone()[0]
        if count == EXPECTED_AMOUNT_GRAM_NULLS:
            print(f'[OK] staging.recipe_ingredients amount_gram NULL: {count} '
                  f'(recipe_id=6936777 confirmed anomaly)')
        else:
            print(f'[ERR] staging.recipe_ingredients amount_gram NULL: {count} '
                  f'(expected exactly {EXPECTED_AMOUNT_GRAM_NULLS})', file=sys.stderr)
            failed = True
    except Exception as exc:
        print(f'[ERR] amount_gram NULL check: {exc}', file=sys.stderr)
        failed = True

    cur.close()
    conn.close()

    print()
    if failed:
        print('[FAIL] Pre-publish integrity checks failed -- do not publish',
              file=sys.stderr)
        sys.exit(1)

    print('[PASS] All pre-publish integrity checks passed -- safe to publish')
    sys.exit(0)


if __name__ == '__main__':
    main()
