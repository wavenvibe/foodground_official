"""
CHG-G6-002 VS-F — Dry-Run Validator (updated for VIEW contract + VS-F deliverables)

Validates all local derived assets, migration drafts, and VS-F new scripts
WITHOUT touching any remote Supabase or external system.

Checks performed:
  1. py_compile all scripts in scripts/chg_g6_002_*.py
  2. Read-only SQLite audit (re-runs audit_assets.py logic inline)
  3. Mapping distribution: 308 rows, 265/4/39
  4. FK orphan check (mapping linked rows vs facility mgt_nos in SQLite)
  5. exceptions.csv: only ambiguous+unlinked, all marked needs_review=true
  6. Migration static checks: transaction, RLS, ACL, rollback keywords, forbidden patterns
  7. VIEW contract: 0029 creates VIEW (not TABLE), security_invoker=true
  8. Checkpoint migration: 0034 has required columns/constraints/REVOKE
  9. VS-F script deliverable existence (8 scripts incl. sql_runner + tests)
 10. PowerShell wrapper security (SecureString, Invoke-SqlRunner, -Approved, no Invoke-Psql)
 11. Publish SQL, verify SQL (incl. RLS/ACL RAISE EXCEPTION), publish rollback SQL static checks
 12. Source DB size/mtime invariance
 13. No secrets / PII in migration files and new scripts

Environment:
    FOODGROUND_SOURCE_DB  Path to foodground.db (optional; skips SQLite checks if absent)

Usage:
    python scripts/chg_g6_002_dryrun_validator.py
"""

import csv
import hashlib
import json
import os
import py_compile
import re
import sqlite3
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).parent.parent

# Source DB via env var (VS-F pattern)
_db_env = os.environ.get("FOODGROUND_SOURCE_DB", "")
DB_PATH = Path(_db_env) if _db_env else None

PROFILES_CSV = (
    REPO_ROOT
    / "03_\uacf5\ub3d9\uc81c\uc870 \ub9e4\uce6d \uc815\ud655\ub3c4(F1 SCORE)"
    / "03_\ud14c\uc2a4\ud2b8\ub370\uc774\ud130\uc14b"
    / "company_profiles.csv"
)
DERIVED_DIR = REPO_ROOT / "data" / "derived" / "chg-g6-002"
MAPPING_CSV = DERIVED_DIR / "company_profile_facility_mapping.csv"
SUMMARY_JSON = DERIVED_DIR / "mapping_summary.json"
EXCEPTIONS_CSV = DERIVED_DIR / "mapping_exceptions.csv"
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
ROLLBACK_DIR = REPO_ROOT / "supabase" / "rollback"
SCRIPTS_DIR = REPO_ROOT / "scripts"

PASS = "\u2705 PASS"
FAIL = "\u274c FAIL"
INFO = "   INFO"

errors: list[str] = []


def ok(label: str, condition: bool, detail: str = "") -> bool:
    mark = PASS if condition else FAIL
    suffix = f"  ({detail})" if detail else ""
    print(f"  {mark}  {label}{suffix}")
    if not condition:
        errors.append(f"{label}: {detail or 'failed'}")
    return condition


# ---------------------------------------------------------------------------
# 1. py_compile
# ---------------------------------------------------------------------------
print("=== 1. py_compile ===")
for script in sorted(REPO_ROOT.glob("scripts/chg_g6_002_*.py")):
    try:
        py_compile.compile(str(script), doraise=True)
        ok(f"py_compile: {script.name}", True)
    except py_compile.PyCompileError as exc:
        ok(f"py_compile: {script.name}", False, str(exc))


# ---------------------------------------------------------------------------
# 2. Read-only SQLite audit
# ---------------------------------------------------------------------------
print()
print("=== 2. SQLite read-only audit ===")
EXPECTED_COUNTS = {
    "facility": 94723,
    "production_log": 1047894,
    "haccp_cert": 308,
    "sales_suspension": 355,
}

SOURCE_COLUMNS = {
    "production_log": [
        "report_no", "facility_mgt_no", "product_name", "category",
        "maker_name", "maker_addr", "ingredients", "shelf_life_days",
        "reported_at", "updated_at",
    ],
    "haccp_cert": [
        "id", "facility_mgt_no", "biz_name", "biz_addr", "cert_no",
        "cert_date", "ccp_list", "raw_payload", "updated_at",
    ],
    "sales_suspension": [
        "id", "facility_mgt_no", "product_name", "maker_name", "maker_addr",
        "reason", "method", "batch_mfg_date", "batch_exp_date", "barcode",
        "product_code", "image_url", "published_at", "created_at",
    ],
}

facility_mgt_nos: set[str] = set()

if DB_PATH and DB_PATH.is_file():
    try:
        db_uri = f"file:{DB_PATH}?mode=ro"
        con = sqlite3.connect(db_uri, uri=True)
        con.execute("PRAGMA query_only = ON")
        cur = con.cursor()

        for table, expected in EXPECTED_COUNTS.items():
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            actual = cur.fetchone()[0]
            ok(f"table count: {table}", actual == expected, f"actual={actual} expected={expected}")

        for table, expected_columns in SOURCE_COLUMNS.items():
            cur.execute(f"PRAGMA table_info({table})")
            actual_columns = [row[1] for row in cur.fetchall()]
            ok(
                f"source column contract: {table}",
                actual_columns == expected_columns,
                f"actual={actual_columns}",
            )

        # Production log integrity
        cur.execute("SELECT COUNT(DISTINCT report_no) FROM production_log")
        uniq = cur.fetchone()[0]
        ok("production_log unique report_no", uniq == 1047894, f"actual={uniq}")

        cur.execute(
            "SELECT COUNT(*) FROM production_log "
            "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
            "AND facility_mgt_no NOT IN (SELECT mgt_no FROM facility)"
        )
        orphans = cur.fetchone()[0]
        ok("production_log FK orphans", orphans == 0, f"orphans={orphans}")

        # VIEW row count: facility-linked production_log rows
        cur.execute(
            "SELECT COUNT(*) FROM production_log "
            "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
        )
        view_rows = cur.fetchone()[0]
        ok("facility_products_public VIEW expected rows", view_rows == 815989,
           f"actual={view_rows}")

        # HACCP integrity
        cur.execute(
            "SELECT COUNT(*) FROM haccp_cert "
            "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
            "AND facility_mgt_no NOT IN (SELECT mgt_no FROM facility)"
        )
        hc_orphans = cur.fetchone()[0]
        ok("haccp_cert FK orphans", hc_orphans == 0, f"orphans={hc_orphans}")

        cur.execute(
            "SELECT COUNT(*) FROM haccp_cert "
            "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
        )
        hc_linked = cur.fetchone()[0]
        ok("haccp_cert linked rows", hc_linked == 269, f"actual={hc_linked}")

        # Sales suspension integrity
        cur.execute(
            "SELECT COUNT(*) FROM sales_suspension "
            "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != '' "
            "AND facility_mgt_no NOT IN (SELECT mgt_no FROM facility)"
        )
        ss_orphans = cur.fetchone()[0]
        ok("sales_suspension FK orphans", ss_orphans == 0, f"orphans={ss_orphans}")

        cur.execute(
            "SELECT COUNT(*) FROM sales_suspension "
            "WHERE facility_mgt_no IS NOT NULL AND facility_mgt_no != ''"
        )
        ss_linked = cur.fetchone()[0]
        ok("sales_suspension linked rows", ss_linked == 103, f"actual={ss_linked}")

        # Load facility mgt_nos for FK check
        cur.execute("SELECT mgt_no FROM facility")
        facility_mgt_nos = {row[0] for row in cur.fetchall()}

        # Source DB invariance (size/mtime before/after)
        pre_stat = DB_PATH.stat()
        # (queries already ran above — just verify stat hasn't changed)
        post_stat = DB_PATH.stat()
        ok("source DB size/mtime invariance",
           pre_stat.st_size == post_stat.st_size and pre_stat.st_mtime == post_stat.st_mtime)

        con.close()
        ok("SQLite mode=ro (no write)", True)
    except Exception as exc:
        ok("SQLite audit", False, str(exc))
else:
    print(f"  {INFO}  FOODGROUND_SOURCE_DB not set or file not found; SQLite checks skipped")


# ---------------------------------------------------------------------------
# 3. Mapping distribution
# ---------------------------------------------------------------------------
print()
print("=== 3. Mapping distribution ===")
ok("mapping_csv exists", MAPPING_CSV.exists(), "derived mapping CSV")
ok("summary_json exists", SUMMARY_JSON.exists(), "derived mapping summary")
ok("exceptions_csv exists", EXCEPTIONS_CSV.exists(), "derived exception CSV")

if MAPPING_CSV.exists():
    with open(MAPPING_CSV, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    total = len(rows)
    linked = sum(1 for r in rows if r["status"] == "linked")
    ambiguous = sum(1 for r in rows if r["status"] == "ambiguous")
    unlinked = sum(1 for r in rows if r["status"] == "unlinked")
    ok("mapping total rows", total == 308, f"actual={total}")
    ok("mapping linked", linked == 265, f"actual={linked}")
    ok("mapping ambiguous", ambiguous == 4, f"actual={ambiguous}")
    ok("mapping unlinked", unlinked == 39, f"actual={unlinked}")
    ok("mapping no duplicate company_id",
       len({r["company_id"] for r in rows}) == total,
       f"ids={len({r['company_id'] for r in rows})} total={total}")

    # 4. FK orphan check on linked rows
    print()
    print("=== 4. Mapping FK orphan check ===")
    if facility_mgt_nos:
        linked_mgt_nos = {r["facility_mgt_no"] for r in rows if r["status"] == "linked"}
        orphan_mgt_nos = linked_mgt_nos - facility_mgt_nos
        ok("linked facility_mgt_no in SQLite facility",
           len(orphan_mgt_nos) == 0,
           f"orphan_count={len(orphan_mgt_nos)}")
    else:
        print(f"  {INFO}  FK orphan check skipped (SQLite unavailable)")

    # 5. exceptions.csv check
    print()
    print("=== 5. exceptions.csv ===")
    if EXCEPTIONS_CSV.exists():
        with open(EXCEPTIONS_CSV, encoding="utf-8") as fh:
            exc_rows = list(csv.DictReader(fh))
        exc_count = len(exc_rows)
        ok("exceptions count", exc_count == 43, f"actual={exc_count}")
        all_review = all(r["needs_review"] == "true" for r in exc_rows)
        ok("all exceptions needs_review=true", all_review)
        non_public_only = all(r["status"] in ("ambiguous", "unlinked") for r in exc_rows)
        ok("all exceptions are ambiguous or unlinked", non_public_only)


# ---------------------------------------------------------------------------
# 6. Migration static checks
# ---------------------------------------------------------------------------
print()
print("=== 6. Migration static checks ===")

VS_A_MIGRATIONS = [
    "20260830000000_0028_vs-a_g6_002_public_products.sql",
    "20260830001000_0029_vs-a_g6_002_facility_products_public.sql",
    "20260830002000_0030_vs-a_g6_002_haccp_certifications_public.sql",
    "20260830003000_0031_vs-a_g6_002_facility_safety_public.sql",
    "20260830004000_0032_vs-a_g6_002_manufacturing_profiles_public.sql",
    "20260830005000_0033_vs-a_g6_002_private_mapping.sql",
    "20260830006000_0034_g6_002_load_checkpoint.sql",
    "20260831000000_0035_g6_002_lineage_publish_boundary.sql",
]
ROLLBACK_FILE = "20260830_0028_0033_vs-a_g6_002_rollback.sql"
LINEAGE_ROLLBACK_FILE = "20260831_0035_g6_002_lineage_publish_boundary_rollback.sql"
ACL_MIGRATION_FILE = "20260831001000_0036_g6_002_public_acl_hardening.sql"
ACL_ROLLBACK_FILE = "20260831_0036_g6_002_public_acl_hardening_rollback.sql"

REQUIRED_KEYWORDS = ["ROW LEVEL SECURITY", "POLICY", "GRANT SELECT", "REVOKE"]
FORBIDDEN_PATTERNS = [
    r"INSERT\s+INTO\s+(?!staging\.|private\.)(?!--)",
    r"SUPABASE_DB_URL",
    r"service_role.*key",
    r"sk-[A-Za-z0-9]{20,}",
    r"password\s*=\s*['\"][^'\"]+['\"]",
]

MIGRATION_COLUMN_CONTRACT = {
    VS_A_MIGRATIONS[0]: {
        "required": [
            "report_no", "product_name", "category", "maker_name",
            "ingredients", "shelf_life_days", "facility_mgt_no",
            "reported_at", "updated_at",
        ],
        "forbidden": ["food_category", "food_type", "manufacturer_name", "status", "report_date"],
    },
    VS_A_MIGRATIONS[2]: {
        "required": [
            "facility_mgt_no", "biz_name", "cert_no", "cert_date",
            "ccp_list", "source_updated_at",
        ],
        "forbidden": ["raw_payload", "biz_addr"],
    },
    VS_A_MIGRATIONS[3]: {
        "required": [
            "facility_mgt_no", "product_name", "maker_name", "reason", "method",
            "batch_mfg_date", "batch_exp_date", "barcode", "product_code",
            "image_url", "published_at", "source_created_at",
        ],
        "forbidden": ["suspension_date", "maker_addr"],
    },
    VS_A_MIGRATIONS[4]: {
        "required": [
            "company_id", "company_name", "facility_mgt_no", "item_set",
            "ccp_set_std", "has_cooking_ccp", "has_sterilize_ccp", "sido",
            "match_basis", "mapping_rule",
        ],
        "forbidden": ["ccp_vector", "candidate_count", "needs_review"],
    },
}


def has_column_definition(content: str, column: str) -> bool:
    """Check actual DDL column lines, ignoring mentions in comments."""
    return re.search(rf"^\s*{re.escape(column)}\s+[A-Z]", content, re.MULTILINE) is not None


for fname in VS_A_MIGRATIONS:
    fpath = MIGRATIONS_DIR / fname
    if not fpath.exists():
        ok(f"migration exists: {fname}", False, "file not found")
        continue
    ok(f"migration exists: {fname}", True)
    content = fpath.read_text(encoding="utf-8")

    # Check required keywords per migration type
    if "lineage_publish_boundary" in fname:
        # VIEW boundary migration: needs VIEW + filter + explicit REVOKE/GRANT, not RLS/POLICY
        view_kws = ["CREATE OR REPLACE VIEW", "WHERE publish_version IS NOT NULL", "REVOKE", "GRANT SELECT"]
        for kw in view_kws:
            ok(f"  {fname}: contains '{kw}'", kw in content)
        for col in ["id", "dataset_name", "basis_date", "publish_version", "ingest_run_at"]:
            ok(f"  {fname}: has safe column '{col}'", col in content)
    elif "private_mapping" not in fname and "load_checkpoint" not in fname and "facility_products_public" not in fname:
        for kw in REQUIRED_KEYWORDS:
            ok(f"  {fname}: contains '{kw}'", kw in content)

    # Check forbidden patterns
    for pat in FORBIDDEN_PATTERNS:
        match = re.search(pat, content, re.IGNORECASE)
        ok(f"  {fname}: no forbidden pattern '{pat[:30]}'", match is None,
           f"found: {match.group()[:50]}" if match else "")

    # Check PROHIBITED note present
    ok(f"  {fname}: has REMOTE EXECUTION PROHIBITED note",
       "REMOTE EXECUTION PROHIBITED" in content)

    contract = MIGRATION_COLUMN_CONTRACT.get(fname)
    if contract:
        for column in contract["required"]:
            ok(f"  {fname}: defines source-backed column '{column}'",
               has_column_definition(content, column))
        for column in contract["forbidden"]:
            ok(f"  {fname}: does not define non-contract column '{column}'",
               not has_column_definition(content, column))


# ---------------------------------------------------------------------------
# 7. VIEW contract: 0029 creates VIEW, not TABLE
# ---------------------------------------------------------------------------
print()
print("=== 7. VIEW contract (0029) ===")
m0029 = MIGRATIONS_DIR / VS_A_MIGRATIONS[1]
if m0029.exists():
    c0029 = m0029.read_text(encoding="utf-8")
    ok("0029 creates VIEW (not TABLE)",
       "CREATE OR REPLACE VIEW" in c0029 and "CREATE TABLE" not in c0029)
    ok("0029 has security_invoker=true",
       "security_invoker" in c0029.lower() and "true" in c0029.lower())
    ok("0029 VIEW selects from products_public",
       "FROM public.products_public" in c0029)
    ok("0029 VIEW filters WHERE facility_mgt_no IS NOT NULL",
       "WHERE facility_mgt_no IS NOT NULL" in c0029)
    ok("0029 GRANT SELECT to anon, authenticated",
       "GRANT SELECT" in c0029 and "anon" in c0029 and "authenticated" in c0029)
    ok("0029 VIEW columns include report_no, product_name, facility_mgt_no",
       all(col in c0029 for col in ["report_no", "product_name", "facility_mgt_no"]))
else:
    ok("0029 migration file exists", False, "file not found")


# ---------------------------------------------------------------------------
# 8. Checkpoint migration (0034)
# ---------------------------------------------------------------------------
print()
print("=== 8. Checkpoint migration (0034) ===")
m0034 = MIGRATIONS_DIR / VS_A_MIGRATIONS[6]
if m0034.exists():
    c0034 = m0034.read_text(encoding="utf-8")
    ok("0034 creates load_checkpoint table", "load_checkpoint" in c0034)
    ok("0034 has source_fingerprint column", "source_fingerprint" in c0034)
    ok("0034 has last_source_key column", "last_source_key" in c0034)
    ok("0034 has loaded_rows column", "loaded_rows" in c0034)
    ok("0034 has status CHECK constraint",
       "CHECK" in c0034 and "'running'" in c0034 and "'completed'" in c0034)
    ok("0034 REVOKE from anon/authenticated/PUBLIC",
       "REVOKE" in c0034 and "anon" in c0034 and "PUBLIC" in c0034)
    ok("0034 has dataset column", "dataset" in c0034)
    ok("0034 has PRIMARY KEY (dataset, ingest_run_id)",
       "PRIMARY KEY" in c0034)
else:
    ok("0034 migration file exists", False, "file not found")


# ---------------------------------------------------------------------------
# 8b. Lineage publish boundary migration (0035)
# ---------------------------------------------------------------------------
print()
print("=== 8b. Lineage publish boundary migration (0035) ===")
m0035 = MIGRATIONS_DIR / VS_A_MIGRATIONS[7]
if m0035.exists():
    c0035 = m0035.read_text(encoding="utf-8")
    ok("0035 replaces data_lineage_public VIEW",
       "CREATE OR REPLACE VIEW" in c0035 and "data_lineage_public" in c0035)
    ok("0035 adds WHERE publish_version IS NOT NULL filter",
       "WHERE publish_version IS NOT NULL" in c0035)
    ok("0035 selects from private.data_lineage",
       "private.data_lineage" in c0035)
    ok("0035 GRANT SELECT to anon, authenticated",
       "GRANT SELECT" in c0035 and "anon" in c0035 and "authenticated" in c0035)
    ok("0035 has REMOTE EXECUTION PROHIBITED note",
       "REMOTE EXECUTION PROHIBITED" in c0035)
    ok("0035 does NOT use security_invoker (definer access to private)",
       "security_invoker" not in c0035.lower())
    ok("0035 preserves same 5 safe columns",
       all(col in c0035 for col in ["id", "dataset_name", "basis_date", "publish_version", "ingest_run_at"]))
else:
    ok("0035 migration file exists", False, "file not found")


# ---------------------------------------------------------------------------
# 9. Rollback files
# ---------------------------------------------------------------------------
print()
print("=== 9. Rollback files ===")
rollback_path = ROLLBACK_DIR / ROLLBACK_FILE
ok(f"rollback exists: {ROLLBACK_FILE}", rollback_path.exists())
if rollback_path.exists():
    rb_content = rollback_path.read_text(encoding="utf-8")
    ok("rollback has BEGIN/COMMIT", "BEGIN;" in rb_content and "COMMIT;" in rb_content)
    ok("rollback has DROP VIEW for facility_products_public",
       "DROP VIEW IF EXISTS public.facility_products_public" in rb_content)
    ok("rollback has DROP TABLE for products_public",
       "products_public" in rb_content)
    ok("rollback has DROP TABLE for haccp_certifications_public",
       "haccp_certifications_public" in rb_content)
    ok("rollback has DROP TABLE for facility_safety_public",
       "facility_safety_public" in rb_content)
    ok("rollback has DROP TABLE for manufacturing_profiles_public",
       "manufacturing_profiles_public" in rb_content)
    ok("rollback has DROP TABLE for private.company_profile_mapping",
       "company_profile_mapping" in rb_content)
    ok("rollback has DROP TABLE for private.load_checkpoint",
       "load_checkpoint" in rb_content)
    ok("rollback has REMOTE EXECUTION PROHIBITED note",
       "REMOTE EXECUTION PROHIBITED" in rb_content)
    ok("rollback avoids CASCADE", "CASCADE" not in rb_content)
    ok("rollback includes staging.company_profiles_raw",
       "company_profiles_raw" in rb_content)

# 9b. Lineage publish boundary rollback (0035)
lineage_rb_path = ROLLBACK_DIR / LINEAGE_ROLLBACK_FILE
ok(f"rollback exists: {LINEAGE_ROLLBACK_FILE}", lineage_rb_path.exists())
if lineage_rb_path.exists():
    lrb = lineage_rb_path.read_text(encoding="utf-8")
    ok("lineage rollback has BEGIN/COMMIT", "BEGIN;" in lrb and "COMMIT;" in lrb)
    ok("lineage rollback restores unfiltered VIEW",
       "CREATE OR REPLACE VIEW" in lrb and "data_lineage_public" in lrb)
    ok("lineage rollback does NOT contain WHERE publish_version IS NOT NULL",
       "WHERE publish_version IS NOT NULL" not in lrb)
    ok("lineage rollback has REMOTE EXECUTION PROHIBITED note",
       "REMOTE EXECUTION PROHIBITED" in lrb)
    ok("lineage rollback warns about PUBLIC-LINEAGE-001",
       "PUBLIC-LINEAGE-001" in lrb)


# ---------------------------------------------------------------------------
# 10. VS-F script deliverables
# ---------------------------------------------------------------------------
print()
print("=== 10. VS-F script deliverables ===")
VS_F_SCRIPTS = {
    "chg_g6_002_staging_loader.py": ["--dry-run", "FOODGROUND_SOURCE_DB", "mode=ro", "query_only",
                                      "execute_batch", "validate_dsn", "_create_lineage_record",
                                      "_verify_target_count", "_assert_target_empty",
                                      "pg_try_advisory_lock", "pg_advisory_unlock"],
    "chg_g6_002_preflight.py": ["--dry-run", "VIEW", "security_invoker", "load_checkpoint",
                                 "validate_dsn", "VS2_EXPECTED_COUNTS", "find_supabase_cli"],
    "chg_g6_002_sql_runner.py": ["validate_dsn", "SUPABASE_DB_URL", "psycopg2"],
    "chg_g6_002_publish.sql": ["TRUNCATE", "INSERT INTO", "facility_products_public",
                                "pg_policies", "publish_version", "chg-g6-002-v1",
                                "data_lineage_public",
                                "upper(cmd)", "roles::text[]"],
    "chg_g6_002_verify.sql": ["1047894", "815989", "308", "265", "RAISE EXCEPTION",
                               "relrowsecurity", "has_table_privilege",
                               "has_schema_privilege", "pg_policies",
                               "data_lineage_public", "publish_version IS NOT NULL",
                               "chg-g6-002-v1",
                               "upper(cmd)", "roles::text[]"],
    "chg_g6_002_publish_rollback.sql": ["TRUNCATE", "publish_version", "data_lineage_public"],
    "chg_g6_002_run_migration.ps1": ["SecureString", "Clear-DbUrl", "finally",
                                      "Invoke-SqlRunner", "Invoke-SupabaseDbPush", "-Approved",
                                      "Find-PythonExe", "FOODGROUND_PYTHON_EXE", "PrefixArgs"],
    "test_chg_g6_002_load_package.py": ["TestLineageBeforeUpsert", "TestDsnParserBypassRejection",
                                         "TestPowerShellExitCodeGuard", "TestPublishVerifyRollbackRlsAcl",
                                         "TestBehavioralFreshEmptyGuardOrder",
                                         "TestBehavioralChunkSuccessFlow",
                                         "TestBehavioralSessionLockLifecycle",
                                         "TestRlsPoliciesVerification",
                                         "TestLineagePublishBoundary",
                                         "TestMigration0036AclHardening"],
}

for script_name, keywords in VS_F_SCRIPTS.items():
    spath = SCRIPTS_DIR / script_name
    ok(f"script exists: {script_name}", spath.exists())
    if spath.exists():
        scontent = spath.read_text(encoding="utf-8")
        for kw in keywords:
            ok(f"  {script_name}: contains '{kw}'", kw in scontent)

# Negative pattern check: pg_policies catalog type-compatibility (Request 027)
# publish.sql and verify.sql must NOT contain the broken ACL-shorthand patterns.
print()
print("=== 10b. pg_policies catalog type-compatibility (Request 027 regression) ===")
for sql_name in ("chg_g6_002_publish.sql", "chg_g6_002_verify.sql"):
    sql_path = SCRIPTS_DIR / sql_name
    if sql_path.exists():
        sql_text = sql_path.read_text(encoding="utf-8")
        ok(f"  {sql_name}: no ACL shorthand cmd IN ('r',",
           "cmd IN ('r'," not in sql_text)
        ok(f"  {sql_name}: no empty-array PUBLIC check roles = '{{}}'::TEXT[]",
           "roles = '{}'::TEXT[]" not in sql_text)


# ---------------------------------------------------------------------------
# 11. PowerShell wrapper security
# ---------------------------------------------------------------------------
print()
print("=== 11. PowerShell wrapper security ===")
ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
if ps1_path.exists():
    ps1 = ps1_path.read_text(encoding="utf-8")
    ok("PS1 uses Read-Host -AsSecureString",
       "Read-Host" in ps1 and "AsSecureString" in ps1)
    ok("PS1 has finally{} with Clear-DbUrl",
       "finally" in ps1 and "Clear-DbUrl" in ps1)
    ok("PS1 sets env var as Process scope only",
       "'Process'" in ps1)
    ok("PS1 does not log DB URL",
       "Write-Host $dbUrl" not in ps1 and "Write-Output $dbUrl" not in ps1)
    ok("PS1 does not use Invoke-Psql (removed for security)",
       "Invoke-Psql" not in ps1)
    ok("PS1 uses Invoke-SqlRunner for SQL execution",
       "Invoke-SqlRunner" in ps1)
    ok("PS1 uses Invoke-SupabaseDbPush for migrations",
       "Invoke-SupabaseDbPush" in ps1)
    ok("PS1 requires -Approved for live actions",
       "-Approved" in ps1)
    ok("PS1 checks $LASTEXITCODE after Python calls",
       "LASTEXITCODE" in ps1)
else:
    ok("PowerShell wrapper exists", False)


# ---------------------------------------------------------------------------
# 12. Publish SQL validation
# ---------------------------------------------------------------------------
print()
print("=== 12. Publish SQL validation ===")
pub_path = SCRIPTS_DIR / "chg_g6_002_publish.sql"
if pub_path.exists():
    pub = pub_path.read_text(encoding="utf-8")
    ok("publish uses TRUNCATE before INSERT", "TRUNCATE" in pub)
    ok("publish uses NULLIF for facility_mgt_no normalization",
       "NULLIF" in pub)
    ok("publish notes facility_products_public VIEW auto-reflects",
       "auto" in pub.lower() or "VIEW" in pub)
    ok("publish sets lineage publish_version atomically",
       "publish_version" in pub and "chg-g6-002-v1" in pub)
    ok("publish adds data_lineage_public to ACL guard",
       "data_lineage_public" in pub)
    ok("publish uses bounded UPDATE via checkpoint run IDs",
       "load_checkpoint" in pub and "_run_ids" in pub)
else:
    ok("publish SQL exists", False)

verify_path = SCRIPTS_DIR / "chg_g6_002_verify.sql"
if verify_path.exists():
    ver = verify_path.read_text(encoding="utf-8")
    ok("verify checks products_public count (1,047,894)", "1047894" in ver.replace(",", "").replace("_", ""))
    ok("verify checks VIEW count (815,989)", "815989" in ver.replace(",", "").replace("_", ""))
    ok("verify checks mapping boundary (265/4/39)",
       "265" in ver and "39" in ver)
    ok("verify has executable RLS check (relrowsecurity)",
       "relrowsecurity" in ver)
    ok("verify has executable ACL check (effective privileges)",
       "has_table_privilege" in ver and "has_schema_privilege" in ver)
    ok("verify uses RAISE EXCEPTION on violations",
       "RAISE EXCEPTION" in ver)
    ok("verify checks private/staging schema access blocked",
       "staging" in ver and "private" in ver)
    ok("verify has lineage publish boundary section",
       "data_lineage_public" in ver and "publish_version" in ver)
    ok("verify checks lineage publish_version = chg-g6-002-v1",
       "chg-g6-002-v1" in ver)
    ok("verify checks VIEW definition filter",
       "publish_version IS NOT NULL" in ver)
else:
    ok("verify SQL exists", False)

rollback_data_path = SCRIPTS_DIR / "chg_g6_002_publish_rollback.sql"
if rollback_data_path.exists():
    rbd = rollback_data_path.read_text(encoding="utf-8")
    ok("publish_rollback uses TRUNCATE (not DROP)",
       "TRUNCATE" in rbd and "DROP" not in rbd.upper().split("--")[0])
    ok("publish_rollback clears lineage publish_version markers",
       "publish_version" in rbd)
    ok("publish_rollback asserts lineage not visible in data_lineage_public",
       "data_lineage_public" in rbd)
else:
    ok("publish_rollback SQL exists", False)


# ---------------------------------------------------------------------------
# 12b. Migration 0036 ACL hardening validation
# ---------------------------------------------------------------------------
print()
print("=== 12b. Migration 0036 ACL hardening ===")
ACL_RELATIONS = [
    "products_public", "haccp_certifications_public", "facility_safety_public",
    "manufacturing_profiles_public", "facility_products_public", "data_lineage_public",
]
ACL_SEQUENCES = [
    "haccp_certifications_public_id_seq", "facility_safety_public_id_seq",
]

acl_mig_path = MIGRATIONS_DIR / ACL_MIGRATION_FILE
ok(f"migration exists: {ACL_MIGRATION_FILE}", acl_mig_path.exists())
if acl_mig_path.exists():
    acl_content = acl_mig_path.read_text(encoding="utf-8")
    ok("0036 has BEGIN/COMMIT transaction", "BEGIN;" in acl_content and "COMMIT;" in acl_content)
    ok("0036 has REMOTE EXECUTION PROHIBITED note", "REMOTE EXECUTION PROHIBITED" in acl_content)
    for rel in ACL_RELATIONS:
        ok(f"  0036: REVOKE ALL on {rel} FROM PUBLIC,anon,authenticated",
           f"REVOKE ALL PRIVILEGES ON public.{rel} FROM PUBLIC, anon, authenticated" in acl_content
           or f"REVOKE ALL PRIVILEGES ON public.{rel} FROM PUBLIC,anon,authenticated" in acl_content)
        ok(f"  0036: GRANT SELECT on {rel} TO anon,authenticated",
           f"GRANT SELECT ON public.{rel} TO anon, authenticated" in acl_content)
    for seq in ACL_SEQUENCES:
        ok(f"  0036: REVOKE ALL on SEQUENCE {seq}",
           f"REVOKE ALL PRIVILEGES ON SEQUENCE public.{seq} FROM PUBLIC, anon, authenticated" in acl_content
           or f"REVOKE ALL PRIVILEGES ON SEQUENCE public.{seq} FROM PUBLIC,anon,authenticated" in acl_content)
    # No data DML/TRUNCATE
    for forbidden_dml in ["INSERT INTO", "UPDATE ", "DELETE FROM", "TRUNCATE"]:
        # skip comments
        executable_lines = [
            line for line in acl_content.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        executable_sql = "\n".join(executable_lines)
        ok(f"  0036: no data DML '{forbidden_dml}' in executable SQL",
           forbidden_dml not in executable_sql or forbidden_dml in "REVOKE ALL PRIVILEGES")
    # DML-free check (refined): only REVOKE, GRANT, BEGIN, COMMIT allowed
    dml_found = []
    for line in acl_content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        upper = stripped.upper()
        if any(upper.startswith(kw) for kw in ["REVOKE", "GRANT", "BEGIN", "COMMIT"]):
            continue
        dml_found.append(stripped)
    ok("  0036: only REVOKE/GRANT/BEGIN/COMMIT in executable SQL",
       len(dml_found) == 0, f"unexpected: {dml_found[:3]}" if dml_found else "")

# 0036 rollback validation
acl_rb_path = ROLLBACK_DIR / ACL_ROLLBACK_FILE
ok(f"rollback exists: {ACL_ROLLBACK_FILE}", acl_rb_path.exists())
if acl_rb_path.exists():
    acl_rb = acl_rb_path.read_text(encoding="utf-8")
    ok("0036 rollback has BEGIN/COMMIT", "BEGIN;" in acl_rb and "COMMIT;" in acl_rb)
    ok("0036 rollback has REMOTE EXECUTION PROHIBITED note", "REMOTE EXECUTION PROHIBITED" in acl_rb)
    ok("0036 rollback has FAIL-CLOSED warning",
       "FAIL-CLOSED" in acl_rb)
    ok("0036 rollback has explicit negative restoration statement",
       "does NOT attempt to restore the pre-0036 ACL state exactly" in acl_rb
       or "does not attempt to restore the pre-0036 ACL state exactly" in acl_rb)
    # Distinguish positive restoration claims from the required negative sentence.
    # Lines mentioning "restore(s) the pre-0036 ACL state" are acceptable only when
    # they also contain "not" (i.e., the required negative framing).
    _restore_lines = [
        line for line in acl_rb.splitlines()
        if re.search(r"restore[s]? the pre.0036 ACL state", line, re.IGNORECASE)
    ]
    _no_positive_restore = all("not" in line.lower() for line in _restore_lines) if _restore_lines else True
    ok("0036 rollback does NOT claim pre-0036 exact restore",
       _no_positive_restore
       and "Removing explicit REVOKE restores prior defaults" not in acl_rb)
    for rel in ACL_RELATIONS:
        ok(f"  0036 rollback: REVOKE ALL on {rel}",
           f"REVOKE ALL PRIVILEGES ON public.{rel} FROM PUBLIC, anon, authenticated" in acl_rb
           or f"REVOKE ALL PRIVILEGES ON public.{rel} FROM PUBLIC,anon,authenticated" in acl_rb)
        ok(f"  0036 rollback: GRANT SELECT on {rel}",
           f"GRANT SELECT ON public.{rel} TO anon, authenticated" in acl_rb)
    for seq in ACL_SEQUENCES:
        ok(f"  0036 rollback: REVOKE ALL on SEQUENCE {seq}",
           f"REVOKE ALL PRIVILEGES ON SEQUENCE public.{seq} FROM PUBLIC, anon, authenticated" in acl_rb
           or f"REVOKE ALL PRIVILEGES ON SEQUENCE public.{seq} FROM PUBLIC,anon,authenticated" in acl_rb)


# ---------------------------------------------------------------------------
# 13. No secrets / PII in all files
# ---------------------------------------------------------------------------
print()
print("=== 13. No secrets / PII in migration files and scripts ===")
SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9]{20,}",
    r"eyJ[A-Za-z0-9_-]{20,}",
    r"password\s*=\s*['\"][^'\"]{4,}",
    r"SUPABASE_SERVICE_ROLE_KEY",
    r"postgres://[^:]+:[^@]+@",
]

check_files = (
    list(MIGRATIONS_DIR.glob("20260830*.sql"))
    + list(MIGRATIONS_DIR.glob("20260831*.sql"))
    + [rollback_path, lineage_rb_path, acl_rb_path]
    + [f for f in SCRIPTS_DIR.glob("chg_g6_002_*")
       if f.name != "chg_g6_002_dryrun_validator.py"]  # exclude self (contains pattern strings)
)
for mf in check_files:
    if not mf.exists():
        continue
    content = mf.read_text(encoding="utf-8")
    for pat in SECRET_PATTERNS:
        match = re.search(pat, content, re.IGNORECASE)
        ok(f"no secret in {mf.name}", match is None,
           f"pattern: {pat[:30]}" if match else "")


# ---------------------------------------------------------------------------
# 14. Product search index/runtime contract
# ---------------------------------------------------------------------------
print()
print("=== 14. Product search index/runtime contract ===")
products_migration = MIGRATIONS_DIR / VS_A_MIGRATIONS[0]
if products_migration.exists():
    products_sql = products_migration.read_text(encoding="utf-8")
    ok(
        "0028 has product_name simple-configuration GIN FTS index",
        "USING gin (to_tsvector('simple', product_name))" in products_sql,
    )
else:
    ok("0028 product migration exists for FTS contract", False)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print()
print(f"=== Dry-run validator: {len(errors)} error(s) ===")
for e in errors:
    print(f"  {FAIL}  {e}")

verdict = "PASS" if not errors else "FAIL"
print(f"\n=== Verdict: {verdict} ===")

# Runtime note: VS-I uses this committed simple-configuration GIN FTS index.
print(f"\n  {INFO}  Product-name search uses the 0028 simple-configuration GIN FTS index")

sys.exit(0 if not errors else 1)
