"""
VS-2 Stage 2: Export recipe-ingredient relationships from recipes.db -> staging.recipe_ingredients

Source: recipes.db -> recipe_ingredients table (679,457 rows)
Target: staging.recipe_ingredients (new isolated Supabase project)
Note  : Relationship data only -- not counted in the 183,821 runtime master total.
        ingredient_id=1124336 was confirmed to have 0 recipe_ingredients references (audit 2026-08-25).
        No reject rows needed for this table.

Usage:
    # Dry-run (no DB writes):
    python scripts/vs2_export_recipe_ingredients.py

    # Load to staging:
    SUPABASE_DB_URL=postgres://... python scripts/vs2_export_recipe_ingredients.py

Environment variables:
    SUPABASE_DB_URL  -- postgres://... (service-role, new project only)
    RECIPES_DB_PATH  -- override path to recipes.db

Column mapping (recipes.db -> staging.recipe_ingredients):
    recipe_id     INTEGER -> recipe_id (FK -> public.recipes)
    ingredient_id INTEGER -> ingredient_id (FK -> public.ingredients)
    amount_raw    TEXT    -> amount_raw
    unit_raw      TEXT    -> unit_raw
    amount_gram   REAL    -> amount_gram (NUMERIC(10,2))
                             Anomaly: recipe_id=6936777 / ingredient_id=1119343 /
                             sort_order=8 has amount_gram=1040500665.0 (overflows
                             NUMERIC(10,2)). Row is kept; amount_gram set to NULL.
    sort_order    INTEGER -> sort_order
    is_seasoning  INTEGER (0/1) -> is_seasoning (BOOLEAN)
"""

import os
import sqlite3
import sys
import uuid
from datetime import date
from pathlib import Path

RECIPES_DB_PATH = Path(os.environ.get("FOODGROUND_RECIPE_DB") or os.environ.get("RECIPES_DB_PATH") or "")
EXPECTED_ROWS = 679_457
BASIS_DATE = date(2026, 8, 25)
PUBLISH_VERSION = "vs2-2026-08-25"

# Chunk size for streaming large table
_CHUNK = 5_000

# NUMERIC(10,2) max representable value: 99,999,999.99
# Any amount_gram at or above this threshold overflows the column.
_NUMERIC_10_2_MAX = 99_999_999.99

# Confirmed anomaly: exactly 1 row is expected.
# Abort if a different count is found during dry-run or load.
_EXPECTED_ANOMALIES = 1
_ANOMALY_KEY = (6936777, 1119343, 8)  # (recipe_id, ingredient_id, sort_order)


def _safe_amount_gram(r: dict) -> object:
    """Return amount_gram, replacing confirmed overflow with None.

    Aborts (raises ValueError) if an unconfirmed overflow row is encountered.
    """
    val = r["amount_gram"]
    if val is None or val <= _NUMERIC_10_2_MAX:
        return val
    key = (r["recipe_id"], r["ingredient_id"], r["sort_order"])
    if key != _ANOMALY_KEY:
        raise ValueError(
            f"Unconfirmed amount_gram overflow: recipe_id={r['recipe_id']} "
            f"ingredient_id={r['ingredient_id']} sort_order={r['sort_order']} "
            f"amount_gram={val}"
        )
    return None


def stream_rows(path: Path):
    """Yield rows from recipe_ingredients in chunks to avoid memory spike."""
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT
            recipe_id,
            ingredient_id,
            amount_raw,
            unit_raw,
            amount_gram,
            sort_order,
            is_seasoning
        FROM recipe_ingredients
        ORDER BY recipe_id, sort_order, ingredient_id
    """)
    while True:
        chunk = cur.fetchmany(_CHUNK)
        if not chunk:
            break
        yield [dict(r) for r in chunk]
    conn.close()


def count_source(path: Path) -> int:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM recipe_ingredients")
    n = cur.fetchone()[0]
    conn.close()
    return n


def main() -> None:
    if not str(RECIPES_DB_PATH):
        print("ERROR: FOODGROUND_RECIPE_DB (or RECIPES_DB_PATH) env var not set.", file=sys.stderr)
        sys.exit(1)
    if not RECIPES_DB_PATH.exists():
        print(f"ERROR: recipes.db not found: {RECIPES_DB_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Source      : {RECIPES_DB_PATH}")
    print("Counting recipe_ingredients rows...")
    source_count = count_source(RECIPES_DB_PATH)
    print(f"Source count: {source_count}")

    if source_count != EXPECTED_ROWS:
        print(
            f"ERROR: expected {EXPECTED_ROWS}, got {source_count}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Validation  : PASS (row count={source_count})")
    print(f"Relationship data only -- not counted in 183,821 runtime master total.")

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("\nSUPABASE_DB_URL not set -- dry-run: validating all rows...")
        total_checked = 0
        is_seasoning_null = 0
        anomaly_count = 0
        try:
            for chunk in stream_rows(RECIPES_DB_PATH):
                for r in chunk:
                    if r["is_seasoning"] is None:
                        is_seasoning_null += 1
                    safe_val = _safe_amount_gram(r)
                    if safe_val is None and r["amount_gram"] is not None:
                        anomaly_count += 1
                    total_checked += 1
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            sys.exit(1)
        errors = []
        if total_checked != EXPECTED_ROWS:
            errors.append(f"row count: {total_checked} (expected {EXPECTED_ROWS})")
        if is_seasoning_null > 0:
            errors.append(f"NULL is_seasoning: {is_seasoning_null}")
        if anomaly_count != _EXPECTED_ANOMALIES:
            errors.append(
                f"amount_gram anomalies: {anomaly_count} (expected {_EXPECTED_ANOMALIES})"
            )
        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
        print(f"PASS: {total_checked:,} rows checked")
        print(f"PASS: is_seasoning -- all Python bool-convertible (0 NULL)")
        print(f"PASS: amount_gram nullified anomaly: {anomaly_count}")
        print("Dry-run complete (no DB writes).")
        return

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                run_id = str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO private.data_lineage
                       (id, dataset_name, source_path, source_sha256, row_count,
                        reject_count, basis_date, publish_version)
                       VALUES (%s,'recipe_ingredients',%s,NULL,%s,0,%s,%s)""",
                    (run_id, str(RECIPES_DB_PATH), source_count, BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.recipe_ingredients")

                loaded = 0
                anomaly_count = 0
                for chunk in stream_rows(RECIPES_DB_PATH):
                    rows = []
                    for r in chunk:
                        safe_gram = _safe_amount_gram(r)
                        if safe_gram is None and r["amount_gram"] is not None:
                            anomaly_count += 1
                            if anomaly_count > _EXPECTED_ANOMALIES:
                                raise RuntimeError(
                                    f"Unconfirmed amount_gram anomaly count exceeds "
                                    f"{_EXPECTED_ANOMALIES}. Aborting."
                                )
                        rows.append((
                            r["recipe_id"], r["ingredient_id"],
                            r["amount_raw"], r["unit_raw"],
                            safe_gram, r["sort_order"],
                            bool(r["is_seasoning"]),
                        ))
                    psycopg2.extras.execute_batch(
                        cur,
                        """INSERT INTO staging.recipe_ingredients
                           (recipe_id, ingredient_id, amount_raw, unit_raw,
                            amount_gram, sort_order, is_seasoning)
                           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                        rows,
                        page_size=_CHUNK,
                    )
                    loaded += len(chunk)
                    if loaded % 50_000 == 0:
                        print(f"  ... {loaded:,} rows loaded")

                print(f"amount_gram nullified anomaly: {anomaly_count}")

                cur.execute("SELECT count(*) FROM staging.recipe_ingredients")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_ROWS

        print(f"DB load     : {db_count} rows in staging.recipe_ingredients")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
