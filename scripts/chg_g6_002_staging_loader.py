"""
CHG-G6-002 VS-F — Staging Loader (idempotent, resumable)

Loads source data from the Foodground SQLite DB and company_profiles CSV
into Supabase staging tables via psycopg2 chunked UPSERT.

Datasets:
  production_log  -> staging.production_log_raw   (1,047,894 rows)
  haccp_cert      -> staging.haccp_cert_raw        (308 rows)
  sales_suspension-> staging.sales_suspension_raw  (355 rows)
  company_profiles-> staging.company_profiles_raw  (308 rows)
  mapping         -> private.company_profile_mapping (308 rows)

Features:
  --dry-run       Validate source and print plan; do not connect to Supabase.
  --only <ds>     Load only the specified dataset.
  --resume        Resume from the last checkpoint for the given dataset(s).
  --batch-size N  Rows per transaction chunk (default 5000).
  --approved      Required flag for live execution (safety gate).

Environment:
  FOODGROUND_SOURCE_DB   Path to foodground.db (opened mode=ro, query_only=ON).
  SUPABASE_DB_URL        PostgreSQL connection string (used only in live mode).

Security:
  - Source DB is opened read-only (URI mode=ro + PRAGMA query_only=ON).
  - DSN validated via URL parsing against approved pooler/direct forms.
  - No credentials, DSNs, absolute paths, or raw data samples in stdout.
  - Source file size and mtime are verified before and after load.
  - Lineage row created before first UPSERT (FK contract).
  - Checkpoint concurrency via stable session-level PostgreSQL advisory lock.
  - Bulk UPSERT via psycopg2.extras.execute_batch.

REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sqlite3
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).parent.parent
PROFILES_CSV = (
    REPO_ROOT
    / "03_\uacf5\ub3d9\uc81c\uc870 \ub9e4\uce6d \uc815\ud655\ub3c4(F1 SCORE)"
    / "03_\ud14c\uc2a4\ud2b8\ub370\uc774\ud130\uc14b"
    / "company_profiles.csv"
)
MAPPING_CSV = REPO_ROOT / "data" / "derived" / "chg-g6-002" / "company_profile_facility_mapping.csv"

ALL_DATASETS = [
    "production_log",
    "haccp_cert",
    "sales_suspension",
    "company_profiles",
    "mapping",
]

EXPECTED_COUNTS: dict[str, int] = {
    "production_log": 1_047_894,
    "haccp_cert": 308,
    "sales_suspension": 355,
    "company_profiles": 308,
    "mapping": 308,
}

DEFAULT_BATCH_SIZE = 5000

APPROVED_PROJECT_REF = "glczrbadvfgmblmkpgfj"

# Logical source identifiers (no absolute paths stored in lineage)
SOURCE_IDENTIFIERS: dict[str, str] = {
    "production_log": "foodground.db:production_log",
    "haccp_cert": "foodground.db:haccp_cert",
    "sales_suspension": "foodground.db:sales_suspension",
    "company_profiles": "company_profiles.csv",
    "mapping": "company_profile_facility_mapping.csv",
}

# Advisory lock namespace (CRC32-derived constant)
ADVISORY_LOCK_KEY = 0x3A7F_0C02

# Target tables for post-load count verification
TARGET_TABLES: dict[str, str] = {
    "production_log": "staging.production_log_raw",
    "haccp_cert": "staging.haccp_cert_raw",
    "sales_suspension": "staging.sales_suspension_raw",
    "company_profiles": "staging.company_profiles_raw",
    "mapping": "private.company_profile_mapping",
}


# ---------------------------------------------------------------------------
# DSN validation (defect G — URL-parsed target guard)
# ---------------------------------------------------------------------------
def validate_dsn(dsn: str) -> None:
    """Parse and validate DSN against approved project ref.

    Accepts only:
      - pooler: username=postgres.<ref>, host=*.pooler.supabase.com, db=postgres
      - direct: username=postgres, host=db.<ref>.supabase.co, db=postgres
    Rejects if password contains the ref (bypass attempt).
    """
    parsed = urlparse(dsn)

    if parsed.scheme not in ("postgresql", "postgres"):
        print("ERROR: DSN scheme must be postgresql or postgres.")
        sys.exit(1)

    if not parsed.hostname or not parsed.username:
        print("ERROR: Cannot parse DSN host/username.")
        sys.exit(1)

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

    is_pooler = (
        username == f"postgres.{APPROVED_PROJECT_REF}"
        and host.endswith(".pooler.supabase.com")
        and port in (5432, 6543)
        and db_name == "postgres"
    )
    is_direct = (
        username == "postgres"
        and host == f"db.{APPROVED_PROJECT_REF}.supabase.co"
        and port == 5432
        and db_name == "postgres"
    )

    if not is_pooler and not is_direct:
        print("ERROR: DSN does not match approved pooler or direct format.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Source fingerprint (defect E — per-file fingerprints)
# ---------------------------------------------------------------------------
def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def file_stat(path: Path) -> tuple[int, float]:
    """Return (size_bytes, mtime) for invariance check."""
    st = path.stat()
    return st.st_size, st.st_mtime


def get_source_path(dataset: str, db_path: Path | None) -> Path:
    """Return the source file path for a dataset."""
    if dataset == "company_profiles":
        return PROFILES_CSV
    elif dataset == "mapping":
        return MAPPING_CSV
    else:
        if db_path is None:
            raise ValueError("db_path required for SQLite-sourced datasets")
        return db_path


def get_source_fingerprint(dataset: str, db_path: Path | None) -> str:
    """Return SHA-256 fingerprint for the dataset's own source file.

    SQLite datasets use the SQLite file fingerprint.
    CSV datasets use their own CSV file fingerprint.
    """
    return sha256_file(get_source_path(dataset, db_path))


def collect_all_source_stats(
    datasets: list[str], db_path: Path | None,
) -> dict[str, tuple[int, float]]:
    """Collect size/mtime for all relevant source files."""
    stats: dict[str, tuple[int, float]] = {}
    for ds in datasets:
        p = get_source_path(ds, db_path)
        if p.is_file():
            stats[str(p)] = file_stat(p)
    return stats


def verify_source_invariance(
    pre_stats: dict[str, tuple[int, float]],
    datasets: list[str],
    db_path: Path | None,
) -> bool:
    """Verify all source files are unchanged (size+mtime)."""
    for ds in datasets:
        p = get_source_path(ds, db_path)
        key = str(p)
        if key not in pre_stats:
            continue
        pre_size, pre_mtime = pre_stats[key]
        post_size, post_mtime = file_stat(p)
        if pre_size != post_size or pre_mtime != post_mtime:
            print(f"ERROR: Source file changed during operation: {p.name}")
            return False
    return True


# ---------------------------------------------------------------------------
# Source readers (read-only)
# ---------------------------------------------------------------------------
@dataclass
class SourceReader:
    db_path: Path
    _con: sqlite3.Connection | None = field(default=None, init=False, repr=False)

    def open(self) -> None:
        uri = f"file:{self.db_path}?mode=ro"
        self._con = sqlite3.connect(uri, uri=True)
        self._con.execute("PRAGMA query_only = ON")

    def close(self) -> None:
        if self._con:
            self._con.close()
            self._con = None

    def count(self, table: str) -> int:
        assert self._con
        cur = self._con.execute(f"SELECT COUNT(*) FROM {table}")
        return cur.fetchone()[0]

    def iter_production_log(self, after_key: str | None = None, batch: int = DEFAULT_BATCH_SIZE):
        assert self._con
        sql = (
            "SELECT report_no, facility_mgt_no, product_name, category, "
            "maker_name, ingredients, shelf_life_days, reported_at, updated_at "
            "FROM production_log "
        )
        params: list[Any] = []
        if after_key:
            sql += "WHERE report_no > ? "
            params.append(after_key)
        sql += "ORDER BY report_no ASC"
        cur = self._con.execute(sql, params)
        while True:
            rows = cur.fetchmany(batch)
            if not rows:
                break
            yield rows

    def iter_haccp_cert(self, after_key: str | None = None, batch: int = DEFAULT_BATCH_SIZE):
        assert self._con
        sql = "SELECT id, facility_mgt_no, biz_name, cert_no, cert_date, ccp_list, updated_at FROM haccp_cert "
        params: list[Any] = []
        if after_key:
            sql += "WHERE id > ? "
            params.append(int(after_key))
        sql += "ORDER BY id ASC"
        cur = self._con.execute(sql, params)
        while True:
            rows = cur.fetchmany(batch)
            if not rows:
                break
            yield rows

    def iter_sales_suspension(self, after_key: str | None = None, batch: int = DEFAULT_BATCH_SIZE):
        assert self._con
        sql = (
            "SELECT id, facility_mgt_no, product_name, maker_name, "
            "reason, method, batch_mfg_date, batch_exp_date, barcode, "
            "product_code, image_url, published_at, created_at "
            "FROM sales_suspension "
        )
        params: list[Any] = []
        if after_key:
            sql += "WHERE id > ? "
            params.append(int(after_key))
        sql += "ORDER BY id ASC"
        cur = self._con.execute(sql, params)
        while True:
            rows = cur.fetchmany(batch)
            if not rows:
                break
            yield rows


def iter_company_profiles(after_key: str | None = None, batch: int = DEFAULT_BATCH_SIZE):
    with open(PROFILES_CSV, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        buf: list[tuple] = []
        skipping = after_key is not None
        for row in reader:
            if skipping:
                if row["company_id"] == after_key:
                    skipping = False
                continue
            buf.append((
                row["company_id"],
                row["company_name"],
                row["item_set"],
                row.get("ccp_set_std", ""),
                row.get("ccp_vector", ""),
                row.get("has_cooking_ccp", "false").lower() == "true",
                row.get("has_sterilize_ccp", "false").lower() == "true",
                row.get("sido", ""),
            ))
            if len(buf) >= batch:
                yield buf
                buf = []
        if buf:
            yield buf


def iter_mapping(after_key: str | None = None, batch: int = DEFAULT_BATCH_SIZE):
    with open(MAPPING_CSV, "r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        buf: list[tuple] = []
        skipping = after_key is not None
        for row in reader:
            if skipping:
                if row["company_id"] == after_key:
                    skipping = False
                continue
            buf.append((
                row["company_id"],
                row["status"],
                row.get("facility_mgt_no", ""),
                row["match_basis"],
                int(row.get("candidate_count", 0)),
                row.get("needs_review", "false").lower() == "true",
            ))
            if len(buf) >= batch:
                yield buf
                buf = []
        if buf:
            yield buf


# ---------------------------------------------------------------------------
# UPSERT SQL templates (staging targets)
# ---------------------------------------------------------------------------
UPSERT_SQL: dict[str, str] = {
    "production_log": """
        INSERT INTO staging.production_log_raw
          (report_no, facility_mgt_no, product_name, category,
           maker_name, ingredients, shelf_life_days, reported_at, updated_at,
           ingest_run_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (report_no) DO UPDATE SET
          facility_mgt_no = EXCLUDED.facility_mgt_no,
          product_name    = EXCLUDED.product_name,
          category        = EXCLUDED.category,
          maker_name      = EXCLUDED.maker_name,
          ingredients     = EXCLUDED.ingredients,
          shelf_life_days = EXCLUDED.shelf_life_days,
          reported_at     = EXCLUDED.reported_at,
          updated_at      = EXCLUDED.updated_at,
          ingest_run_id   = EXCLUDED.ingest_run_id,
          load_timestamp  = now()
    """,
    "haccp_cert": """
        INSERT INTO staging.haccp_cert_raw
          (id, facility_mgt_no, biz_name, cert_no, cert_date, ccp_list,
           updated_at, ingest_run_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          facility_mgt_no = EXCLUDED.facility_mgt_no,
          biz_name        = EXCLUDED.biz_name,
          cert_no         = EXCLUDED.cert_no,
          cert_date       = EXCLUDED.cert_date,
          ccp_list        = EXCLUDED.ccp_list,
          updated_at      = EXCLUDED.updated_at,
          ingest_run_id   = EXCLUDED.ingest_run_id,
          load_timestamp  = now()
    """,
    "sales_suspension": """
        INSERT INTO staging.sales_suspension_raw
          (id, facility_mgt_no, product_name, maker_name,
           reason, method, batch_mfg_date, batch_exp_date, barcode,
           product_code, image_url, published_at, created_at,
           ingest_run_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          facility_mgt_no = EXCLUDED.facility_mgt_no,
          product_name    = EXCLUDED.product_name,
          maker_name      = EXCLUDED.maker_name,
          reason          = EXCLUDED.reason,
          method          = EXCLUDED.method,
          batch_mfg_date  = EXCLUDED.batch_mfg_date,
          batch_exp_date  = EXCLUDED.batch_exp_date,
          barcode         = EXCLUDED.barcode,
          product_code    = EXCLUDED.product_code,
          image_url       = EXCLUDED.image_url,
          published_at    = EXCLUDED.published_at,
          created_at      = EXCLUDED.created_at,
          ingest_run_id   = EXCLUDED.ingest_run_id,
          load_timestamp  = now()
    """,
    "company_profiles": """
        INSERT INTO staging.company_profiles_raw
          (company_id, company_name, item_set, ccp_set_std, ccp_vector,
           has_cooking_ccp, has_sterilize_ccp, sido,
           ingest_run_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (company_id) DO UPDATE SET
          company_name      = EXCLUDED.company_name,
          item_set          = EXCLUDED.item_set,
          ccp_set_std       = EXCLUDED.ccp_set_std,
          ccp_vector        = EXCLUDED.ccp_vector,
          has_cooking_ccp   = EXCLUDED.has_cooking_ccp,
          has_sterilize_ccp = EXCLUDED.has_sterilize_ccp,
          sido              = EXCLUDED.sido,
          ingest_run_id     = EXCLUDED.ingest_run_id,
          load_timestamp    = now()
    """,
    "mapping": """
        INSERT INTO private.company_profile_mapping
          (company_id, status, facility_mgt_no, match_basis,
           candidate_count, needs_review, mapping_rule,
           ingest_run_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (company_id) DO UPDATE SET
          status          = EXCLUDED.status,
          facility_mgt_no = EXCLUDED.facility_mgt_no,
          match_basis     = EXCLUDED.match_basis,
          candidate_count = EXCLUDED.candidate_count,
          needs_review    = EXCLUDED.needs_review,
          mapping_rule    = EXCLUDED.mapping_rule,
          ingest_run_id   = EXCLUDED.ingest_run_id
    """,
}

MAPPING_RULE = "v0.2-norm-name-sido-in-addr-no-bidirectional"


# ---------------------------------------------------------------------------
# Lineage helpers (defect C — create lineage BEFORE first UPSERT)
# ---------------------------------------------------------------------------
def _create_lineage_record(
    pg_cur: Any, ingest_run_id: str, dataset: str,
    fingerprint: str, row_count: int = 0, reject_count: int = 0,
) -> None:
    """Create a data_lineage record. Called before first UPSERT (FK contract)."""
    pg_cur.execute(
        "INSERT INTO private.data_lineage "
        "(id, dataset_name, source_path, source_sha256, row_count, reject_count, "
        " basis_date, rule_version, ingest_run_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, CURRENT_DATE, %s, now()) "
        "ON CONFLICT (id) DO NOTHING",
        (
            ingest_run_id,
            dataset,
            SOURCE_IDENTIFIERS.get(dataset, dataset),
            fingerprint,
            row_count,
            reject_count,
            MAPPING_RULE,
        ),
    )


def _update_lineage_record(
    pg_cur: Any, ingest_run_id: str,
    row_count: int, reject_count: int = 0,
) -> None:
    """Update lineage row_count and ingest_run_at on completion."""
    pg_cur.execute(
        "UPDATE private.data_lineage "
        "SET row_count = %s, reject_count = %s, ingest_run_at = now() "
        "WHERE id = %s",
        (row_count, reject_count, ingest_run_id),
    )


# ---------------------------------------------------------------------------
# Checkpoint helpers (defect D — advisory lock, failed status, resume safety)
# ---------------------------------------------------------------------------
def _dataset_lock_key(dataset: str) -> int:
    """Return a stable signed-positive 31-bit lock key for a dataset."""
    digest = hashlib.sha256(dataset.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFF_FFFF


def _acquire_advisory_lock(pg_cur: Any, dataset: str) -> None:
    """Acquire a session lock held across chunk commits for one dataset."""
    pg_cur.execute(
        "SELECT pg_try_advisory_lock(%s, %s)",
        (ADVISORY_LOCK_KEY, _dataset_lock_key(dataset)),
    )
    acquired = pg_cur.fetchone()[0]
    if not acquired:
        raise RuntimeError(
            f"Another loader session is active for dataset '{dataset}'."
        )


def _release_advisory_lock(pg_cur: Any, dataset: str) -> None:
    """Release the dataset session lock after completion."""
    pg_cur.execute(
        "SELECT pg_advisory_unlock(%s, %s)",
        (ADVISORY_LOCK_KEY, _dataset_lock_key(dataset)),
    )


def _get_resumable_checkpoint(
    pg_cur: Any, dataset: str, fingerprint: str
) -> dict[str, Any] | None:
    """Find a single resumable checkpoint (status='running' or 'failed')."""
    pg_cur.execute(
        "SELECT ingest_run_id, source_fingerprint, last_source_key, loaded_rows, status "
        "FROM private.load_checkpoint "
        "WHERE dataset = %s AND status IN ('running', 'failed') "
        "ORDER BY started_at DESC",
        (dataset,),
    )
    rows = pg_cur.fetchall()

    if len(rows) > 1:
        raise RuntimeError(
            f"Multiple active/failed runs for dataset '{dataset}' — "
            f"cannot safely resume. Cancel stale runs first."
        )

    if len(rows) == 0:
        return None

    run_id, stored_fp, last_key, loaded, status = rows[0]
    if stored_fp != fingerprint:
        raise RuntimeError(
            f"Fingerprint mismatch for dataset '{dataset}': "
            f"checkpoint={stored_fp[:16]}... vs source={fingerprint[:16]}... — "
            f"source file changed since last run. Cannot resume."
        )

    return {
        "ingest_run_id": run_id,
        "last_source_key": last_key,
        "loaded_rows": loaded,
        "status": status,
    }


def _validate_resume_lineage(
    pg_cur: Any,
    ingest_run_id: str,
    dataset: str,
    fingerprint: str,
) -> None:
    """Require checkpoint lineage to match both dataset and source digest."""
    pg_cur.execute(
        "SELECT dataset_name, source_sha256 "
        "FROM private.data_lineage WHERE id = %s",
        (ingest_run_id,),
    )
    lineage = pg_cur.fetchone()
    if lineage is None:
        raise RuntimeError(
            f"Lineage record missing for run {ingest_run_id}. Cannot safely resume."
        )
    if lineage[0] != dataset or lineage[1] != fingerprint:
        raise RuntimeError(
            f"Lineage mismatch for dataset '{dataset}'. "
            f"Dataset name and source fingerprint must match."
        )


def _create_checkpoint(
    pg_cur: Any, dataset: str, ingest_run_id: str, fingerprint: str
) -> None:
    """Insert a new checkpoint after the caller acquired the session lock."""
    pg_cur.execute(
        "SELECT COUNT(*) FROM private.load_checkpoint "
        "WHERE dataset = %s AND status IN ('running', 'failed')",
        (dataset,),
    )
    active_count = pg_cur.fetchone()[0]
    if active_count > 0:
        raise RuntimeError(
            f"Resumable run already exists for dataset '{dataset}'. "
            f"Use --resume or explicitly cancel it before starting a new one."
        )
    pg_cur.execute(
        "INSERT INTO private.load_checkpoint "
        "(dataset, ingest_run_id, source_fingerprint, last_source_key, loaded_rows, status) "
        "VALUES (%s, %s, %s, NULL, 0, 'running')",
        (dataset, ingest_run_id, fingerprint),
    )


def _update_checkpoint(
    pg_cur: Any, dataset: str, ingest_run_id: str,
    last_key: str, loaded_rows: int, status: str = "running",
) -> None:
    pg_cur.execute(
        "UPDATE private.load_checkpoint "
        "SET last_source_key = %s, loaded_rows = %s, status = %s, updated_at = now() "
        "WHERE dataset = %s AND ingest_run_id = %s",
        (last_key, loaded_rows, status, dataset, ingest_run_id),
    )


def _assert_target_empty(pg_cur: Any, dataset: str) -> None:
    """Require target table to have 0 rows before a fresh (non-resume) load.

    Prevents stale rows from a prior run surviving an UPSERT that only
    touches the same-PK subset.  If target is non-empty the caller must
    use --resume or a separately approved replacement procedure.
    """
    table = TARGET_TABLES[dataset]
    pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
    cnt = pg_cur.fetchone()[0]
    if cnt != 0:
        raise RuntimeError(
            f"Target {table} is not empty ({cnt} existing rows). "
            f"Use --resume to continue a prior run, or follow an approved "
            f"replacement procedure before starting a fresh load."
        )


def _verify_target_count(pg_cur: Any, dataset: str, expected: int) -> bool:
    """Verify actual target table row count matches expected."""
    table = TARGET_TABLES[dataset]
    pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
    actual = pg_cur.fetchone()[0]
    if actual != expected:
        print(f"  ERROR: {table} row count mismatch: expected={expected}, actual={actual}")
        return False
    return True


# ---------------------------------------------------------------------------
# Dry-run mode (defect E — exit 1 on count mismatch)
# ---------------------------------------------------------------------------
def run_dry(args: argparse.Namespace) -> None:
    db_path = Path(os.environ.get("FOODGROUND_SOURCE_DB", ""))
    if not db_path.is_file():
        print("ERROR: FOODGROUND_SOURCE_DB not set or file not found.")
        sys.exit(1)

    datasets = args.only if args.only else ALL_DATASETS

    print("=== VS-F Staging Loader — DRY RUN ===")
    print()

    # Collect all source stats before operations
    pre_stats = collect_all_source_stats(datasets, db_path)

    # Per-dataset fingerprints
    fingerprints: dict[str, str] = {}
    for ds in datasets:
        fp = get_source_fingerprint(ds, db_path)
        fingerprints[ds] = fp
        src = get_source_path(ds, db_path)
        size, _ = file_stat(src)
        print(f"  {ds} source: {src.name}, fingerprint={fp[:16]}..., size={size:,}")

    print()

    reader = SourceReader(db_path)
    reader.open()

    plan: list[dict] = []
    has_mismatch = False
    for ds in datasets:
        if ds in ("company_profiles", "mapping"):
            csv_path = PROFILES_CSV if ds == "company_profiles" else MAPPING_CSV
            if not csv_path.is_file():
                print(f"  ERROR: {ds} source CSV not found")
                has_mismatch = True
                continue
            enc = "utf-8-sig" if ds == "company_profiles" else "utf-8"
            with open(csv_path, "r", encoding=enc, newline="") as fh:
                row_count = sum(1 for _ in csv.DictReader(fh))
        else:
            row_count = reader.count(ds)

        expected = EXPECTED_COUNTS.get(ds, 0)
        if row_count != expected:
            match_str = f"MISMATCH (expected {expected})"
            has_mismatch = True
        else:
            match_str = "OK"
        plan.append({"dataset": ds, "rows": row_count, "expected": expected, "match": match_str})
        print(f"  {ds}: {row_count:,} rows  [{match_str}]")

    reader.close()

    # Verify all source files unchanged
    if not verify_source_invariance(pre_stats, datasets, db_path):
        print("ERROR: Source file(s) changed during dry-run.")
        sys.exit(1)

    print()
    print("Source invariance: OK")

    # Defect E: exit 1 on count mismatch (not warning)
    if has_mismatch:
        print()
        print("ERROR: Row count mismatch(es) detected. Aborting.")
        sys.exit(1)

    print()
    print(f"Batch size: {args.batch_size}")
    print(f"Resume: {args.resume}")
    print(f"Datasets: {', '.join(datasets)}")
    print()
    print("DRY RUN complete. No remote connections made.")

    result = {
        "mode": "dry-run",
        "fingerprints": {ds: fingerprints.get(ds, "") for ds in datasets},
        "batch_size": args.batch_size,
        "resume": args.resume,
        "datasets": plan,
        "mismatches": 0,
    }
    print()
    print(json.dumps(result, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# Live mode (defect C, D, E, F, G all addressed)
# ---------------------------------------------------------------------------
def run_live(args: argparse.Namespace) -> None:
    if not args.approved:
        print("ERROR: Live execution requires --approved flag as safety gate.")
        sys.exit(1)

    try:
        import psycopg2  # type: ignore[import-untyped]
        import psycopg2.extras  # type: ignore[import-untyped]
    except ImportError:
        print("ERROR: psycopg2 is required for live staging load.")
        print("       pip install psycopg2-binary")
        sys.exit(1)

    dsn = os.environ.get("SUPABASE_DB_URL", "")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL environment variable is not set.")
        sys.exit(1)

    validate_dsn(dsn)

    db_path_str = os.environ.get("FOODGROUND_SOURCE_DB", "")
    db_path = Path(db_path_str) if db_path_str else None
    if not db_path or not db_path.is_file():
        print("ERROR: FOODGROUND_SOURCE_DB not set or file not found.")
        sys.exit(1)

    datasets = args.only if args.only else ALL_DATASETS
    batch_size = args.batch_size

    # Defect E: Pre-load source stats for ALL source files
    pre_stats = collect_all_source_stats(datasets, db_path)

    reader = SourceReader(db_path)
    reader.open()

    conn = None
    try:
        conn = psycopg2.connect(dsn, sslmode="require")

        for ds in datasets:
            fingerprint = get_source_fingerprint(ds, db_path)
            ingest_run_id: str
            after_key: str | None
            loaded_so_far: int

            cur = conn.cursor()
            _acquire_advisory_lock(cur, ds)

            # All dataset processing wrapped in try/finally so the
            # advisory lock is released on every exit path — success,
            # chunk failure, fingerprint/lineage/count/source-invariance
            # exceptions.  Connection-close is the ultimate fallback if
            # the unlock itself fails due to a severed connection.
            try:
                if args.resume:
                    checkpoint = _get_resumable_checkpoint(cur, ds, fingerprint)
                    if checkpoint:
                        ingest_run_id = str(checkpoint["ingest_run_id"])
                        after_key = checkpoint["last_source_key"]
                        loaded_so_far = checkpoint["loaded_rows"]

                        _validate_resume_lineage(
                            cur, ingest_run_id, ds, fingerprint
                        )

                        if checkpoint["status"] == "failed":
                            _update_checkpoint(
                                cur, ds, ingest_run_id,
                                after_key or "", loaded_so_far, "running"
                            )
                            conn.commit()

                        print(f"  Resuming {ds} from checkpoint, loaded={loaded_so_far}")
                    else:
                        ingest_run_id = str(uuid.uuid4())
                        after_key = None
                        loaded_so_far = 0
                        # Empty guard: fresh load requires empty target
                        _assert_target_empty(cur, ds)
                        _create_lineage_record(cur, ingest_run_id, ds, fingerprint)
                        _create_checkpoint(cur, ds, ingest_run_id, fingerprint)
                        conn.commit()
                        print(f"  Starting fresh {ds} (no resumable checkpoint)")
                else:
                    ingest_run_id = str(uuid.uuid4())
                    after_key = None
                    loaded_so_far = 0
                    # Empty guard: fresh load requires empty target
                    _assert_target_empty(cur, ds)
                    _create_lineage_record(cur, ingest_run_id, ds, fingerprint)
                    _create_checkpoint(cur, ds, ingest_run_id, fingerprint)
                    conn.commit()

                # Select the iterator
                if ds == "production_log":
                    batches = reader.iter_production_log(after_key=after_key, batch=batch_size)
                elif ds == "haccp_cert":
                    batches = reader.iter_haccp_cert(after_key=after_key, batch=batch_size)
                elif ds == "sales_suspension":
                    batches = reader.iter_sales_suspension(after_key=after_key, batch=batch_size)
                elif ds == "company_profiles":
                    batches = iter_company_profiles(after_key=after_key, batch=batch_size)
                elif ds == "mapping":
                    batches = iter_mapping(after_key=after_key, batch=batch_size)
                else:
                    print(f"  WARN: Unknown dataset '{ds}', skipping")
                    continue

                upsert_sql = UPSERT_SQL[ds]
                chunk_count = 0
                last_key_value = after_key or ""

                try:
                    for batch_rows in batches:
                        cur2 = conn.cursor()

                        if ds == "mapping":
                            params_list = [row + (MAPPING_RULE, ingest_run_id) for row in batch_rows]
                        else:
                            params_list = [row + (ingest_run_id,) for row in batch_rows]

                        psycopg2.extras.execute_batch(
                            cur2, upsert_sql, params_list, page_size=batch_size
                        )

                        loaded_so_far += len(batch_rows)
                        last_key_value = str(batch_rows[-1][0])

                        _update_checkpoint(
                            cur2, ds, ingest_run_id, last_key_value, loaded_so_far
                        )
                        conn.commit()
                        chunk_count += 1
                        print(f"  {ds}: chunk {chunk_count}, rows={loaded_so_far}")

                except Exception:
                    if conn and not conn.closed:
                        conn.rollback()
                        try:
                            fail_cur = conn.cursor()
                            _update_checkpoint(
                                fail_cur, ds, ingest_run_id,
                                last_key_value, loaded_so_far, "failed"
                            )
                            conn.commit()
                            print(f"  {ds}: FAILED — checkpoint preserved at rows={loaded_so_far}")
                        except Exception:
                            pass
                    raise

                if not verify_source_invariance(pre_stats, [ds], db_path):
                    invariant_cur = conn.cursor()
                    _update_checkpoint(
                        invariant_cur, ds, ingest_run_id,
                        last_key_value, loaded_so_far, "failed"
                    )
                    conn.commit()
                    print(f"  {ds}: Source changed — NOT marked completed")
                    sys.exit(1)

                ver_cur = conn.cursor()
                expected_count = EXPECTED_COUNTS.get(ds, loaded_so_far)
                if not _verify_target_count(ver_cur, ds, expected_count):
                    _update_checkpoint(
                        ver_cur, ds, ingest_run_id,
                        last_key_value, loaded_so_far, "failed"
                    )
                    conn.commit()
                    print(f"  {ds}: Target count mismatch — NOT marked completed")
                    sys.exit(1)

                done_cur = conn.cursor()
                _update_checkpoint(
                    done_cur, ds, ingest_run_id,
                    last_key_value, loaded_so_far, "completed"
                )
                _update_lineage_record(done_cur, ingest_run_id, loaded_so_far)
                conn.commit()
                print(f"  {ds}: COMPLETED ({loaded_so_far} rows)")

            finally:
                # Release advisory lock on every exit path.
                # On connection loss this will fail; connection close is
                # the ultimate release mechanism for session locks.
                try:
                    if conn and not conn.closed:
                        unlock_cur = conn.cursor()
                        _release_advisory_lock(unlock_cur, ds)
                        conn.commit()
                except Exception:
                    pass

    except Exception:
        if conn and not conn.closed:
            conn.rollback()
        raise
    finally:
        reader.close()
        if conn and not conn.closed:
            conn.close()

    # Defect E: Post-load source invariance check
    if not verify_source_invariance(pre_stats, datasets, db_path):
        print("ERROR: Source file(s) changed during load!")
        sys.exit(1)

    print()
    print("Live staging load complete.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="CHG-G6-002 VS-F Staging Loader",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Validate source and print plan without connecting to Supabase.",
    )
    parser.add_argument(
        "--only", nargs="+", choices=ALL_DATASETS,
        help="Load only the specified dataset(s).",
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="Resume from last checkpoint (requires matching source fingerprint).",
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"Rows per transaction chunk (default {DEFAULT_BATCH_SIZE}).",
    )
    parser.add_argument(
        "--approved", action="store_true",
        help="Required flag for live execution (safety gate).",
    )
    args = parser.parse_args()

    if args.dry_run:
        run_dry(args)
    else:
        run_live(args)


if __name__ == "__main__":
    main()
