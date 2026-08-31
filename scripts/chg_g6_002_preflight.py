"""
CHG-G6-002 VS-F — Preflight Check

Validates that the remote Supabase project is ready for migration + staging load.
Checks:
  1. Project ref matches approved target (glczrbadvfgmblmkpgfj) via URL-parsed DSN
  2. VS-2 pre-existing tables (7) are present with exact expected counts
  3. Migrations 0028-0034 applied state via supabase_migrations.schema_migrations
  4. staging/private schemas exist or will be created by migrations
  5. No conflicting objects in target schemas
  6. Supabase CLI linkage check (for migrate action)

Environment:
  SUPABASE_DB_URL   PostgreSQL connection string (required for live run).

Usage:
  python scripts/chg_g6_002_preflight.py --dry-run     (local only, no connection)
  python scripts/chg_g6_002_preflight.py                (live check, VS-G only)

REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).parent.parent
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"

APPROVED_PROJECT_REF = "glczrbadvfgmblmkpgfj"

VS2_TABLES = [
    "facilities",
    "recipes",
    "ingredients",
    "recipe_ingredients",
    "standard_foods",
    "substitute_pairs",
    "ingredient_name_match",
]

VS2_EXPECTED_COUNTS = {
    "facilities": 94723,
    "recipes": 70165,
    "ingredients": 18932,
    "recipe_ingredients": 679457,
    "standard_foods": 686,
    "substitute_pairs": 234955,
    "ingredient_name_match": 23806,
}

CHG_G6_002_OBJECTS = {
    "tables": [
        ("public", "products_public"),
        ("public", "haccp_certifications_public"),
        ("public", "facility_safety_public"),
        ("public", "manufacturing_profiles_public"),
        ("private", "company_profile_mapping"),
        ("private", "load_checkpoint"),
        ("staging", "production_log_raw"),
        ("staging", "haccp_cert_raw"),
        ("staging", "sales_suspension_raw"),
        ("staging", "company_profiles_raw"),
    ],
    "views": [
        ("public", "facility_products_public"),
    ],
}

MIGRATION_FILES = [
    "20260830000000_0028_vs-a_g6_002_public_products.sql",
    "20260830001000_0029_vs-a_g6_002_facility_products_public.sql",
    "20260830002000_0030_vs-a_g6_002_haccp_certifications_public.sql",
    "20260830003000_0031_vs-a_g6_002_facility_safety_public.sql",
    "20260830004000_0032_vs-a_g6_002_manufacturing_profiles_public.sql",
    "20260830005000_0033_vs-a_g6_002_private_mapping.sql",
    "20260830006000_0034_g6_002_load_checkpoint.sql",
]

# Migration version names as they appear in schema_migrations
MIGRATION_VERSIONS = [
    "20260830000000",
    "20260830001000",
    "20260830002000",
    "20260830003000",
    "20260830004000",
    "20260830005000",
    "20260830006000",
]

PASS = "\u2705 PASS"
FAIL = "\u274c FAIL"
errors: list[str] = []


def ok(label: str, condition: bool, detail: str = "") -> bool:
    mark = PASS if condition else FAIL
    suffix = f"  ({detail})" if detail else ""
    print(f"  {mark}  {label}{suffix}")
    if not condition:
        errors.append(f"{label}: {detail or 'failed'}")
    return condition


def validate_dsn(dsn: str) -> None:
    """Parse and validate DSN against approved project ref.

    Accepts only:
      - pooler: username=postgres.<ref>, host=*.pooler.supabase.com, db=postgres
      - direct: username=postgres, host=db.<ref>.supabase.co, db=postgres
    Rejects if password substring contains the ref (bypass attempt).
    """
    parsed = urlparse(dsn)

    if parsed.scheme not in ("postgresql", "postgres"):
        print("ERROR: DSN scheme must be postgresql or postgres.")
        sys.exit(1)

    if not parsed.hostname or not parsed.username:
        print("ERROR: Cannot parse DSN host/username.")
        sys.exit(1)

    # Reject password containing the ref (bypass attempt)
    if parsed.password and APPROVED_PROJECT_REF in parsed.password:
        print("ERROR: DSN password contains project ref — possible bypass attempt.")
        sys.exit(1)

    db_name = parsed.path.lstrip("/") if parsed.path else ""
    host = parsed.hostname
    username = parsed.username
    try:
        port = parsed.port
    except ValueError:
        print("ERROR: DSN port is invalid.")
        sys.exit(1)

    # Pooler form: postgres.<ref>@*.pooler.supabase.com
    is_pooler = (
        username == f"postgres.{APPROVED_PROJECT_REF}"
        and host.endswith(".pooler.supabase.com")
        and port in (5432, 6543)
        and db_name == "postgres"
    )

    # Direct form: postgres@db.<ref>.supabase.co
    is_direct = (
        username == "postgres"
        and host == f"db.{APPROVED_PROJECT_REF}.supabase.co"
        and port == 5432
        and db_name == "postgres"
    )

    if not is_pooler and not is_direct:
        print("ERROR: DSN does not match approved pooler or direct format.")
        print(f"  username={username}, host={host}, db={db_name}")
        print(f"  Expected pooler: postgres.{APPROVED_PROJECT_REF}@*.pooler.supabase.com/postgres")
        print(f"  Expected direct: postgres@db.{APPROVED_PROJECT_REF}.supabase.co/postgres")
        sys.exit(1)


def find_supabase_cli() -> dict | None:
    """Find Supabase CLI: FOODGROUND_SUPABASE_EXE > PATH > npx.

    Returns structured {exe, prefix_args} -- never a concatenated string.
    """
    env_exe = os.environ.get("FOODGROUND_SUPABASE_EXE", "")
    if env_exe and Path(env_exe).is_file():
        return {"exe": env_exe, "prefix_args": []}

    path_exe = shutil.which("supabase")
    if path_exe:
        return {"exe": path_exe, "prefix_args": []}

    npx = shutil.which("npx")
    if npx:
        return {"exe": npx, "prefix_args": ["supabase"]}

    return None


def check_supabase_link() -> bool:
    """Check if Supabase project is linked to the approved ref."""
    # Check .temp/project-ref or supabase/.temp/project-ref
    for candidate in [
        REPO_ROOT / "supabase" / ".temp" / "project-ref",
        REPO_ROOT / ".supabase" / "project-ref",
    ]:
        if candidate.is_file():
            ref = candidate.read_text(encoding="utf-8").strip()
            return ok(
                "Supabase linked project ref",
                ref == APPROVED_PROJECT_REF,
                f"actual={ref}, expected={APPROVED_PROJECT_REF}",
            )

    print(f"  {FAIL}  Supabase project not linked (no project-ref file found).")
    print("         Run: supabase link --project-ref glczrbadvfgmblmkpgfj")
    print("         Do NOT auto-link; link manually and re-run preflight.")
    errors.append("Supabase project not linked")
    return False


def run_dry() -> None:
    """Local-only preflight: check migration files exist and are well-formed."""
    print("=== VS-F Preflight — DRY RUN (local only) ===")
    print()

    # 1. Migration files exist
    print("--- 1. Migration files ---")
    for fname in MIGRATION_FILES:
        fpath = MIGRATIONS_DIR / fname
        ok(f"migration exists: {fname}", fpath.exists())

    # 2. Rollback file exists
    print()
    print("--- 2. Rollback file ---")
    rollback = REPO_ROOT / "supabase" / "rollback" / "20260830_0028_0033_vs-a_g6_002_rollback.sql"
    ok("rollback exists", rollback.exists())
    if rollback.exists():
        content = rollback.read_text(encoding="utf-8")
        ok("rollback has DROP VIEW for facility_products_public",
           "DROP VIEW IF EXISTS public.facility_products_public" in content)
        ok("rollback has DROP TABLE for load_checkpoint",
           "load_checkpoint" in content)

    # 3. 0029 is VIEW not TABLE
    print()
    print("--- 3. facility_products_public is VIEW ---")
    m0029 = MIGRATIONS_DIR / MIGRATION_FILES[1]
    if m0029.exists():
        content = m0029.read_text(encoding="utf-8")
        ok("0029 creates VIEW", "CREATE OR REPLACE VIEW" in content)
        ok("0029 has security_invoker", "security_invoker" in content.lower())
        ok("0029 does NOT create TABLE",
           "CREATE TABLE" not in content)

    # 4. 0034 checkpoint table
    print()
    print("--- 4. Checkpoint migration ---")
    m0034 = MIGRATIONS_DIR / MIGRATION_FILES[6]
    if m0034.exists():
        content = m0034.read_text(encoding="utf-8")
        ok("0034 creates load_checkpoint", "load_checkpoint" in content)
        ok("0034 has source_fingerprint column", "source_fingerprint" in content)
        ok("0034 has dataset column", "dataset" in content)
        ok("0034 revokes public access", "REVOKE" in content)

    # 5. Supabase CLI and link check
    print()
    print("--- 5. Supabase CLI ---")
    cli = find_supabase_cli()
    if cli:
        cli_exe = cli["exe"]
        cli_args = cli["prefix_args"]
        print(f"  INFO  Supabase CLI found: {cli_exe} (args: {cli_args})")
    else:
        print("  INFO  Supabase CLI not found (FOODGROUND_SUPABASE_EXE / PATH / npx)")
        print("        Install: npm i -g supabase or set FOODGROUND_SUPABASE_EXE")

    print()
    print("--- 6. Supabase project link ---")
    check_supabase_link()

    # 7. VS-2 expected counts (info only in dry-run)
    print()
    print("--- 7. VS-2 expected counts (live check will verify) ---")
    for tbl, expected in VS2_EXPECTED_COUNTS.items():
        print(f"  INFO  {tbl} expected: {expected:,}")

    print()
    verdict = "PASS" if not errors else "FAIL"
    print(f"=== Preflight DRY RUN: {verdict} ({len(errors)} error(s)) ===")
    if errors:
        for e in errors:
            print(f"  {FAIL}  {e}")
        sys.exit(1)


def run_live() -> None:
    """Live preflight: read-only checks against the remote Supabase project."""
    try:
        import psycopg2  # type: ignore[import-untyped]
    except ImportError:
        print("ERROR: psycopg2 is required for live preflight.")
        print("       pip install psycopg2-binary")
        sys.exit(1)

    dsn = os.environ.get("SUPABASE_DB_URL", "")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL environment variable is not set.")
        sys.exit(1)

    # URL-parsed DSN validation (defect G)
    validate_dsn(dsn)

    print("=== VS-F Preflight — LIVE (read-only) ===")
    print()

    # Extract host for display (mask credentials)
    parsed = urlparse(dsn)
    print(f"  Target host: {parsed.hostname}")
    print(f"  Approved ref: {APPROVED_PROJECT_REF}")
    print()

    conn = None
    try:
        conn = psycopg2.connect(
            dsn,
            sslmode="require",
            options="-c default_transaction_read_only=on",
        )
        cur = conn.cursor()

        # 1. Check VS-2 tables exist with exact expected counts (defect G)
        print("--- 1. VS-2 pre-existing tables (exact count verification) ---")
        for tbl, expected in VS2_EXPECTED_COUNTS.items():
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = %s)",
                (tbl,),
            )
            exists = cur.fetchone()[0]
            if ok(f"VS-2 table exists: {tbl}", exists):
                cur.execute(f'SELECT COUNT(*) FROM public."{tbl}"')
                cnt = cur.fetchone()[0]
                ok(f"  {tbl} exact count",
                   cnt == expected,
                   f"actual={cnt:,} expected={expected:,}")

        # 2. Check migration applied state via schema_migrations (defect B)
        print()
        print("--- 2. Migration applied state (schema_migrations) ---")
        try:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations')"
            )
            sm_exists = cur.fetchone()[0]
            if ok("supabase_migrations.schema_migrations exists", sm_exists):
                applied = set()
                for ver in MIGRATION_VERSIONS:
                    cur.execute(
                        "SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations "
                        "WHERE version = %s)",
                        (ver,),
                    )
                    is_applied = cur.fetchone()[0]
                    state = "APPLIED" if is_applied else "NOT APPLIED"
                    print(f"  INFO  migration {ver}: {state}")
                    if is_applied:
                        applied.add(ver)

                applied_count = len(applied)
                total = len(MIGRATION_VERSIONS)
                if applied_count == 0:
                    print(f"  {PASS}  Clean slate: 0/{total} migrations applied")
                elif applied_count == total:
                    print(f"  INFO  Fully applied: {applied_count}/{total} migrations")
                else:
                    ok(f"Migration state",
                       False,
                       f"{applied_count}/{total} — partial application detected")
        except Exception as exc:
            err = str(exc).split("\n")[0]
            err = re.sub(r"password=[^\s]+", "password=***", err)
            ok(
                "schema_migrations state readable",
                False,
                f"query failed: {err}",
            )

        # 3. Check CHG-G6-002 objects
        print()
        print("--- 3. CHG-G6-002 object state ---")
        applied_count = 0
        total_objects = len(CHG_G6_002_OBJECTS["tables"]) + len(CHG_G6_002_OBJECTS["views"])

        for schema, tbl in CHG_G6_002_OBJECTS["tables"]:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s)",
                (schema, tbl),
            )
            exists = cur.fetchone()[0]
            state = "APPLIED" if exists else "NOT APPLIED"
            if exists:
                applied_count += 1
            print(f"  INFO  {schema}.{tbl}: {state}")

        for schema, vw in CHG_G6_002_OBJECTS["views"]:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.views "
                "WHERE table_schema = %s AND table_name = %s)",
                (schema, vw),
            )
            exists = cur.fetchone()[0]
            state = "APPLIED" if exists else "NOT APPLIED"
            if exists:
                applied_count += 1
            print(f"  INFO  {schema}.{vw} (VIEW): {state}")

        if applied_count == 0:
            print(f"  {PASS}  Clean slate: 0/{total_objects} CHG-G6-002 objects exist")
        elif applied_count == total_objects:
            print(f"  INFO  Fully applied: {applied_count}/{total_objects} CHG-G6-002 objects exist")
        else:
            ok(f"CHG-G6-002 partial state", False,
               f"{applied_count}/{total_objects} objects — partial application detected")

        # 4. Check staging/private schemas
        print()
        print("--- 4. Schema state ---")
        for schema_name in ("private", "staging"):
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.schemata "
                "WHERE schema_name = %s)",
                (schema_name,),
            )
            exists = cur.fetchone()[0]
            print(f"  INFO  schema '{schema_name}': {'EXISTS' if exists else 'DOES NOT EXIST (will be created by migration)'}")

        # 5. Supabase CLI and link check
        print()
        print("--- 5. Supabase CLI and link ---")
        cli = find_supabase_cli()
        if cli:
            cli_exe = cli["exe"]
            cli_args = cli["prefix_args"]
            print(f"  INFO  Supabase CLI: {cli_exe} (args: {cli_args})")
        else:
            print("  INFO  Supabase CLI not found")
        check_supabase_link()

        cur.close()

    except Exception as exc:
        # Do not leak DSN or password in error output
        if "psycopg2" in type(exc).__module__:
            err_msg = str(exc).split("\n")[0] if str(exc) else "connection error"
            err_msg = re.sub(r"password=[^\s]+", "password=***", err_msg)
            err_msg = re.sub(r"postgresql://[^\s]+", "postgresql://***", err_msg)
            ok("DB connection", False, err_msg)
        else:
            raise
    finally:
        if conn:
            conn.close()

    print()
    verdict = "PASS" if not errors else "FAIL"
    print(f"=== Preflight LIVE: {verdict} ({len(errors)} error(s)) ===")
    if errors:
        for e in errors:
            print(f"  {FAIL}  {e}")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="CHG-G6-002 VS-F Preflight Check")
    parser.add_argument("--dry-run", action="store_true",
                        help="Local-only checks (no Supabase connection).")
    args = parser.parse_args()

    if args.dry_run:
        run_dry()
    else:
        run_live()


if __name__ == "__main__":
    main()
