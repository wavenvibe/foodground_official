"""
VS-2 Stage 2: Load substitute_pairs from food_pair_similarities.csv → staging_substitute_pairs

Usage:
    python scripts/vs2_load_substitute_pairs.py

Environment variables required:
    SUPABASE_DB_URL  -- postgres://... (service-role connection)
    DATA_DIR         -- path to final_output/ directory (default: ./final_output)

This script:
  1. Reads final_output/food_pair_similarities.csv (UTF-8 BOM, 234,955 rows)
  2. Computes score_composite (Step 1) and score_final (Step 2)
     with null-renormalization for rows with < 4 or < 6 sim values
  3. Inserts rows into staging_substitute_pairs
  4. Inserts one row into private.data_lineage
  5. Prints a row-count and score distribution report

Score computation:
  Step 1 weights: nutrition×0.60, ingredient_category×0.15, food_group×0.15, cooking_state×0.10
  Step 2 weights: score_composite×0.70, dish_type×0.20, companion×0.10
  Null handling: exclude null sim values, re-normalize remaining weights to sum=1.0
"""

import csv
import hashlib
import os
import sys
import uuid
from datetime import date
from pathlib import Path

DATA_DIR = Path(os.environ.get("FOODGROUND_ANALYSIS_DIR") or os.environ.get("DATA_DIR") or "")
SOURCE_FILE = DATA_DIR / "food_pair_similarities.csv"
EXPECTED_ROWS = 234_955
BASIS_DATE = date(2026, 8, 18)
PUBLISH_VERSION = "vs2-2026-08-25"
EXPECTED_SHA = "7acbf108272c357a335d3821f39fbca5e3e6c8dc3bf74ee497bc1a4899d43421"

# CSV column name → internal key
CSV_COL_MAP = {
    "기준식품ID":      "source_food_id",
    "후보식품ID":      "candidate_food_id",
    "영양성분_유사도": "sim_nutrition",
    "재료구분_유사도": "sim_ingredient_category",
    "식품군_유사도":   "sim_food_group",
    "조리상태_유사도": "sim_cooking_state",
    "요리종류_유사도": "sim_dish_type",
    "동반재료_유사도": "sim_companion",
    "계산가능_유사도수": "available_sim_count",
}

STEP1_WEIGHTS = {
    "sim_nutrition":             0.60,
    "sim_ingredient_category":   0.15,
    "sim_food_group":            0.15,
    "sim_cooking_state":         0.10,
}
STEP2_WEIGHTS = {
    "score_composite": 0.70,
    "sim_dish_type":   0.20,
    "sim_companion":   0.10,
}


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_float(val: str):
    val = val.strip()
    if val in ("", "N/A", "-", "nan", "None"):
        return None
    try:
        return float(val)
    except ValueError:
        return None


def weighted_avg_null_renorm(values: dict) -> float | None:
    """Weighted average with null renormalization.
    values: {key: (value_or_None, weight)}
    """
    total_weight = 0.0
    weighted_sum = 0.0
    for v, w in values.values():
        if v is not None:
            weighted_sum += v * w
            total_weight += w
    if total_weight == 0.0:
        return None
    return round(weighted_sum / total_weight, 6)


def compute_scores(row: dict) -> tuple:
    step1_inputs = {
        k: (row.get(k), w) for k, w in STEP1_WEIGHTS.items()
    }
    score_composite = weighted_avg_null_renorm(step1_inputs)

    step2_inputs = {
        "score_composite": (score_composite, 0.70),
        "sim_dish_type":   (row.get("sim_dish_type"), 0.20),
        "sim_companion":   (row.get("sim_companion"), 0.10),
    }
    score_final = weighted_avg_null_renorm(step2_inputs)
    return score_composite, score_final


def load_rows(source_path: Path):
    rows = []
    with open(source_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            stripped = {k.strip(): v.strip() for k, v in raw.items()}
            row = {}
            for csv_col, internal_key in CSV_COL_MAP.items():
                val = stripped.get(csv_col, "")
                if internal_key in ("source_food_id", "candidate_food_id"):
                    row[internal_key] = val if val else None
                elif internal_key == "available_sim_count":
                    row[internal_key] = int(val) if val.isdigit() else None
                else:
                    row[internal_key] = parse_float(val)
            sc, sf = compute_scores(row)
            row["score_composite"] = sc
            row["score_final"] = sf
            rows.append(row)
    return rows


def validate_rows(rows):
    errors = []
    pk_seen = set()
    for i, r in enumerate(rows):
        if not r.get("source_food_id") or not r.get("candidate_food_id"):
            errors.append(f"row {i}: NULL PK")
        pk = (r["source_food_id"], r["candidate_food_id"])
        if pk in pk_seen:
            errors.append(f"row {i}: duplicate PK {pk}")
        pk_seen.add(pk)
        if r["score_final"] is None:
            errors.append(f"row {i}: NULL score_final (pk={pk})")
    return errors


def main():
    if not SOURCE_FILE.exists():
        print(f"ERROR: not found: {SOURCE_FILE}", file=sys.stderr)
        sys.exit(1)

    sha256 = sha256_of_file(SOURCE_FILE)
    print(f"Source file : {SOURCE_FILE}")
    print(f"SHA-256     : {sha256}")
    if sha256 != EXPECTED_SHA:
        print(f"WARNING: SHA-256 mismatch. Expected: {EXPECTED_SHA}", file=sys.stderr)

    print("Loading rows (234,955 — may take ~30 s)...")
    rows = load_rows(SOURCE_FILE)
    print(f"Rows loaded : {len(rows)}")
    assert len(rows) == EXPECTED_ROWS, f"Expected {EXPECTED_ROWS}, got {len(rows)}"

    errors = validate_rows(rows)
    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    scores = [r["score_final"] for r in rows if r["score_final"] is not None]
    print(f"Validation  : PASS")
    print(f"score_final : min={min(scores):.4f} max={max(scores):.4f} avg={sum(scores)/len(scores):.4f}")

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
                       VALUES (%s,'substitute_pairs',%s,%s,%s,0,%s,%s)""",
                    (run_id, str(SOURCE_FILE.relative_to(DATA_DIR.parent)),
                     sha256, len(rows), BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.substitute_pairs")

                db_cols = [
                    '"기준식품ID"', '"후보식품ID"',
                    "sim_nutrition", "sim_ingredient_category", "sim_food_group",
                    "sim_cooking_state", "sim_dish_type", "sim_companion",
                    "score_composite", "score_final", "available_sim_count",
                    "basis_date", "ingest_run_id",
                ]
                placeholders = ",".join(["%s"] * len(db_cols))
                col_names = ",".join(db_cols)

                def row_tuple(r):
                    return (
                        r["source_food_id"], r["candidate_food_id"],
                        r["sim_nutrition"], r["sim_ingredient_category"], r["sim_food_group"],
                        r["sim_cooking_state"], r["sim_dish_type"], r["sim_companion"],
                        r["score_composite"], r["score_final"], r["available_sim_count"],
                        BASIS_DATE, run_id,
                    )

                psycopg2.extras.execute_batch(
                    cur,
                    f"INSERT INTO staging.substitute_pairs ({col_names}) VALUES ({placeholders})",
                    [row_tuple(r) for r in rows],
                    page_size=1000,
                )

                cur.execute("SELECT count(*) FROM staging.substitute_pairs")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_ROWS

        print(f"DB load     : {db_count} rows in staging.substitute_pairs")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
