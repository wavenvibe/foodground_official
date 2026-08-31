"""
CHG-G6-002 VS-F — SQL Runner (psql replacement)

Executes SQL files against the Supabase PostgreSQL database via psycopg2.
The DSN is read from the SUPABASE_DB_URL environment variable — never from
CLI arguments, logs, or temp files.

This replaces `psql $DSN -f <file>` calls that exposed the DSN in the
process command line (visible in ps/tasklist/proc).

Usage:
    python scripts/chg_g6_002_sql_runner.py <sql_file> [--on-error-stop]

Environment:
    SUPABASE_DB_URL  PostgreSQL connection string (required).

REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")

APPROVED_PROJECT_REF = "glczrbadvfgmblmkpgfj"


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


def run_sql_file(sql_file: Path, on_error_stop: bool = True) -> None:
    """Execute a SQL file via psycopg2. DSN from SUPABASE_DB_URL env only."""
    try:
        import psycopg2  # type: ignore[import-untyped]
    except ImportError:
        print("ERROR: psycopg2 is required. pip install psycopg2-binary")
        sys.exit(1)

    dsn = os.environ.get("SUPABASE_DB_URL", "")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL environment variable is not set.")
        sys.exit(1)

    validate_dsn(dsn)

    if not sql_file.is_file():
        print(f"ERROR: SQL file not found: {sql_file}")
        sys.exit(1)

    sql = sql_file.read_text(encoding="utf-8")

    # Mask any DSN/password in error messages
    def mask_error(msg: str) -> str:
        msg = re.sub(r"password=[^\s]+", "password=***", msg)
        msg = re.sub(r"postgresql://[^\s]+", "postgresql://***", msg)
        return msg

    conn = None
    try:
        conn = psycopg2.connect(dsn, sslmode="require")
        conn.autocommit = True  # Let the SQL file manage its own transactions
        cur = conn.cursor()

        print(f"Executing: {sql_file.name}")

        # psycopg2 execute() can run multi-statement SQL
        cur.execute(sql)

        # Fetch and display any NOTICE messages via connection notices
        for notice in conn.notices:
            # Strip trailing newlines
            print(f"  NOTICE: {notice.strip()}")

        print(f"  OK: {sql_file.name} completed.")

    except Exception as exc:
        err_msg = mask_error(str(exc))
        print(f"ERROR executing {sql_file.name}: {err_msg}")
        if on_error_stop:
            sys.exit(1)
    finally:
        if conn:
            conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CHG-G6-002 SQL Runner — executes SQL via psycopg2 (no psql DSN exposure)"
    )
    parser.add_argument("sql_file", type=Path, help="Path to the SQL file to execute.")
    parser.add_argument(
        "--on-error-stop", action="store_true", default=True,
        help="Exit with code 1 on error (default: True)."
    )
    parser.add_argument(
        "--no-error-stop", action="store_true",
        help="Continue on error (override --on-error-stop)."
    )
    args = parser.parse_args()

    on_error_stop = not args.no_error_stop
    run_sql_file(args.sql_file, on_error_stop=on_error_stop)


if __name__ == "__main__":
    main()
