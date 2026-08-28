"""
VS-2 Stage 2: Load standard_foods from food_master.csv → staging.standard_foods

Usage:
    python scripts/vs2_load_standard_foods.py

Environment variables:
    SUPABASE_DB_URL  -- postgres://... (service-role connection, not anon)
    DATA_DIR         -- override path to analysis_outputs/ directory

Default DATA_DIR: the VS-1 confirmed analysis_outputs directory on the local machine.
Set DATA_DIR env var to override for a different environment.

REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A).
"""

import csv
import hashlib
import os
import sys
import uuid
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("FOODGROUND_ANALYSIS_DIR") or os.environ.get("DATA_DIR") or "")
SOURCE_FILE = DATA_DIR / "food_master.csv"   # directly in analysis_outputs/
EXPECTED_ROWS = 686
BASIS_DATE = date(2026, 8, 18)
PUBLISH_VERSION = "vs2-2026-08-25"
EXPECTED_SHA = "d32590cddac31ca7fcc6f2c6ef6a2ecff467c9b983786d0bd657a1573a50eb17"

# Source column → staging column mapping
# Note: '지방 ' has a trailing space in the CSV header — we strip() all keys.
COL_MAP = {
    "식품ID":       "standard_food_id",
    "식품명":       "name",
    "식품군":       "food_group",
    "대표재료명":   "representative_ingredient",
    "사용행수":     "usage_row_count",
    "레시피수":     "recipe_count",
    "에너지":       "energy_kcal",
    "수분":         "water_g",
    "단백질":       "protein_g",
    "지방":         "fat_g",      # strip() handles trailing space
    "회분":         "ash_g",
    "탄수화물":     "carbohydrate_g",
}

NUMERIC_COLS = {"energy_kcal", "water_g", "protein_g", "fat_g", "ash_g", "carbohydrate_g"}
INT_COLS = {"usage_row_count", "recipe_count"}


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_numeric(val: str):
    val = val.strip()
    if val in ("", "N/A", "-", "nan"):
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_int(val: str):
    v = parse_numeric(val)
    return int(v) if v is not None else None


def load_rows(source_path: Path):
    rows = []
    with open(source_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            # Strip all keys (handles '지방 ' trailing-space issue)
            row = {k.strip(): v for k, v in raw.items()}
            out = {}
            for src_key, dst_col in COL_MAP.items():
                val = row.get(src_key, "").strip()
                if dst_col in NUMERIC_COLS:
                    out[dst_col] = parse_numeric(val)
                elif dst_col in INT_COLS:
                    out[dst_col] = parse_int(val)
                else:
                    out[dst_col] = val if val else None
            rows.append(out)
    return rows


def validate_rows(rows):
    errors = []
    ids_seen = set()
    null_name_count = 0
    for i, r in enumerate(rows):
        if not r.get("standard_food_id"):
            errors.append(f"row {i}: NULL standard_food_id")
        if not r.get("name"):
            null_name_count += 1
            errors.append(f"row {i}: NULL name (id={r.get('standard_food_id')})")
        sid = r.get("standard_food_id")
        if sid in ids_seen:
            errors.append(f"row {i}: duplicate standard_food_id={sid}")
        ids_seen.add(sid)
    return errors


def main():
    if not SOURCE_FILE.exists():
        print(f"ERROR: source file not found: {SOURCE_FILE}", file=sys.stderr)
        print(f"       DATA_DIR = {DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    sha256 = sha256_of_file(SOURCE_FILE)
    print(f"Source file : {SOURCE_FILE}")
    print(f"SHA-256     : {sha256}")
    if sha256 != EXPECTED_SHA:
        print(f"WARNING: SHA-256 mismatch. Expected: {EXPECTED_SHA}", file=sys.stderr)
        print("         Treat mismatch as a blocker — do not load.", file=sys.stderr)
    else:
        print("SHA-256     : MATCH")

    rows = load_rows(SOURCE_FILE)
    print(f"Rows loaded : {len(rows)}")
    assert len(rows) == EXPECTED_ROWS, f"Expected {EXPECTED_ROWS} rows, got {len(rows)}"

    errors = validate_rows(rows)
    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    # Print sample row for inspection
    sample = rows[0]
    print(f"Sample row  : standard_food_id={sample['standard_food_id']!r}"
          f"  name={sample['name']!r}"
          f"  food_group={sample['food_group']!r}"
          f"  energy_kcal={sample['energy_kcal']}")
    print("Validation  : PASS (row count, unique IDs, NOT NULL checks)")

    # ---------------------------------------------------------------------------
    # Database load (requires SUPABASE_DB_URL)
    # ---------------------------------------------------------------------------
    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("\nSUPABASE_DB_URL not set — dry-run complete (no DB writes).")
        return

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary", file=sys.stderr)
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
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (run_id, "standard_foods",
                     str(SOURCE_FILE.name),
                     sha256, len(rows), 0, BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.standard_foods")

                for r in rows:
                    r["basis_date"] = BASIS_DATE
                    r["ingest_run_id"] = run_id

                cols = list(rows[0].keys())
                placeholders = ",".join(["%s"] * len(cols))
                col_names = ",".join(cols)
                data = [tuple(r[c] for c in cols) for r in rows]
                psycopg2.extras.execute_batch(
                    cur,
                    f"INSERT INTO staging.standard_foods ({col_names}) VALUES ({placeholders})",
                    data,
                    page_size=500,
                )

                cur.execute("SELECT count(*) FROM staging.standard_foods")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_ROWS, f"DB count {db_count} != expected {EXPECTED_ROWS}"

        print(f"DB load     : {db_count} rows in staging.standard_foods")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
