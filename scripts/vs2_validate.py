"""
VS-2 Validation Script: row counts, FK integrity, duplicates, missing values,
match_type distribution.

Usage:
    # Local dry-run (CSV + SQLite sources, no DB):
    python scripts/vs2_validate.py --mode csv

    # DB validation (staging tables):
    SUPABASE_DB_URL=postgres://... python scripts/vs2_validate.py --mode staging

    # DB validation (public tables, post-publish):
    SUPABASE_DB_URL=postgres://... python scripts/vs2_validate.py --mode public

Environment variables:
    SUPABASE_DB_URL  -- postgres://... (service-role connection)
    DATA_DIR         -- override path to analysis_outputs/ directory
    RECIPES_DB_PATH  -- override path to recipes.db
    SQLITE_PATH      -- override path to foodground.db (facilities)

BASELINE SEPARATION:
    Analysis baseline  : recipe_ingredients.csv (69,406 unique recipes + 553,763 rows)
                         standard_foods.csv (686), ingredient_matching.csv (23,806),
                         food_pair_similarities.csv (234,955)
    Runtime master     : recipes.db -> recipes (70,165), ingredients (18,932)
                         foodground.db -> facilities (94,723)
    Relationship data  : recipes.db -> recipe_ingredients (679,457) [not in master count]
"""

import argparse
import csv
import os
import sqlite3
import sys
from pathlib import Path

DATA_DIR = Path(os.environ.get("FOODGROUND_ANALYSIS_DIR") or os.environ.get("DATA_DIR") or "")
RECIPES_DB_PATH = Path(os.environ.get("FOODGROUND_RECIPE_DB") or os.environ.get("RECIPES_DB_PATH") or "")
SQLITE_PATH = Path(os.environ.get("FOODGROUND_FACILITY_DB") or os.environ.get("SQLITE_PATH") or "")

# DB mode expected counts (runtime master tables)
EXPECTED_DB = {
    "standard_foods":        686,
    "substitute_pairs":      234_955,
    "ingredient_name_match": 23_806,
    "recipes":               70_165,   # runtime master from recipes.db
    "ingredients":           18_932,   # 18,933 source - 1 rejected (NULL name)
    "recipe_ingredients":    679_457,  # relationship data
    "facilities":            94_723,
}

EXPECTED_MATCH_TYPES = {
    "exact":     488,
    "substring": 11_764,
    "fuzzy":     295,
    "synonym":   35,
    "unmatched": 11_224,
}


# ============================================================
# CSV mode: validate analysis CSVs + SQLite sources locally
# ============================================================

def csv_count(filepath: Path) -> int:
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        return sum(1 for _ in csv.DictReader(f))


def sqlite_count(path: Path, table: str) -> int:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    cur = conn.cursor()
    cur.execute(f"SELECT count(*) FROM {table}")
    n = cur.fetchone()[0]
    conn.close()
    return n


def validate_csv_mode() -> bool:
    print("=== Local Mode: validating analysis CSVs + SQLite sources ===\n")
    ok = True

    # -- Analysis baseline CSVs (directly in analysis_outputs/) --
    print("--- Analysis baseline CSVs ---")
    csv_specs = {
        "standard_foods":        (DATA_DIR / "food_master.csv",             686),
        "substitute_pairs":      (DATA_DIR / "food_pair_similarities.csv",   234_955),
        "ingredient_name_match": (DATA_DIR / "ingredient_matching.csv",      23_806),
        "recipe_ingredients_csv":(DATA_DIR / "recipe_ingredients.csv",       553_763),
    }

    for name, (path, exp) in csv_specs.items():
        if not path.exists():
            print(f"  MISSING : {path}")
            ok = False
            continue
        count = csv_count(path)
        status = "OK" if count == exp else f"FAIL (expected {exp})"
        print(f"  {name:30s}: {count:7d}  {status}")
        if "FAIL" in status:
            ok = False

    # match_type distribution check on ingredient_matching.csv
    src = DATA_DIR / "ingredient_matching.csv"
    if src.exists():
        type_counts: dict = {}
        with open(src, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                mt = row.get("재료매칭방법", "").strip()
                type_counts[mt] = type_counts.get(mt, 0) + 1
        print("\n  match_type distribution (ingredient_matching.csv):")
        METHOD_MAP = {
            "완전일치": "exact", "포함일치": "substring",
            "철자유사": "fuzzy", "동의어": "synonym", "미매칭": "unmatched",
        }
        for kor, eng in METHOD_MAP.items():
            cnt = type_counts.get(kor, 0)
            exp = EXPECTED_MATCH_TYPES[eng]
            status = "OK" if cnt == exp else f"FAIL (expected {exp})"
            print(f"    {kor} ({eng}): {cnt} {status}")
            if "FAIL" in status:
                ok = False

    # -- Runtime master: recipes.db --
    print("\n--- Runtime master: recipes.db ---")
    if not RECIPES_DB_PATH.exists():
        print(f"  MISSING : {RECIPES_DB_PATH}")
        ok = False
    else:
        # recipes (source total; 0 NULLs confirmed)
        recipes_count = sqlite_count(RECIPES_DB_PATH, "recipes")
        exp = 70_165
        status = "OK" if recipes_count == exp else f"FAIL (expected {exp})"
        print(f"  {'recipes (source)':30s}: {recipes_count:7d}  {status}")
        if "FAIL" in status:
            ok = False

        # ingredients (source total; 1 NULL reject)
        ing_count = sqlite_count(RECIPES_DB_PATH, "ingredients")
        exp_src = 18_933
        status = "OK" if ing_count == exp_src else f"FAIL (expected {exp_src})"
        print(f"  {'ingredients (source)':30s}: {ing_count:7d}  {status}")
        if "FAIL" in status:
            ok = False

        # ingredients after reject (NULL names)
        conn = sqlite3.connect(f"file:{RECIPES_DB_PATH}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM ingredients WHERE ingredient_name IS NULL OR ingredient_name = ''")
        null_count = cur.fetchone()[0]
        conn.close()
        exp_reject = 1
        status = "OK" if null_count == exp_reject else f"FAIL (expected {exp_reject} null)"
        print(f"  {'ingredients NULL name (reject)':30s}: {null_count:7d}  {status}")
        if "FAIL" in status:
            ok = False
        print(f"  {'ingredients after reject':30s}: {ing_count - null_count:7d}  "
              f"{'OK' if ing_count - null_count == 18_932 else 'FAIL (expected 18,932)'}")
        if ing_count - null_count != 18_932:
            ok = False

        # recipe_ingredients
        ri_count = sqlite_count(RECIPES_DB_PATH, "recipe_ingredients")
        exp_ri = 679_457
        status = "OK" if ri_count == exp_ri else f"FAIL (expected {exp_ri})"
        print(f"  {'recipe_ingredients':30s}: {ri_count:7d}  {status}")
        if "FAIL" in status:
            ok = False

    # -- Runtime master: facilities (foodground.db) --
    print("\n--- Runtime master: foodground.db ---")
    if not SQLITE_PATH.exists():
        print(f"  MISSING : {SQLITE_PATH}")
        ok = False
    else:
        fac_count = sqlite_count(SQLITE_PATH, "facility")
        exp = 94_723
        status = "OK" if fac_count == exp else f"FAIL (expected {exp})"
        print(f"  {'facilities (source)':30s}: {fac_count:7d}  {status}")
        if "FAIL" in status:
            ok = False

    print()
    return ok


# ============================================================
# DB mode: validate staging or public tables
# ============================================================

def validate_db_mode(mode: str) -> bool:
    """mode: 'staging' or 'public'"""
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print("ERROR: pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    schema = "staging" if mode == "staging" else "public"
    print(f"=== DB Mode ({mode}): validating {schema}.* tables ===\n")

    conn = psycopg2.connect(db_url)
    ok = True
    try:
        with conn.cursor() as cur:

            # 1. Row count checks
            print("--- Row count checks ---")
            tables = [
                "standard_foods",
                "substitute_pairs",
                "ingredient_name_match",
                "recipes",
                "ingredients",
                "recipe_ingredients",
                "facilities",
            ]

            for tbl in tables:
                table_ref = f"{schema}.{tbl}"
                try:
                    cur.execute(f"SELECT count(*) FROM {table_ref}")
                    cnt = cur.fetchone()[0]
                    exp = EXPECTED_DB[tbl]
                    status = "OK" if cnt == exp else f"FAIL (expected {exp:,})"
                    print(f"  {table_ref:55s}: {cnt:7,}  {status}")
                    if cnt != exp:
                        ok = False
                except Exception as e:
                    print(f"  {table_ref}: ERROR -- {e}")
                    ok = False

            # 2. NOT NULL checks
            print("\n--- NOT NULL checks ---")
            notnull_checks = [
                (f"{schema}.standard_foods",        "standard_food_id"),
                (f"{schema}.standard_foods",        "name"),
                (f"{schema}.substitute_pairs",      '"기준식품ID"'),
                (f"{schema}.substitute_pairs",      '"후보식품ID"'),
                (f"{schema}.substitute_pairs",      "score_final"),
                (f"{schema}.ingredient_name_match", "input_name"),
                (f"{schema}.ingredient_name_match", "match_type"),
                (f"{schema}.recipes",               "recipe_id"),
                (f"{schema}.recipes",               "title"),
                (f"{schema}.ingredients",           "ingredient_id"),
                (f"{schema}.ingredients",           "ingredient_name"),
                (f"{schema}.recipe_ingredients",    "recipe_id"),
                (f"{schema}.recipe_ingredients",    "ingredient_id"),
                (f"{schema}.facilities",            "mgt_no"),
                (f"{schema}.facilities",            "name"),
            ]
            for table_ref, col in notnull_checks:
                try:
                    cur.execute(f"SELECT count(*) FROM {table_ref} WHERE {col} IS NULL")
                    null_cnt = cur.fetchone()[0]
                    status = "OK" if null_cnt == 0 else f"FAIL ({null_cnt} NULL rows)"
                    print(f"  {table_ref}.{col}: {status}")
                    if null_cnt != 0:
                        ok = False
                except Exception as e:
                    print(f"  {table_ref}.{col}: ERROR -- {e}")

            # 3. Duplicate PK checks (staging only -- public has UNIQUE constraint)
            if mode == "staging":
                print("\n--- Duplicate PK checks (staging) ---")
                dup_checks = [
                    (f"staging.standard_foods",        "standard_food_id"),
                    (f"staging.ingredient_name_match",  "input_name"),
                    (f"staging.recipes",                "recipe_id"),
                    (f"staging.ingredients",            "ingredient_id"),
                    (f"staging.ingredients",            "ingredient_name"),
                    (f"staging.facilities",             "mgt_no"),
                ]
                for table_ref, pk_col in dup_checks:
                    try:
                        cur.execute(
                            f"SELECT count(*) FROM ("
                            f"  SELECT {pk_col}, count(*) c FROM {table_ref} "
                            f"  GROUP BY {pk_col} HAVING count(*) > 1"
                            f") sub"
                        )
                        dup_cnt = cur.fetchone()[0]
                        status = "OK" if dup_cnt == 0 else f"FAIL ({dup_cnt} duplicate PKs)"
                        print(f"  {table_ref}.{pk_col}: {status}")
                        if dup_cnt != 0:
                            ok = False
                    except Exception as e:
                        print(f"  {table_ref}: ERROR -- {e}")

            # 4. Rejected ingredient not present
            print("\n--- Reject checks ---")
            try:
                cur.execute(
                    f"SELECT count(*) FROM {schema}.ingredients "
                    f"WHERE ingredient_id = 1124336"
                )
                rej = cur.fetchone()[0]
                status = "OK" if rej == 0 else f"FAIL (rejected id=1124336 is present)"
                print(f"  {schema}.ingredients ingredient_id=1124336 (rejected): {status}")
                if rej != 0:
                    ok = False
            except Exception as e:
                print(f"  reject check: ERROR -- {e}")

            # 5. match_type distribution
            print("\n--- ingredient_name_match.match_type distribution ---")
            try:
                cur.execute(
                    f"SELECT match_type, count(*) FROM {schema}.ingredient_name_match "
                    f"GROUP BY match_type ORDER BY count(*) DESC"
                )
                for row in cur.fetchall():
                    mt, cnt = row
                    exp = EXPECTED_MATCH_TYPES.get(mt, "?")
                    status = "OK" if cnt == exp else f"MISMATCH (expected {exp})"
                    print(f"  {mt:12s}: {cnt:6d}  {status}")
                    if cnt != exp:
                        ok = False
            except Exception as e:
                print(f"  ERROR: {e}")

            # 6. Unmatched invariant
            print("\n--- Unmatched rows invariant ---")
            try:
                cur.execute(
                    f"SELECT count(*) FROM {schema}.ingredient_name_match "
                    f"WHERE match_type='unmatched' AND standard_food_id IS NOT NULL"
                )
                bad = cur.fetchone()[0]
                status = "OK" if bad == 0 else f"FAIL ({bad} unmatched with non-NULL standard_food_id)"
                print(f"  unmatched with non-NULL standard_food_id: {status}")
                if bad != 0:
                    ok = False
            except Exception as e:
                print(f"  ERROR: {e}")

            # 7. substitute_pairs score range
            print("\n--- substitute_pairs score range ---")
            try:
                cur.execute(
                    f"SELECT min(score_final), max(score_final), avg(score_final)::numeric(6,4) "
                    f"FROM {schema}.substitute_pairs"
                )
                mn, mx, avg = cur.fetchone()
                print(f"  score_final: min={mn}  max={mx}  avg={avg}")
                if mn is None or mn < 0 or mx > 1:
                    print("  WARNING: score out of [0,1] range")
            except Exception as e:
                print(f"  ERROR: {e}")

            # 8. recipe_ingredients FK spot-check (staging only)
            if mode == "staging":
                print("\n--- recipe_ingredients: distinct counts ---")
                try:
                    cur.execute(
                        f"SELECT count(DISTINCT recipe_id) FROM staging.recipe_ingredients"
                    )
                    dr = cur.fetchone()[0]
                    status = "OK" if dr == 70_165 else f"WARN (expected 70,165 distinct recipe_ids)"
                    print(f"  distinct recipe_id in recipe_ingredients: {dr:7,}  {status}")
                except Exception as e:
                    print(f"  ERROR: {e}")

    finally:
        conn.close()

    print(f"\n{'=== VALIDATION PASS ===' if ok else '=== VALIDATION FAIL ==='}")
    return ok


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["csv", "staging", "public"], default="csv")
    args = parser.parse_args()

    if args.mode == "csv":
        ok = validate_csv_mode()
    else:
        ok = validate_db_mode(args.mode)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
