"""
VS-2 Stage 2: Export recipe master from recipes.db -> staging.recipes

Source: recipes.db -> recipes table (70,165 rows; web runtime master)
Target: staging.recipes (new isolated Supabase project)

BASELINE SEPARATION (do not mix):
  Web runtime master  : recipes.db -> 70,165 rows  (this script)
  Analysis baseline   : recipe_ingredients.csv -> 69,406 unique recipes (pipeline CSVs)

Usage:
    # Dry-run (no DB writes):
    python scripts/vs2_export_recipes_master.py

    # Load to staging:
    SUPABASE_DB_URL=postgres://... python scripts/vs2_export_recipes_master.py

Environment variables:
    SUPABASE_DB_URL  -- postgres://... (service-role, new project only)
    RECIPES_DB_PATH  -- override path to recipes.db

Column mapping (recipes.db -> staging.recipes):
    recipe_id      INTEGER   -> recipe_id (PK)
    title          TEXT      -> title
    category_large TEXT      -> category_large
    category_mid   TEXT      -> category_mid
    category_small TEXT      -> category_small
    servings       INTEGER   -> servings
    raw_text       TEXT      -> EXCLUDED (too large for web runtime)
"""

import os
import sqlite3
import sys
import uuid
from datetime import date
from pathlib import Path

RECIPES_DB_PATH = Path(os.environ.get("FOODGROUND_RECIPE_DB") or os.environ.get("RECIPES_DB_PATH") or "")
EXPECTED_ROWS = 70_165
BASIS_DATE = date(2026, 8, 25)
PUBLISH_VERSION = "vs2-2026-08-25"


def load_rows(path: Path) -> list[dict]:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT
            recipe_id,
            title,
            category_large,
            category_mid,
            category_small,
            servings
        FROM recipes
        ORDER BY recipe_id
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def validate_rows(rows: list[dict]) -> list[str]:
    errors = []
    seen: set = set()
    for i, r in enumerate(rows):
        if r.get("recipe_id") is None:
            errors.append(f"row {i}: NULL recipe_id")
        if r["recipe_id"] in seen:
            errors.append(f"row {i}: duplicate recipe_id={r['recipe_id']}")
        seen.add(r["recipe_id"])
        if not r.get("title"):
            errors.append(f"row {i}: NULL/empty title (recipe_id={r['recipe_id']})")
    return errors


def main() -> None:
    if not str(RECIPES_DB_PATH):
        print("ERROR: FOODGROUND_RECIPE_DB (or RECIPES_DB_PATH) env var not set.", file=sys.stderr)
        sys.exit(1)
    if not RECIPES_DB_PATH.exists():
        print(f"ERROR: recipes.db not found: {RECIPES_DB_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Source      : {RECIPES_DB_PATH}")
    print("Loading rows from recipes table...")
    rows = load_rows(RECIPES_DB_PATH)
    print(f"Rows loaded : {len(rows)}")
    assert len(rows) == EXPECTED_ROWS, f"Expected {EXPECTED_ROWS}, got {len(rows)}"

    errors = validate_rows(rows)
    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    print("Validation  : PASS (row count, unique recipe_id, NOT NULL title)")

    sample = rows[0]
    print(
        f"Sample      : recipe_id={sample['recipe_id']}"
        f"  title={sample['title']!r}"
        f"  category_large={sample['category_large']!r}"
    )

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("\nSUPABASE_DB_URL not set -- dry-run complete (no DB writes).")
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
                       VALUES (%s,'recipes',%s,NULL,%s,0,%s,%s)""",
                    (run_id, str(RECIPES_DB_PATH), len(rows), BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.recipes")

                psycopg2.extras.execute_batch(
                    cur,
                    """INSERT INTO staging.recipes
                       (recipe_id, title, category_large, category_mid, category_small,
                        servings, ingest_run_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    [
                        (
                            r["recipe_id"], r["title"],
                            r["category_large"], r["category_mid"], r["category_small"],
                            r["servings"], run_id,
                        )
                        for r in rows
                    ],
                    page_size=500,
                )

                cur.execute("SELECT count(*) FROM staging.recipes")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_ROWS

        print(f"DB load     : {db_count} rows in staging.recipes")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
