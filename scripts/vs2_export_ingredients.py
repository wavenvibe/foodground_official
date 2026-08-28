"""
VS-2 Stage 2: Export ingredients from recipes.db -> staging.ingredients

Source: recipes.db -> ingredients table (18,933 rows)
Reject: ingredient_id=1124336 (ingredient_name IS NULL) -- 0 FK references, safe to exclude
Loaded: 18,932 rows; reject_count=1 recorded in private.data_lineage
Target: staging.ingredients (new isolated Supabase project)

Usage:
    # Dry-run (no DB writes):
    python scripts/vs2_export_ingredients.py

    # Load to staging:
    SUPABASE_DB_URL=postgres://... python scripts/vs2_export_ingredients.py

Environment variables:
    SUPABASE_DB_URL  -- postgres://... (service-role, new project only)
    RECIPES_DB_PATH  -- override path to recipes.db

Column mapping (recipes.db -> staging.ingredients):
    ingredient_id   INTEGER -> ingredient_id (PK)
    ingredient_name TEXT    -> ingredient_name (NOT NULL UNIQUE)
"""

import os
import sqlite3
import sys
import uuid
from datetime import date
from pathlib import Path

RECIPES_DB_PATH = Path(os.environ.get("FOODGROUND_RECIPE_DB") or os.environ.get("RECIPES_DB_PATH") or "")

# Source total before reject
SOURCE_TOTAL = 18_933
# After rejecting ingredient_id=1124336 (NULL name)
EXPECTED_LOADED = 18_932
REJECT_COUNT = 1
REJECT_IDS = {1124336}  # ingredient_id values with NULL name

BASIS_DATE = date(2026, 8, 25)
PUBLISH_VERSION = "vs2-2026-08-25"


def load_rows(path: Path) -> tuple[list[dict], list[dict]]:
    """Returns (accepted_rows, rejected_rows)."""
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT ingredient_id, ingredient_name
        FROM ingredients
        ORDER BY ingredient_id
    """)
    all_rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    accepted = []
    rejected = []
    for r in all_rows:
        if r["ingredient_id"] in REJECT_IDS or not r.get("ingredient_name"):
            rejected.append(r)
        else:
            accepted.append(r)
    return accepted, rejected


def validate_rows(rows: list[dict]) -> list[str]:
    errors = []
    seen: set = set()
    seen_names: set = set()
    for i, r in enumerate(rows):
        if r.get("ingredient_id") is None:
            errors.append(f"row {i}: NULL ingredient_id")
        if r["ingredient_id"] in seen:
            errors.append(f"row {i}: duplicate ingredient_id={r['ingredient_id']}")
        seen.add(r["ingredient_id"])
        if not r.get("ingredient_name"):
            errors.append(f"row {i}: NULL/empty ingredient_name (id={r['ingredient_id']})")
        if r.get("ingredient_name") in seen_names:
            errors.append(f"row {i}: duplicate ingredient_name={r['ingredient_name']!r}")
        seen_names.add(r.get("ingredient_name"))
    return errors


def main() -> None:
    if not str(RECIPES_DB_PATH):
        print("ERROR: FOODGROUND_RECIPE_DB (or RECIPES_DB_PATH) env var not set.", file=sys.stderr)
        sys.exit(1)
    if not RECIPES_DB_PATH.exists():
        print(f"ERROR: recipes.db not found: {RECIPES_DB_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Source      : {RECIPES_DB_PATH}")
    print("Loading rows from ingredients table...")
    accepted, rejected = load_rows(RECIPES_DB_PATH)

    print(f"Source total: {SOURCE_TOTAL}")
    print(f"Rejected    : {len(rejected)} rows")
    for r in rejected:
        print(f"  ingredient_id={r['ingredient_id']}  name={r['ingredient_name']!r}  [REJECT: NULL name]")

    if len(rejected) != REJECT_COUNT:
        print(
            f"ERROR: expected {REJECT_COUNT} reject(s), got {len(rejected)}",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(accepted) != EXPECTED_LOADED:
        print(
            f"ERROR: expected {EXPECTED_LOADED} accepted rows, got {len(accepted)}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Accepted    : {len(accepted)} rows")

    errors = validate_rows(accepted)
    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    print("Validation  : PASS (count, unique ingredient_id, NOT NULL name)")

    sample = accepted[0]
    print(f"Sample      : ingredient_id={sample['ingredient_id']}  name={sample['ingredient_name']!r}")

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
                       VALUES (%s,'ingredients',%s,NULL,%s,%s,%s,%s)""",
                    (
                        run_id, str(RECIPES_DB_PATH),
                        len(accepted), len(rejected),
                        BASIS_DATE, PUBLISH_VERSION,
                    )
                )

                cur.execute("TRUNCATE staging.ingredients")

                psycopg2.extras.execute_batch(
                    cur,
                    """INSERT INTO staging.ingredients
                       (ingredient_id, ingredient_name, ingest_run_id)
                       VALUES (%s, %s, %s)""",
                    [
                        (r["ingredient_id"], r["ingredient_name"], run_id)
                        for r in accepted
                    ],
                    page_size=500,
                )

                cur.execute("SELECT count(*) FROM staging.ingredients")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_LOADED

        print(f"DB load     : {db_count} rows in staging.ingredients (reject_count={len(rejected)})")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
