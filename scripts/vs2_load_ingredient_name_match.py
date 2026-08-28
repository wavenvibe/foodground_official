"""
VS-2 Stage 2: Load ingredient_name_match from ingredient_matching.csv
              → staging_ingredient_name_match

Usage:
    python scripts/vs2_load_ingredient_name_match.py

Environment variables required:
    SUPABASE_DB_URL  -- postgres://... (service-role connection)
    DATA_DIR         -- path to final_output/ directory (default: ./final_output)

This script:
  1. Reads final_output/ingredient_matching.csv (UTF-8 BOM, 23,806 rows)
  2. Builds a 표준재료→식품ID lookup from recipe_ingredients.csv (577 pairs)
  3. Maps 재료매칭방법 (Korean) → match_type (English enum)
  4. For matched rows: looks up standard_food_id via 표준재료→식품ID
  5. For 미매칭 rows: standard_food_id = NULL, match_type = 'unmatched'
  6. Inserts 23,806 rows into staging_ingredient_name_match

Korean → English match_type mapping:
    완전일치 → 'exact'
    포함일치 → 'substring'
    철자유사 → 'fuzzy'
    동의어   → 'synonym'
    미매칭   → 'unmatched'
"""

import csv
import hashlib
import os
import sys
import uuid
from datetime import date
from pathlib import Path

DATA_DIR = Path(os.environ.get("FOODGROUND_ANALYSIS_DIR") or os.environ.get("DATA_DIR") or "")
SOURCE_FILE = DATA_DIR / "ingredient_matching.csv"
RECIPE_FILE = DATA_DIR / "recipe_ingredients.csv"
EXPECTED_ROWS = 23_806
EXPECTED_MATCHED = 12_582
EXPECTED_UNMATCHED = 11_224
BASIS_DATE = date(2026, 8, 18)
PUBLISH_VERSION = "vs2-2026-08-25"
EXPECTED_SHA = "91277d6eda926d71ef67cd2c93f593d683afc4dce59661abdeb4d80aec12ec8f"

MATCH_TYPE_MAP = {
    "완전일치": "exact",
    "포함일치": "substring",
    "철자유사": "fuzzy",
    "동의어":   "synonym",
    "미매칭":   "unmatched",
}

EXPECTED_TYPE_COUNTS = {
    "exact":     488,
    "substring": 11_764,
    "fuzzy":     295,
    "synonym":   35,
    "unmatched": 11_224,
}


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build_standard_material_to_food_id(recipe_file: Path) -> dict:
    """Build {표준재료: 식품ID} from recipe_ingredients.csv (577 unique pairs)."""
    mapping = {}
    with open(recipe_file, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            std = row.get("표준재료", "").strip()
            fid = row.get("식품ID", "").strip()
            if std and fid and std not in mapping:
                mapping[std] = fid
    return mapping


def load_rows(source_path: Path, std_to_id: dict):
    rows = []
    with open(source_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            stripped = {k.strip(): v.strip() for k, v in raw.items()}
            input_name = stripped.get("재료명", "")
            std_material = stripped.get("표준재료", "")
            confidence_str = stripped.get("재료매칭신뢰도", "")
            method_kor = stripped.get("재료매칭방법", "")

            match_type = MATCH_TYPE_MAP.get(method_kor)
            if match_type is None:
                print(f"WARNING: unknown 재료매칭방법 value: {method_kor!r}", file=sys.stderr)
                match_type = "unmatched"

            if match_type == "unmatched":
                standard_food_id = None
                confidence = None
            else:
                standard_food_id = std_to_id.get(std_material)
                if standard_food_id is None:
                    print(
                        f"WARNING: matched row '{input_name}' "
                        f"has no 식품ID for 표준재료='{std_material}'",
                        file=sys.stderr,
                    )
                try:
                    confidence = float(confidence_str) if confidence_str else None
                except ValueError:
                    confidence = None

            rows.append({
                "input_name":       input_name,
                "standard_food_id": standard_food_id,
                "match_type":       match_type,
                "match_confidence": confidence,
            })
    return rows


def validate_rows(rows):
    errors = []
    seen = set()
    type_counts = {}
    for i, r in enumerate(rows):
        if not r["input_name"]:
            errors.append(f"row {i}: NULL input_name")
        if r["input_name"] in seen:
            errors.append(f"row {i}: duplicate input_name={r['input_name']!r}")
        seen.add(r["input_name"])

        mt = r["match_type"]
        type_counts[mt] = type_counts.get(mt, 0) + 1

        if mt == "unmatched" and r["standard_food_id"] is not None:
            errors.append(f"row {i}: unmatched row has non-NULL standard_food_id")
        if mt != "unmatched" and r["standard_food_id"] is None:
            # Warning only — some matched rows may not have 식품ID in recipe_ingredients
            pass

    return errors, type_counts


def main():
    if not SOURCE_FILE.exists():
        print(f"ERROR: not found: {SOURCE_FILE}", file=sys.stderr)
        sys.exit(1)
    if not RECIPE_FILE.exists():
        print(f"ERROR: not found: {RECIPE_FILE}", file=sys.stderr)
        sys.exit(1)

    sha256 = sha256_of_file(SOURCE_FILE)
    print(f"Source file : {SOURCE_FILE}")
    print(f"SHA-256     : {sha256}")
    if sha256 != EXPECTED_SHA:
        print(f"WARNING: SHA-256 mismatch. Expected: {EXPECTED_SHA}", file=sys.stderr)

    print("Building 표준재료→식품ID lookup from recipe_ingredients.csv...")
    std_to_id = build_standard_material_to_food_id(RECIPE_FILE)
    print(f"Lookup size : {len(std_to_id)} pairs")

    print("Loading ingredient_matching.csv...")
    rows = load_rows(SOURCE_FILE, std_to_id)
    print(f"Rows loaded : {len(rows)}")
    assert len(rows) == EXPECTED_ROWS, f"Expected {EXPECTED_ROWS}, got {len(rows)}"

    errors, type_counts = validate_rows(rows)
    print("match_type distribution:")
    for mt, cnt in sorted(type_counts.items()):
        expected = EXPECTED_TYPE_COUNTS.get(mt, "?")
        status = "OK" if cnt == expected else f"MISMATCH (expected {expected})"
        print(f"  {mt:12s}: {cnt:6d}  {status}")

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
                       VALUES (%s,'ingredient_name_match',%s,%s,%s,0,%s,%s)""",
                    (run_id, str(SOURCE_FILE.relative_to(DATA_DIR.parent)),
                     sha256, len(rows), BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.ingredient_name_match")

                psycopg2.extras.execute_batch(
                    cur,
                    """INSERT INTO staging.ingredient_name_match
                       (input_name, standard_food_id, match_type, match_confidence,
                        basis_date, ingest_run_id)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    [(r["input_name"], r["standard_food_id"], r["match_type"],
                      r["match_confidence"], BASIS_DATE, run_id) for r in rows],
                    page_size=500,
                )

                cur.execute("SELECT count(*) FROM staging.ingredient_name_match")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_ROWS

        print(f"DB load     : {db_count} rows in staging.ingredient_name_match")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
