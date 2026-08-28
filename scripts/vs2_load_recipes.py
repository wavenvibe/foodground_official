"""
VS-2 Stage 2: Load recipes from recipe_ingredients.csv → staging_recipes

Usage:
    python scripts/vs2_load_recipes.py

Environment variables required:
    SUPABASE_DB_URL  -- postgres://... (service-role connection)
    DATA_DIR         -- path to final_output/ directory (default: ./final_output)

This script:
  1. Reads final_output/recipe_ingredients.csv (UTF-8 BOM, 553,763 rows)
  2. Extracts 69,406 unique recipes (레시피일련번호, 요리명, 요리종류별명, 요리종류별명_세분화)
     — first occurrence per recipe_id wins
  3. Inserts rows into staging_recipes
  4. Inserts one row into private.data_lineage
"""

import csv
import hashlib
import os
import sys
import uuid
from datetime import date
from pathlib import Path

DATA_DIR = Path(os.environ.get("FOODGROUND_ANALYSIS_DIR") or os.environ.get("DATA_DIR") or "")
SOURCE_FILE = DATA_DIR / "recipe_ingredients.csv"
EXPECTED_TOTAL_ROWS = 553_763
EXPECTED_UNIQUE_RECIPES = 69_406
BASIS_DATE = date(2026, 8, 18)
PUBLISH_VERSION = "vs2-2026-08-25"
EXPECTED_SHA = "9b7d557714214149d137bd6f37c8b67abf3f19b6ed126bed864b95a21bf9e9ff"

VALID_CATEGORIES = {
    "메인반찬", "밑반찬", "밥/죽/떡", "국/탕", "면/만두",
    "찌개", "김치/젓갈/장류", "기타", "양념/소스/잼", "퓨전",
}


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def extract_unique_recipes(source_path: Path):
    seen = {}  # recipe_id → row dict
    total = 0
    with open(source_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            total += 1
            rid = raw.get("레시피일련번호", "").strip()
            if not rid:
                continue
            if rid not in seen:
                seen[rid] = {
                    "recipe_id":       rid,
                    "name":            raw.get("요리명", "").strip() or None,
                    "category":        raw.get("요리종류별명", "").strip() or None,
                    "category_detail": raw.get("요리종류별명_세분화", "").strip() or None,
                }
    return list(seen.values()), total


def validate_rows(rows):
    errors = []
    ids_seen = set()
    category_counts = {}
    for i, r in enumerate(rows):
        if not r["recipe_id"]:
            errors.append(f"row {i}: NULL recipe_id")
        if r["recipe_id"] in ids_seen:
            errors.append(f"row {i}: duplicate recipe_id={r['recipe_id']}")
        ids_seen.add(r["recipe_id"])
        if not r["name"]:
            errors.append(f"row {i}: NULL name (id={r['recipe_id']})")
        cat = r.get("category")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    return errors, category_counts


def main():
    if not SOURCE_FILE.exists():
        print(f"ERROR: not found: {SOURCE_FILE}", file=sys.stderr)
        sys.exit(1)

    sha256 = sha256_of_file(SOURCE_FILE)
    print(f"Source file : {SOURCE_FILE}")
    print(f"SHA-256     : {sha256}")
    if sha256 != EXPECTED_SHA:
        print(f"WARNING: SHA-256 mismatch. Expected: {EXPECTED_SHA}", file=sys.stderr)

    print("Extracting unique recipes (553,763 rows — may take ~60 s)...")
    rows, total_rows = extract_unique_recipes(SOURCE_FILE)
    print(f"Total rows  : {total_rows}")
    print(f"Unique recs : {len(rows)}")
    assert total_rows == EXPECTED_TOTAL_ROWS, f"Expected {EXPECTED_TOTAL_ROWS} total rows"
    assert len(rows) == EXPECTED_UNIQUE_RECIPES, f"Expected {EXPECTED_UNIQUE_RECIPES} unique recipes"

    errors, category_counts = validate_rows(rows)
    print("Category distribution:")
    for cat, cnt in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {(cat or 'NULL'):20s}: {cnt:6d}")

    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    print("Validation  : PASS")

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("\nSUPABASE_DB_URL not set — dry-run complete.")
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
                       VALUES (%s,'recipes',%s,%s,%s,0,%s,%s)""",
                    (run_id, str(SOURCE_FILE.relative_to(DATA_DIR.parent)),
                     sha256, len(rows), BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.recipes")

                psycopg2.extras.execute_batch(
                    cur,
                    """INSERT INTO staging.recipes
                       (recipe_id, name, category, category_detail, basis_date, ingest_run_id)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    [(r["recipe_id"], r["name"], r["category"],
                      r["category_detail"], BASIS_DATE, run_id) for r in rows],
                    page_size=500,
                )

                cur.execute("SELECT count(*) FROM staging.recipes")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_UNIQUE_RECIPES

        print(f"DB load     : {db_count} rows in staging.recipes")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
