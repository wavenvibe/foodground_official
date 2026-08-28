"""
VS-2 Stage 2: Export facilities from legacy SQLite DB → staging.facilities

Source: D:/0. 업무/foodground/data/foodground.db (local read-only mirror, 94,723 rows)
Target: staging.facilities (new isolated Supabase project)

Usage:
    # Dry-run (no DB writes):
    python scripts/vs2_export_facilities.py

    # Load to staging:
    SUPABASE_DB_URL=postgres://... python scripts/vs2_export_facilities.py

Environment variables:
    SUPABASE_DB_URL  -- postgres://... (service-role, new project only — never legacy)
    SQLITE_PATH      -- override path to legacy SQLite DB

Column mapping (SQLite → staging.facilities):
    mgt_no          → mgt_no          (PK)
    name            → name
    biz_type        → business_type   (renamed)
    status          → status
    tel             → tel
    homepage        → homepage
    region_sido     → region_sido
    region_sigungu  → region_sigungu
    is_haccp (0/1)  → is_haccp (bool)
"""

import os
import sqlite3
import sys
import uuid
from datetime import date
from pathlib import Path

SQLITE_PATH = Path(os.environ.get("FOODGROUND_FACILITY_DB") or os.environ.get("SQLITE_PATH") or "")
EXPECTED_ROWS = 94_723
BASIS_DATE = date(2026, 8, 25)
PUBLISH_VERSION = "vs2-2026-08-25"


def load_rows(path: Path):
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT
            mgt_no,
            name,
            biz_type        AS business_type,
            status,
            tel,
            homepage,
            region_sido,
            region_sigungu,
            is_haccp
        FROM facility
        ORDER BY mgt_no
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def validate_rows(rows):
    errors = []
    seen = set()
    for i, r in enumerate(rows):
        if not r.get("mgt_no"):
            errors.append(f"row {i}: NULL mgt_no")
        if r["mgt_no"] in seen:
            errors.append(f"row {i}: duplicate mgt_no={r['mgt_no']}")
        seen.add(r["mgt_no"])
        if not r.get("name"):
            errors.append(f"row {i}: NULL name (mgt_no={r['mgt_no']})")
        if not r.get("status"):
            errors.append(f"row {i}: NULL status (mgt_no={r['mgt_no']})")
    return errors


def main():
    if not str(SQLITE_PATH):
        print("ERROR: FOODGROUND_FACILITY_DB (or SQLITE_PATH) env var not set.", file=sys.stderr)
        sys.exit(1)
    if not SQLITE_PATH.exists():
        print(f"ERROR: SQLite DB not found: {SQLITE_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Source      : {SQLITE_PATH}")
    print("Loading rows from facility table...")
    rows = load_rows(SQLITE_PATH)
    print(f"Rows loaded : {len(rows)}")
    assert len(rows) == EXPECTED_ROWS, f"Expected {EXPECTED_ROWS}, got {len(rows)}"

    errors = validate_rows(rows)
    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    print("Validation  : PASS (row count, unique mgt_no, NOT NULL checks)")

    sample = rows[0]
    print(f"Sample      : mgt_no={sample['mgt_no']!r}"
          f"  name={sample['name']!r}"
          f"  status={sample['status']!r}"
          f"  business_type={sample['business_type']!r}")

    db_url = os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print("\nSUPABASE_DB_URL not set -- dry-run: validating is_haccp distribution...")
        true_count  = sum(1 for r in rows if bool(r["is_haccp"]) is True)
        false_count = sum(1 for r in rows if bool(r["is_haccp"]) is False)
        null_count  = sum(1 for r in rows if r["is_haccp"] is None)
        errors = []
        if null_count != 0:
            errors.append(f"NULL is_haccp: {null_count} (expected 0)")
        if true_count != 261:
            errors.append(f"True is_haccp: {true_count} (expected 261)")
        if false_count != 94_462:
            errors.append(f"False is_haccp: {false_count} (expected 94,462)")
        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)
        print(f"PASS: is_haccp -- True={true_count}, False={false_count}, NULL={null_count}")
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
                       VALUES (%s,'facilities',%s,NULL,%s,0,%s,%s)""",
                    (run_id, str(SQLITE_PATH), len(rows), BASIS_DATE, PUBLISH_VERSION)
                )

                cur.execute("TRUNCATE staging.facilities")

                psycopg2.extras.execute_batch(
                    cur,
                    """INSERT INTO staging.facilities
                       (mgt_no, name, business_type, status, tel, homepage,
                        region_sido, region_sigungu, is_haccp, ingest_run_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    [(r["mgt_no"], r["name"], r["business_type"], r["status"],
                      r["tel"], r["homepage"], r["region_sido"], r["region_sigungu"],
                      bool(r["is_haccp"]), run_id) for r in rows],
                    page_size=500,
                )

                cur.execute("SELECT count(*) FROM staging.facilities")
                db_count = cur.fetchone()[0]
                assert db_count == EXPECTED_ROWS

        print(f"DB load     : {db_count} rows in staging.facilities")
        print(f"ingest_run_id: {run_id}")
        print("DONE.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
