"""
CHG-G6-002 VS-A — Company Profile -> HACCP Cert -> Facility Mapping
Reads the Foodground SQLite DB (mode=ro) and company_profiles.csv (read-only).
Outputs:
    data/derived/chg-g6-002/company_profile_facility_mapping.csv
    data/derived/chg-g6-002/mapping_summary.json
    data/derived/chg-g6-002/mapping_exceptions.csv

Mapping algorithm (matches .tmp/audit_g6_002_assets.py exactly):
    norm(value) = re.sub(r"[^0-9a-z가-힣]", "", (value or "").lower())

    For each company_profile row:
      1. candidates = haccp rows where norm(biz_name) == norm(company_name)
      2. region = norm(sido)
      3. region_candidates = [row for row in candidates if region and region in norm(biz_addr)]
      4. final_candidates = region_candidates if region_candidates else candidates
      5. facility_candidates = unique non-empty facility_mgt_no from final_candidates
      6. Classify:
         - linked    : exactly 1 unique facility_mgt_no
         - ambiguous : 2+ unique facility_mgt_nos
         - unlinked  : 0 unique facility_mgt_nos
    Note: profiles pointing to the same facility are NOT demoted to ambiguous.

Security: No raw_payload, individual names, full addresses, or personal data written.

Usage:
    python scripts/chg_g6_002_build_profile_mapping.py [--dry-run]
"""

import csv
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# Paths (read-only sources)
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
DB_PATH = (
    REPO_ROOT.parent.parent.parent
    / "0. 업무" / "foodground" / "data" / "foodground.db"
)
PROFILES_CSV = (
    REPO_ROOT
    / "03_공동제조 매칭 정확도(F1 SCORE)"
    / "03_테스트데이터셋"
    / "company_profiles.csv"
)

# Output paths
OUT_DIR = REPO_ROOT / "data" / "derived" / "chg-g6-002"
MAPPING_CSV = OUT_DIR / "company_profile_facility_mapping.csv"
SUMMARY_JSON = OUT_DIR / "mapping_summary.json"
EXCEPTIONS_CSV = OUT_DIR / "mapping_exceptions.csv"

# Expected distribution
EXPECTED_LINKED = 265
EXPECTED_AMBIGUOUS = 4
EXPECTED_UNLINKED = 39
EXPECTED_TOTAL = 308
# Rule version reflects the exact algorithm used
RULE_VERSION = "v0.2-norm-name-sido-in-addr-no-bidirectional"


# ---------------------------------------------------------------------------
# Normalisation — must match .tmp/audit_g6_002_assets.py exactly
# ---------------------------------------------------------------------------
def norm(value: str | None) -> str:
    """Remove all chars except [0-9 a-z 가-힣], lowercase."""
    return re.sub(r"[^0-9a-z가-힣]", "", (value or "").lower())


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Main mapping logic
# ---------------------------------------------------------------------------
def build_mapping(dry_run: bool = False) -> dict:
    # --- Load haccp_cert (read-only) ---
    db_uri = f"file:{DB_PATH}?mode=ro"
    con = sqlite3.connect(db_uri, uri=True)
    con.execute("PRAGMA query_only = ON")
    cur = con.cursor()

    cur.execute(
        "SELECT facility_mgt_no, biz_name, biz_addr FROM haccp_cert"
    )
    haccp_rows = cur.fetchall()  # (facility_mgt_no, biz_name, biz_addr)
    con.close()

    # Build name index: norm(biz_name) -> list of rows
    haccp_by_name: dict[str, list] = {}
    for row in haccp_rows:
        key = norm(row[1])  # norm(biz_name)
        haccp_by_name.setdefault(key, []).append(row)

    # --- Load company_profiles (read-only) ---
    with open(PROFILES_CSV, "r", encoding="utf-8-sig", newline="") as fh:
        profiles = list(csv.DictReader(fh))

    if len(profiles) != EXPECTED_TOTAL:
        raise AssertionError(
            f"company_profiles row count {len(profiles)} != {EXPECTED_TOTAL}"
        )

    # --- Per-profile mapping ---
    mapping_rows: list[dict] = []
    linked = ambiguous = unlinked = 0

    for p in profiles:
        # Step 1: name candidates
        candidates = haccp_by_name.get(norm(p["company_name"]), [])

        # Step 2: region filter (norm(sido) contained in norm(biz_addr))
        region = norm(p.get("sido"))
        region_candidates = [
            row for row in candidates
            if region and region in norm(row[2])  # row[2] = biz_addr
        ]

        # Step 3: choose final candidate set
        final_candidates = region_candidates if region_candidates else candidates

        # Step 4: unique non-empty facility_mgt_no from final candidates
        facility_candidates = {
            row[0]  # row[0] = facility_mgt_no
            for row in final_candidates
            if row[0] and row[0].strip()
        }

        # Step 5: classify
        cnt = len(facility_candidates)
        if cnt == 1:
            status = "linked"
            facility_mgt_no = next(iter(facility_candidates))
            match_basis = "name+sido" if region_candidates else "name-only"
            candidate_count = 1
            needs_review = False
            linked += 1
        elif cnt >= 2:
            status = "ambiguous"
            facility_mgt_no = "|".join(sorted(facility_candidates))
            match_basis = "name+sido" if region_candidates else "name-only"
            candidate_count = cnt
            needs_review = True
            ambiguous += 1
        else:
            status = "unlinked"
            facility_mgt_no = ""
            match_basis = "none"
            candidate_count = 0
            needs_review = True
            unlinked += 1

        mapping_rows.append({
            "company_id": p["company_id"],
            "status": status,
            "facility_mgt_no": facility_mgt_no,
            "match_basis": match_basis,
            "candidate_count": candidate_count,
            "needs_review": str(needs_review).lower(),
        })

    total = len(mapping_rows)
    print(f"Mapping results: linked={linked}  ambiguous={ambiguous}  unlinked={unlinked}  total={total}")

    distribution_ok = (
        linked == EXPECTED_LINKED
        and ambiguous == EXPECTED_AMBIGUOUS
        and unlinked == EXPECTED_UNLINKED
        and total == EXPECTED_TOTAL
    )
    if distribution_ok:
        print(f"✅ Distribution matches expected {EXPECTED_LINKED}/{EXPECTED_AMBIGUOUS}/{EXPECTED_UNLINKED}")
    else:
        print(
            f"⚠ DISTRIBUTION MISMATCH  "
            f"expected linked={EXPECTED_LINKED} ambiguous={EXPECTED_AMBIGUOUS} "
            f"unlinked={EXPECTED_UNLINKED}  "
            f"actual linked={linked} ambiguous={ambiguous} unlinked={unlinked}"
        )

    if dry_run:
        print("[dry-run] No files written.")
        return {
            "dry_run": True,
            "linked": linked,
            "ambiguous": ambiguous,
            "unlinked": unlinked,
            "distribution_ok": distribution_ok,
        }

    # --- Write outputs ---
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "company_id", "status", "facility_mgt_no",
        "match_basis", "candidate_count", "needs_review",
    ]

    # company_profile_facility_mapping.csv (308 rows)
    with open(MAPPING_CSV, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(mapping_rows)
    print(f"Written: {MAPPING_CSV}")

    # mapping_exceptions.csv (ambiguous + unlinked only)
    exceptions = [r for r in mapping_rows if r["status"] in ("ambiguous", "unlinked")]
    with open(EXCEPTIONS_CSV, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(exceptions)
    print(f"Written: {EXCEPTIONS_CSV} ({len(exceptions)} exceptions)")

    # mapping_summary.json
    summary = {
        "rule_version": RULE_VERSION,
        "source_db_sha256": sha256_file(DB_PATH),
        "source_profiles_sha256": sha256_file(PROFILES_CSV),
        "total": total,
        "linked": linked,
        "ambiguous": ambiguous,
        "unlinked": unlinked,
        "exceptions_count": len(exceptions),
        "distribution_ok": distribution_ok,
        "expected_linked": EXPECTED_LINKED,
        "expected_ambiguous": EXPECTED_AMBIGUOUS,
        "expected_unlinked": EXPECTED_UNLINKED,
    }
    with open(SUMMARY_JSON, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
    print(f"Written: {SUMMARY_JSON}")

    return summary


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    result = build_mapping(dry_run=dry_run)
    if not result.get("distribution_ok", False):
        sys.exit(1)
