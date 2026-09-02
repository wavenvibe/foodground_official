"""
CHG-G6-002 VS-A — Asset Audit Script
Reads the Foodground SQLite DB in read-only mode.
Verifies table counts, unique keys, FK orphans, and expected baseline values.
No credentials or personal data are printed.

Usage:
    python scripts/chg_g6_002_audit_assets.py
"""

import sqlite3
import sys
import json
from pathlib import Path

PYEXE_ENCODING = "utf-8"
sys.stdout.reconfigure(encoding=PYEXE_ENCODING)

DB_PATH = (
    Path(__file__).parent.parent.parent.parent.parent
    / "0. 업무" / "foodground" / "data" / "foodground.db"
)
DB_URI = f"file:{DB_PATH}?mode=ro"

EXPECTED = {
    "facility": 94723,
    "production_log": 1047894,
    "production_log_unique_report_no": 1047894,
    "production_log_linked": 815989,
    "production_log_unlinked": 231905,
    "haccp_cert": 308,
    "haccp_cert_with_facility_mgt_no_rows": 269,
    "haccp_cert_distinct_facilities": 261,
    "sales_suspension": 355,
    "sales_suspension_with_facility": 103,
}

PASS = "✅ PASS"
FAIL = "❌ FAIL"


def connect_ro() -> sqlite3.Connection:
    con = sqlite3.connect(DB_URI, uri=True)
    con.execute("PRAGMA query_only = ON")
    return con


def check(label: str, actual, expected, *, warn_only: bool = False) -> bool:
    ok = actual == expected
    status = PASS if ok else (f"WARN  {label}" if warn_only else FAIL)
    mark = PASS if ok else FAIL
    print(f"  {mark}  {label}: actual={actual} expected={expected}")
    return ok


def run_audit() -> dict:
    results = {}
    con = connect_ro()
    cur = con.cursor()
    errors = []

    print("=== CHG-G6-002 VS-A Asset Audit ===")
    print(f"DB: {DB_PATH}")
    print()

    # 1. Table counts
    print("-- Table Counts --")
    for table in ("facility", "production_log", "haccp_cert", "sales_suspension"):
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        cnt = cur.fetchone()[0]
        ok = check(table, cnt, EXPECTED[table])
        results[table] = cnt
        if not ok:
            errors.append(f"{table}: actual={cnt} expected={EXPECTED[table]}")

    # 2. production_log unique report_no
    print()
    print("-- Production Log Integrity --")
    cur.execute("SELECT COUNT(DISTINCT report_no) FROM production_log")
    uniq_rno = cur.fetchone()[0]
    ok = check("production_log unique report_no", uniq_rno, EXPECTED["production_log_unique_report_no"])
    results["production_log_unique_report_no"] = uniq_rno
    if not ok:
        errors.append(f"production_log_unique_report_no: {uniq_rno}")

    cur.execute(
        "SELECT COUNT(*) FROM production_log "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
    )
    pl_linked = cur.fetchone()[0]
    ok = check("production_log linked", pl_linked, EXPECTED["production_log_linked"])
    results["production_log_linked"] = pl_linked
    if not ok:
        errors.append(f"production_log_linked: {pl_linked}")

    cur.execute(
        "SELECT COUNT(*) FROM production_log "
        "WHERE facility_mgt_no IS NULL OR facility_mgt_no = ''"
    )
    pl_unlinked = cur.fetchone()[0]
    ok = check("production_log unlinked", pl_unlinked, EXPECTED["production_log_unlinked"])
    results["production_log_unlinked"] = pl_unlinked
    if not ok:
        errors.append(f"production_log_unlinked: {pl_unlinked}")

    # FK orphan: production_log.facility_mgt_no not in facility.mgt_no
    cur.execute(
        "SELECT COUNT(*) FROM production_log "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
        "AND facility_mgt_no NOT IN (SELECT mgt_no FROM facility)"
    )
    pl_orphans = cur.fetchone()[0]
    ok = check("production_log FK orphans", pl_orphans, 0)
    results["production_log_fk_orphans"] = pl_orphans
    if not ok:
        errors.append(f"production_log_fk_orphans: {pl_orphans}")

    # 3. haccp_cert integrity
    print()
    print("-- HACCP Cert Integrity --")
    cur.execute(
        "SELECT COUNT(*) FROM haccp_cert "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
    )
    hc_rows_with_fac = cur.fetchone()[0]
    ok = check("haccp_cert rows with facility_mgt_no", hc_rows_with_fac, EXPECTED["haccp_cert_with_facility_mgt_no_rows"])
    results["haccp_cert_with_facility_mgt_no_rows"] = hc_rows_with_fac
    if not ok:
        errors.append(f"haccp_cert rows with facility: {hc_rows_with_fac}")

    cur.execute(
        "SELECT COUNT(DISTINCT facility_mgt_no) FROM haccp_cert "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
    )
    hc_distinct = cur.fetchone()[0]
    ok = check("haccp_cert distinct facilities", hc_distinct, EXPECTED["haccp_cert_distinct_facilities"])
    results["haccp_cert_distinct_facilities"] = hc_distinct
    if not ok:
        errors.append(f"haccp_cert distinct facilities: {hc_distinct}")

    # haccp FK orphan
    cur.execute(
        "SELECT COUNT(*) FROM haccp_cert "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
        "AND facility_mgt_no NOT IN (SELECT mgt_no FROM facility)"
    )
    hc_orphans = cur.fetchone()[0]
    ok = check("haccp_cert FK orphans", hc_orphans, 0)
    results["haccp_cert_fk_orphans"] = hc_orphans
    if not ok:
        errors.append(f"haccp_cert FK orphans: {hc_orphans}")

    # haccp null facility
    cur.execute(
        "SELECT COUNT(*) FROM haccp_cert "
        "WHERE facility_mgt_no IS NULL OR facility_mgt_no = ''"
    )
    hc_null = cur.fetchone()[0]
    print(f"  INFO  haccp_cert NULL facility_mgt_no: {hc_null} (expected 39 unlinked)")
    results["haccp_cert_null_facility"] = hc_null

    # 4. sales_suspension integrity
    print()
    print("-- Sales Suspension Integrity --")
    cur.execute(
        "SELECT COUNT(*) FROM sales_suspension "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
    )
    ss_linked = cur.fetchone()[0]
    ok = check("sales_suspension with facility", ss_linked, EXPECTED["sales_suspension_with_facility"])
    results["sales_suspension_with_facility"] = ss_linked
    if not ok:
        errors.append(f"sales_suspension_with_facility: {ss_linked}")

    cur.execute(
        "SELECT COUNT(*) FROM sales_suspension "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
        "AND facility_mgt_no NOT IN (SELECT mgt_no FROM facility)"
    )
    ss_orphans = cur.fetchone()[0]
    ok = check("sales_suspension FK orphans", ss_orphans, 0)
    results["sales_suspension_fk_orphans"] = ss_orphans
    if not ok:
        errors.append(f"sales_suspension FK orphans: {ss_orphans}")

    # 5. Duplicate facility_mgt_no in haccp_cert
    print()
    print("-- Duplicate facility_mgt_no in haccp_cert --")
    cur.execute(
        "SELECT facility_mgt_no, COUNT(*) as cnt FROM haccp_cert "
        "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
        "GROUP BY facility_mgt_no HAVING cnt > 1 ORDER BY cnt DESC"
    )
    dupes = cur.fetchall()
    results["haccp_cert_duplicate_facility_mgt_nos"] = len(dupes)
    for mgt_no, cnt in dupes:
        print(f"  INFO  {mgt_no}: {cnt} rows")

    con.close()

    print()
    print(f"=== Errors: {len(errors)} ===")
    for e in errors:
        print(f"  {FAIL}  {e}")

    verdict = "PASS" if not errors else "FAIL"
    print(f"\n=== Audit verdict: {verdict} ===")
    results["errors"] = errors
    results["verdict"] = verdict
    return results


if __name__ == "__main__":
    run_audit()
