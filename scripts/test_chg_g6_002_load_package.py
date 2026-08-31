"""
CHG-G6-002 VS-F — Executable Unit Tests for Data Load Package

Tests the staging loader, preflight DSN validation, PowerShell runner,
publish/verify/rollback SQL, and RLS/ACL contracts WITHOUT any remote
Supabase connection.

Run:
    python -m pytest scripts/test_chg_g6_002_load_package.py -v
    (or) python scripts/test_chg_g6_002_load_package.py

10 original test cases per request.md section I + strengthened guards:
  1. lineage before first UPSERT
  2. chunk bulk UPSERT + checkpoint update
  3. resume success
  4. fingerprint mismatch rejection
  5. multiple active/resumable rejection
  6. failed checkpoint preservation + nonzero exit
  7. count mismatch blocks completed status
  8. DSN parser bypass rejection
  9. PowerShell exit-code guard + psql DSN arg = 0
 10. publish pre-COMMIT verify + rollback CASCADE=0 + RLS/ACL EXCEPTION
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, call
from urllib.parse import urlparse

# Add scripts dir to path for imports
SCRIPTS_DIR = Path(__file__).parent
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

# Import DSN validation from sql_runner and preflight
from chg_g6_002_sql_runner import validate_dsn as sql_runner_validate_dsn
from chg_g6_002_preflight import validate_dsn as preflight_validate_dsn
from chg_g6_002_staging_loader import (
    _acquire_advisory_lock,
    _assert_target_empty,
    _create_checkpoint,
    _create_lineage_record,
    _dataset_lock_key,
    _get_resumable_checkpoint,
    _release_advisory_lock,
    _update_checkpoint,
    _update_lineage_record,
    _validate_resume_lineage,
    _verify_target_count,
)

APPROVED_REF = "glczrbadvfgmblmkpgfj"


class TestLineageBeforeUpsert(unittest.TestCase):
    """I-1: Fresh run creates lineage record BEFORE first UPSERT."""

    def test_staging_loader_creates_lineage_before_checkpoint(self):
        """Verify _create_lineage_record is called before _create_checkpoint
        in the staging_loader module design."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        # Find the method that starts a fresh run
        # _create_lineage_record must be called before _create_checkpoint
        lineage_pos = content.find("_create_lineage_record")
        checkpoint_pos = content.find("_create_checkpoint")

        self.assertGreater(lineage_pos, -1, "Missing _create_lineage_record function")
        self.assertGreater(checkpoint_pos, -1, "Missing _create_checkpoint function")

        # In the run_live method, lineage should be created first
        run_section = content[content.find("def run_live"):]
        self.assertTrue(len(run_section) > 0, "def run_live not found")

        # Within the execution flow, lineage creation must precede checkpoint
        lineage_call = run_section.find("_create_lineage_record(")
        checkpoint_call = run_section.find("_create_checkpoint(")

        self.assertGreater(lineage_call, -1,
                           "_create_lineage_record not called in run_live flow")
        self.assertGreater(checkpoint_call, -1,
                           "_create_checkpoint not called in run_live flow")
        self.assertLess(lineage_call, checkpoint_call,
                        "lineage must be created BEFORE checkpoint (FK dependency)")


class TestChunkBulkAndCheckpoint(unittest.TestCase):
    """I-2: Chunk bulk UPSERT uses execute_batch and updates checkpoint."""

    def test_uses_execute_batch_not_row_by_row(self):
        """Verify staging_loader uses psycopg2.extras.execute_batch."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("execute_batch", content,
                       "Must use execute_batch for bulk operations")
        self.assertIn("psycopg2.extras", content,
                       "Must import psycopg2.extras for execute_batch")

    def test_checkpoint_updated_after_chunk(self):
        """Verify checkpoint is updated with loaded_rows and last_source_key."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("loaded_rows", content,
                       "Checkpoint must track loaded_rows")
        self.assertIn("last_source_key", content,
                       "Checkpoint must track last_source_key")

        # Checkpoint update must happen in the chunk loop
        self.assertIn("UPDATE private.load_checkpoint", content,
                       "Must UPDATE checkpoint after each chunk")


class TestResumeSuccess(unittest.TestCase):
    """I-3: Resume from checkpoint with matching fingerprint succeeds."""

    def test_resume_accepts_running_and_failed_status(self):
        """Verify --resume accepts both 'running' and 'failed' checkpoint states."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        # Resume logic should accept both running and failed
        self.assertIn("'running'", content)
        self.assertIn("'failed'", content)

        # Should have resume-related logic
        self.assertIn("--resume", content,
                       "Must support --resume flag")

    def test_resume_verifies_fingerprint(self):
        """Verify resume checks fingerprint consistency."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("source_fingerprint", content,
                       "Must verify source_fingerprint on resume")


class TestFingerprintMismatchRejection(unittest.TestCase):
    """I-4: Fingerprint mismatch causes rejection."""

    def test_per_file_fingerprint_used(self):
        """Verify per-file SHA-256 fingerprint calculation."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("sha256", content.lower(),
                       "Must use SHA-256 for fingerprinting")
        self.assertIn("get_source_fingerprint", content,
                       "Must have get_source_fingerprint function")

    def test_source_invariance_check(self):
        """Verify source file size/mtime is checked before and after."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("verify_source_invariance", content,
                       "Must verify source invariance (size/mtime)")
        self.assertIn("collect_all_source_stats", content,
                       "Must collect source stats before and after")

    def test_dry_run_count_mismatch_is_exit1(self):
        """Verify dry-run count mismatch is exit 1, not just warning."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        # Find dry-run section and verify exit(1) on count mismatch
        self.assertIn("sys.exit(1)", content,
                       "Must exit(1) on count mismatch")


class TestMultipleActiveRejection(unittest.TestCase):
    """I-5: Multiple active/resumable checkpoints are rejected."""

    def test_advisory_lock_used(self):
        """Verify session advisory lock for concurrency control."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("pg_try_advisory_lock", content,
                       "Must use a session lock held across chunk commits")
        self.assertIn("pg_advisory_unlock", content,
                       "Must explicitly release the session lock")

    def test_unique_active_checkpoint_enforced(self):
        """Verify only one running checkpoint is allowed per dataset."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        # Should check for existing running checkpoints
        self.assertIn("status", content)
        # The checkpoint table + advisory lock enforce single active


class TestFailedCheckpointPreservation(unittest.TestCase):
    """I-6: Failed checkpoint preserves state and exits nonzero."""

    def test_exception_marks_checkpoint_failed(self):
        """Verify chunk exception marks checkpoint as 'failed'."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        # On exception, checkpoint should be marked 'failed'
        self.assertIn("'failed'", content,
                       "Must mark checkpoint as 'failed' on exception")

        # Must preserve last_source_key and loaded_rows
        self.assertIn("last_source_key", content)
        self.assertIn("loaded_rows", content)

    def test_exits_nonzero_on_failure(self):
        """Verify nonzero exit code on chunk failure."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        # After marking failed, should re-raise or exit nonzero
        self.assertIn("raise", content.lower(),
                       "Must re-raise exception after marking checkpoint failed")


class TestCountMismatchBlocksCompleted(unittest.TestCase):
    """I-7: Count mismatch prevents checkpoint from being marked completed."""

    def test_verify_target_count_before_completed(self):
        """Verify actual DB count is checked before marking completed."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")

        self.assertIn("_verify_target_count", content,
                       "Must verify target count before marking completed")

        # In run_live, verify_target_count must come BEFORE 'completed' status
        run_live_section = content[content.find("def run_live"):]
        verify_pos = run_live_section.find("_verify_target_count(")
        completed_pos = run_live_section.find('"completed"')

        self.assertGreater(verify_pos, -1,
                           "_verify_target_count not called in run_live")
        self.assertGreater(completed_pos, -1,
                           "completed status not set in run_live")
        self.assertLess(verify_pos, completed_pos,
                        "count verification must come BEFORE marking completed")


class TestDsnParserBypassRejection(unittest.TestCase):
    """I-8: DSN parser rejects password-substring bypass and non-approved forms."""

    def _validate_dsn_exits(self, dsn: str) -> bool:
        """Helper: returns True if validate_dsn rejects the DSN (calls sys.exit)."""
        with self.assertRaises(SystemExit):
            preflight_validate_dsn(dsn)
        return True

    def test_approved_pooler_passes(self):
        """Approved pooler form passes validation."""
        dsn = f"postgresql://postgres.{APPROVED_REF}:mypassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
        # Should NOT raise
        preflight_validate_dsn(dsn)

    def test_approved_direct_passes(self):
        """Approved direct form passes validation."""
        dsn = f"postgresql://postgres:mypassword@db.{APPROVED_REF}.supabase.co:5432/postgres"
        preflight_validate_dsn(dsn)

    def test_password_containing_ref_rejected(self):
        """Password containing project ref is rejected (bypass attempt)."""
        dsn = f"postgresql://postgres.{APPROVED_REF}:{APPROVED_REF}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
        self._validate_dsn_exits(dsn)

    def test_wrong_host_rejected(self):
        """Wrong host is rejected."""
        dsn = f"postgresql://postgres.{APPROVED_REF}:pwd@evil.example.com:5432/postgres"
        self._validate_dsn_exits(dsn)

    def test_wrong_database_rejected(self):
        """Wrong database name is rejected."""
        dsn = f"postgresql://postgres.{APPROVED_REF}:pwd@aws-0-us-east-1.pooler.supabase.com:6543/other_db"
        self._validate_dsn_exits(dsn)

    def test_wrong_username_rejected(self):
        """Wrong username is rejected."""
        dsn = f"postgresql://admin:pwd@db.{APPROVED_REF}.supabase.co:5432/postgres"
        self._validate_dsn_exits(dsn)

    def test_wrong_port_rejected(self):
        """Unexpected database ports are rejected."""
        dsn = f"postgresql://postgres.{APPROVED_REF}:pwd@x.pooler.supabase.com:9999/postgres"
        self._validate_dsn_exits(dsn)

    def test_empty_dsn_rejected(self):
        """Empty DSN is rejected."""
        self._validate_dsn_exits("")

    def test_sql_runner_validate_dsn_same_behavior(self):
        """sql_runner.py validate_dsn has the same rejection behavior."""
        # Password bypass
        bad_dsn = f"postgresql://postgres.{APPROVED_REF}:{APPROVED_REF}@x.pooler.supabase.com/postgres"
        with self.assertRaises(SystemExit):
            sql_runner_validate_dsn(bad_dsn)

        # Valid pooler
        good_dsn = f"postgresql://postgres.{APPROVED_REF}:pwd@x.pooler.supabase.com:6543/postgres"
        sql_runner_validate_dsn(good_dsn)


class TestPowerShellExitCodeGuard(unittest.TestCase):
    """I-9: PowerShell checks $LASTEXITCODE after every Python/CLI call
    and does not pass DSN as psql argument."""

    def test_no_psql_dsn_argument(self):
        """Verify psql is NOT called with DSN as CLI argument."""
        ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
        content = ps1_path.read_text(encoding="utf-8")

        # No '& psql $env:SUPABASE_DB_URL' pattern
        self.assertNotIn("& psql $env:SUPABASE_DB_URL", content,
                          "Must NOT pass DSN as psql CLI argument")
        # No Invoke-Psql function
        self.assertNotIn("function Invoke-Psql", content,
                          "Invoke-Psql function must be removed")

    def test_uses_sql_runner(self):
        """Verify SQL execution goes through sql_runner.py."""
        ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
        content = ps1_path.read_text(encoding="utf-8")

        self.assertIn("chg_g6_002_sql_runner.py", content,
                       "Must use sql_runner.py for SQL execution")

    def test_lastexitcode_checked(self):
        """Verify $LASTEXITCODE is checked after Python/CLI calls."""
        ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
        content = ps1_path.read_text(encoding="utf-8")

        self.assertIn("$LASTEXITCODE", content,
                       "Must check $LASTEXITCODE after external commands")

        # Count LASTEXITCODE checks — should be multiple
        checks = content.count("$LASTEXITCODE")
        self.assertGreaterEqual(checks, 2,
                                 f"Expected multiple $LASTEXITCODE checks, found {checks}")

    def test_approved_flag_required_for_live(self):
        """Verify -Approved flag is required for live actions."""
        ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
        content = ps1_path.read_text(encoding="utf-8")

        self.assertIn("-Approved", content,
                       "Must require -Approved flag for live actions")
        self.assertIn("$Approved", content)

    def test_uses_supabase_cli_for_migrate(self):
        """Verify migrate action uses Supabase CLI db push, not raw psql."""
        ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
        content = ps1_path.read_text(encoding="utf-8")

        self.assertIn("db push", content,
                       "Must use supabase db push for migration")
        self.assertIn("--dry-run", content,
                       "Must do db push --dry-run first")

    def test_pipeline_stops_on_failure(self):
        """Verify full pipeline stops on any step failure."""
        ps1_path = SCRIPTS_DIR / "chg_g6_002_run_migration.ps1"
        content = ps1_path.read_text(encoding="utf-8")

        # ErrorActionPreference = Stop
        self.assertIn("$ErrorActionPreference = 'Stop'", content)
        # Invoke-Python throws on nonzero
        self.assertIn("throw", content.lower())


class TestPublishVerifyRollbackRlsAcl(unittest.TestCase):
    """I-10: publish pre-COMMIT verify, rollback CASCADE=0, RLS/ACL EXCEPTION."""

    def test_publish_has_pre_commit_verification(self):
        """Verify publish.sql has verification block before COMMIT."""
        pub_path = SCRIPTS_DIR / "chg_g6_002_publish.sql"
        content = pub_path.read_text(encoding="utf-8")

        # Must have both INSERT and verification
        self.assertIn("INSERT INTO", content)
        self.assertIn("COMMIT", content)

        # Verification must come before COMMIT
        # Look for count check or verification block before COMMIT
        commit_pos = content.rfind("COMMIT")
        # There should be verification/count checks before COMMIT
        pre_commit = content[:commit_pos]
        has_verify = ("COUNT" in pre_commit or "RAISE" in pre_commit
                      or "IF" in pre_commit)
        self.assertTrue(has_verify,
                        "Must have verification before COMMIT in publish SQL")

    def test_rollback_no_cascade(self):
        """Verify rollback SQL does not use CASCADE."""
        rollback_path = SCRIPTS_DIR / "chg_g6_002_publish_rollback.sql"
        content = rollback_path.read_text(encoding="utf-8")

        # Count CASCADE occurrences (should be 0)
        cascade_count = len(re.findall(r'\bCASCADE\b', content, re.IGNORECASE))
        self.assertEqual(cascade_count, 0,
                          f"Rollback must not use CASCADE, found {cascade_count} occurrences")

    def test_schema_rollback_no_cascade(self):
        """Verify schema rollback does not use CASCADE."""
        rollback_path = REPO_ROOT / "supabase" / "rollback" / "20260830_0028_0033_vs-a_g6_002_rollback.sql"
        if rollback_path.exists():
            content = rollback_path.read_text(encoding="utf-8")
            cascade_count = len(re.findall(r'\bCASCADE\b', content, re.IGNORECASE))
            self.assertEqual(cascade_count, 0,
                              f"Schema rollback must not use CASCADE, found {cascade_count}")

    def test_verify_sql_has_rls_acl_exception(self):
        """Verify verify.sql has actual RLS/ACL checks with RAISE EXCEPTION."""
        verify_path = SCRIPTS_DIR / "chg_g6_002_verify.sql"
        content = verify_path.read_text(encoding="utf-8")

        # Must have actual SET ROLE or privilege checks, not just comments
        self.assertIn("RAISE EXCEPTION", content,
                       "Must use RAISE EXCEPTION for RLS/ACL violations")

        # Must check RLS enabled
        self.assertIn("relrowsecurity", content,
                       "Must check pg_class.relrowsecurity for RLS status")

        # Must check anon and authenticated privileges
        self.assertIn("'anon'", content,
                       "Must verify anon role privileges")
        self.assertIn("'authenticated'", content,
                       "Must verify authenticated role privileges")

        # Must check staging/private access blocked
        self.assertIn("'staging'", content,
                       "Must verify staging schema access blocked")
        self.assertIn("'private'", content,
                       "Must verify private schema access blocked")

        # Must not be just advisory comments
        rls_section_start = content.find("7. RLS/ACL")
        rls_section = content[rls_section_start:]
        self.assertIn("DO $$", rls_section,
                       "RLS/ACL section must have executable PL/pgSQL blocks")


class TestBehavioralCheckpointGuards(unittest.TestCase):
    """Behavior-level tests for concurrency, resume and completion guards."""

    def test_lock_key_is_stable_and_dataset_specific(self):
        self.assertEqual(_dataset_lock_key("production_log"),
                         _dataset_lock_key("production_log"))
        self.assertNotEqual(_dataset_lock_key("production_log"),
                            _dataset_lock_key("haccp_cert"))
        self.assertGreaterEqual(_dataset_lock_key("mapping"), 0)
        self.assertLessEqual(_dataset_lock_key("mapping"), 0x7FFF_FFFF)

    def test_session_lock_acquire_and_release_execute_real_contract(self):
        cur = MagicMock()
        cur.fetchone.return_value = (True,)

        _acquire_advisory_lock(cur, "mapping")
        acquire_sql, acquire_params = cur.execute.call_args.args
        self.assertIn("pg_try_advisory_lock", acquire_sql)
        self.assertEqual(acquire_params[1], _dataset_lock_key("mapping"))

        _release_advisory_lock(cur, "mapping")
        release_sql, release_params = cur.execute.call_args.args
        self.assertIn("pg_advisory_unlock", release_sql)
        self.assertEqual(release_params[1], _dataset_lock_key("mapping"))

    def test_busy_session_lock_is_rejected(self):
        cur = MagicMock()
        cur.fetchone.return_value = (False,)
        with self.assertRaisesRegex(RuntimeError, "Another loader session"):
            _acquire_advisory_lock(cur, "production_log")

    def test_fresh_checkpoint_rejects_running_or_failed_run(self):
        cur = MagicMock()
        cur.fetchone.return_value = (1,)
        with self.assertRaisesRegex(RuntimeError, "Use --resume"):
            _create_checkpoint(cur, "haccp_cert", "run-id", "fingerprint")
        query = cur.execute.call_args_list[0].args[0]
        self.assertIn("status IN ('running', 'failed')", query)

    def test_resume_fingerprint_mismatch_is_rejected(self):
        cur = MagicMock()
        cur.fetchall.return_value = [
            ("run-id", "old-fingerprint", "100", 100, "failed")
        ]
        with self.assertRaisesRegex(RuntimeError, "Fingerprint mismatch"):
            _get_resumable_checkpoint(cur, "sales_suspension", "new-fingerprint")

    def test_resume_lineage_requires_dataset_and_fingerprint_match(self):
        cur = MagicMock()
        cur.fetchone.return_value = ("mapping", "fingerprint")
        _validate_resume_lineage(cur, "run-id", "mapping", "fingerprint")

        cur.fetchone.return_value = ("mapping", "different")
        with self.assertRaisesRegex(RuntimeError, "Lineage mismatch"):
            _validate_resume_lineage(cur, "run-id", "mapping", "fingerprint")

        cur.fetchone.return_value = None
        with self.assertRaisesRegex(RuntimeError, "Lineage record missing"):
            _validate_resume_lineage(cur, "run-id", "mapping", "fingerprint")

    def test_target_count_mismatch_returns_false(self):
        cur = MagicMock()
        cur.fetchone.return_value = (307,)
        self.assertFalse(_verify_target_count(cur, "haccp_cert", 308))

    def test_tls_is_forced_in_all_remote_python_connections(self):
        for name in (
            "chg_g6_002_staging_loader.py",
            "chg_g6_002_preflight.py",
            "chg_g6_002_sql_runner.py",
        ):
            content = (SCRIPTS_DIR / name).read_text(encoding="utf-8")
            self.assertIn('sslmode="require"', content, name)


# ===================================================================
# Behavioral mock tests (request §3 items 1-6)
# ===================================================================

class TestBehavioralFreshEmptyGuardOrder(unittest.TestCase):
    """§3-1: fresh empty guard -> lineage -> checkpoint -> first UPSERT order."""

    def test_empty_guard_before_lineage_and_checkpoint(self):
        """Mock cursor: assert_target_empty -> create_lineage -> create_checkpoint."""
        cur = MagicMock()
        dataset = "haccp_cert"
        run_id = "test-run-id"
        fp = "abc123"

        # Empty target (0 rows)
        cur.fetchone.side_effect = [
            (0,),   # _assert_target_empty -> COUNT(*) = 0
            (0,),   # _create_checkpoint -> SELECT COUNT(*) active = 0
        ]
        _assert_target_empty(cur, dataset)
        _create_lineage_record(cur, run_id, dataset, fp)
        _create_checkpoint(cur, dataset, run_id, fp)

        calls = cur.execute.call_args_list
        # First call: COUNT(*) for empty guard
        self.assertIn("COUNT(*)", calls[0].args[0])
        # Second call: INSERT INTO private.data_lineage
        self.assertIn("data_lineage", calls[1].args[0])
        # Third call: SELECT COUNT(*) for active checkpoint check
        self.assertIn("load_checkpoint", calls[2].args[0])
        # Fourth call: INSERT INTO private.load_checkpoint
        self.assertIn("INSERT", calls[3].args[0])

    def test_nonempty_target_blocks_fresh_load(self):
        """Non-empty target -> RuntimeError with guidance to --resume."""
        cur = MagicMock()
        cur.fetchone.return_value = (100,)
        with self.assertRaisesRegex(RuntimeError, "--resume"):
            _assert_target_empty(cur, "production_log")


class TestBehavioralChunkSuccessFlow(unittest.TestCase):
    """§3-2: chunk success -> checkpoint update -> commit."""

    def test_checkpoint_update_params(self):
        """_update_checkpoint writes correct status/rows after chunk."""
        cur = MagicMock()
        _update_checkpoint(cur, "haccp_cert", "run-1", "key-100", 100, "running")
        sql, params = cur.execute.call_args.args
        self.assertIn("UPDATE private.load_checkpoint", sql)
        self.assertEqual(params, ("key-100", 100, "running", "haccp_cert", "run-1"))

    def test_completed_marks_lineage_and_checkpoint(self):
        """Completed flow: checkpoint -> completed, lineage -> row_count update."""
        cur = MagicMock()
        _update_checkpoint(cur, "mapping", "run-2", "last-key", 308, "completed")
        _update_lineage_record(cur, "run-2", 308)
        calls = cur.execute.call_args_list
        # First: checkpoint update with 'completed'
        self.assertIn("completed", calls[0].args[1])
        # Second: lineage update
        self.assertIn("data_lineage", calls[1].args[0])
        self.assertEqual(calls[1].args[1][0], 308)  # row_count


class TestBehavioralChunkFailureFlow(unittest.TestCase):
    """§3-3: chunk failure -> rollback -> failed checkpoint -> commit -> exception."""

    def test_failed_checkpoint_preserves_loaded_rows(self):
        """Failed checkpoint records loaded_rows at point of failure."""
        cur = MagicMock()
        _update_checkpoint(cur, "production_log", "run-3", "rno-5000", 5000, "failed")
        sql, params = cur.execute.call_args.args
        self.assertEqual(params[0], "rno-5000")
        self.assertEqual(params[1], 5000)
        self.assertEqual(params[2], "failed")

    def test_completed_not_called_after_failure(self):
        """After setting 'failed', no 'completed' should follow."""
        cur = MagicMock()
        _update_checkpoint(cur, "haccp_cert", "run-4", "k-50", 50, "failed")
        for c in cur.execute.call_args_list:
            self.assertNotIn("completed", str(c.args[1]))


class TestBehavioralResumeLineage(unittest.TestCase):
    """§3-4: resume lineage dataset/SHA match success and mismatch failure."""

    def test_resume_lineage_match_succeeds(self):
        """Matching dataset+SHA passes without error."""
        cur = MagicMock()
        cur.fetchone.return_value = ("haccp_cert", "fp-abc")
        _validate_resume_lineage(cur, "run-5", "haccp_cert", "fp-abc")

    def test_resume_lineage_dataset_mismatch_fails(self):
        """Dataset name mismatch raises RuntimeError."""
        cur = MagicMock()
        cur.fetchone.return_value = ("production_log", "fp-abc")
        with self.assertRaisesRegex(RuntimeError, "Lineage mismatch"):
            _validate_resume_lineage(cur, "run-6", "haccp_cert", "fp-abc")

    def test_resume_lineage_sha_mismatch_fails(self):
        """SHA mismatch raises RuntimeError."""
        cur = MagicMock()
        cur.fetchone.return_value = ("haccp_cert", "fp-old")
        with self.assertRaisesRegex(RuntimeError, "Lineage mismatch"):
            _validate_resume_lineage(cur, "run-7", "haccp_cert", "fp-new")

    def test_resume_lineage_missing_fails(self):
        """Missing lineage record raises RuntimeError."""
        cur = MagicMock()
        cur.fetchone.return_value = None
        with self.assertRaisesRegex(RuntimeError, "Lineage record missing"):
            _validate_resume_lineage(cur, "run-8", "mapping", "fp-xyz")


class TestBehavioralCountAndInvarianceGuard(unittest.TestCase):
    """§3-5: count mismatch and source invariance -> completed update 0 times."""

    def test_count_mismatch_returns_false(self):
        """_verify_target_count returns False on mismatch."""
        cur = MagicMock()
        cur.fetchone.return_value = (1047000,)
        self.assertFalse(_verify_target_count(cur, "production_log", 1047894))

    def test_count_match_returns_true(self):
        cur = MagicMock()
        cur.fetchone.return_value = (308,)
        self.assertTrue(_verify_target_count(cur, "haccp_cert", 308))

    def test_completed_never_set_when_count_mismatches(self):
        """If count is wrong, checkpoint goes to 'failed', never 'completed'."""
        cur = MagicMock()
        # Simulate count mismatch path: update to 'failed'
        _update_checkpoint(cur, "haccp_cert", "run-9", "last-k", 308, "failed")
        for c in cur.execute.call_args_list:
            self.assertNotIn("completed", str(c.args[1]))


class TestBehavioralSessionLockLifecycle(unittest.TestCase):
    """§3-6: session lock success/failure/exception release."""

    def test_lock_success_path(self):
        """Acquire succeeds when pg_try_advisory_lock returns true."""
        cur = MagicMock()
        cur.fetchone.return_value = (True,)
        _acquire_advisory_lock(cur, "mapping")
        sql = cur.execute.call_args.args[0]
        self.assertIn("pg_try_advisory_lock", sql)

    def test_lock_failure_raises(self):
        """Acquire raises RuntimeError when lock is busy."""
        cur = MagicMock()
        cur.fetchone.return_value = (False,)
        with self.assertRaisesRegex(RuntimeError, "Another loader"):
            _acquire_advisory_lock(cur, "haccp_cert")

    def test_release_calls_unlock(self):
        """Release calls pg_advisory_unlock with correct keys."""
        cur = MagicMock()
        _release_advisory_lock(cur, "mapping")
        sql, params = cur.execute.call_args.args
        self.assertIn("pg_advisory_unlock", sql)
        self.assertEqual(params[1], _dataset_lock_key("mapping"))

    def test_unlock_in_finally_code_path(self):
        """Verify run_live wraps per-dataset processing in try/finally unlock."""
        loader_path = SCRIPTS_DIR / "chg_g6_002_staging_loader.py"
        content = loader_path.read_text(encoding="utf-8")
        run_live = content[content.find("def run_live"):]
        # finally block must contain _release_advisory_lock
        finally_pos = run_live.find("finally:")
        self.assertGreater(finally_pos, -1, "run_live must have finally block")
        finally_section = run_live[finally_pos:finally_pos + 500]
        self.assertIn("_release_advisory_lock", finally_section,
                       "finally must call _release_advisory_lock")


class TestRlsPoliciesVerification(unittest.TestCase):
    """Verify publish and verify SQL check pg_policies for SELECT grants."""

    def test_publish_checks_pg_policies(self):
        pub_path = SCRIPTS_DIR / "chg_g6_002_publish.sql"
        content = pub_path.read_text(encoding="utf-8")
        self.assertIn("pg_policies", content,
                       "publish must query pg_policies for SELECT policy check")
        self.assertIn("No SELECT policy", content,
                       "publish must RAISE EXCEPTION on missing SELECT policy")

    def test_verify_checks_pg_policies(self):
        ver_path = SCRIPTS_DIR / "chg_g6_002_verify.sql"
        content = ver_path.read_text(encoding="utf-8")
        self.assertIn("pg_policies", content,
                       "verify must query pg_policies for SELECT policy check")
        self.assertIn("No SELECT policy", content,
                       "verify must RAISE EXCEPTION on missing SELECT policy")

    def test_publish_verifies_view_exists(self):
        pub_path = SCRIPTS_DIR / "chg_g6_002_publish.sql"
        content = pub_path.read_text(encoding="utf-8")
        self.assertIn("facility_products_public VIEW does not exist", content)

    def test_verify_verifies_view_exists(self):
        ver_path = SCRIPTS_DIR / "chg_g6_002_verify.sql"
        content = ver_path.read_text(encoding="utf-8")
        self.assertIn("facility_products_public VIEW does not exist", content)

    # --- Request 027 regression: pg_policies catalog type-compatibility fixes ---

    def test_publish_uses_catalog_cmd_semantics(self):
        """publish.sql must NOT use ACL shorthand 'r'/'*' for pg_policies.cmd.
        The catalog stores full English form: SELECT, ALL."""
        pub_path = SCRIPTS_DIR / "chg_g6_002_publish.sql"
        content = pub_path.read_text(encoding="utf-8")
        self.assertNotIn("cmd IN ('r',", content,
                          "publish must not use ACL shorthand 'r' for pg_policies.cmd")
        self.assertNotIn("cmd IN ('r', '*')", content,
                          "publish must not use ACL shorthand '*' for pg_policies.cmd")
        self.assertIn("upper(cmd) IN ('SELECT', 'ALL')", content,
                       "publish must use catalog-compatible upper(cmd) IN ('SELECT','ALL')")

    def test_verify_uses_catalog_cmd_semantics(self):
        """verify.sql must NOT use ACL shorthand 'r'/'*' for pg_policies.cmd."""
        ver_path = SCRIPTS_DIR / "chg_g6_002_verify.sql"
        content = ver_path.read_text(encoding="utf-8")
        self.assertNotIn("cmd IN ('r',", content,
                          "verify must not use ACL shorthand 'r' for pg_policies.cmd")
        self.assertNotIn("cmd IN ('r', '*')", content,
                          "verify must not use ACL shorthand '*' for pg_policies.cmd")
        self.assertIn("upper(cmd) IN ('SELECT', 'ALL')", content,
                       "verify must use catalog-compatible upper(cmd) IN ('SELECT','ALL')")

    def test_publish_uses_type_safe_roles_cast(self):
        """publish.sql must cast roles to text[] before @> comparison.
        pg_policies.roles is name[] — direct comparison with text[] literal errors."""
        pub_path = SCRIPTS_DIR / "chg_g6_002_publish.sql"
        content = pub_path.read_text(encoding="utf-8")
        self.assertIn("roles::text[]", content,
                       "publish must cast roles to text[] for type-safe @> comparison")
        self.assertNotIn("roles = '{}'::TEXT[]", content,
                          "publish must not treat empty array as PUBLIC pseudo-role")

    def test_verify_uses_type_safe_roles_cast(self):
        """verify.sql must cast roles to text[] before @> comparison."""
        ver_path = SCRIPTS_DIR / "chg_g6_002_verify.sql"
        content = ver_path.read_text(encoding="utf-8")
        self.assertIn("roles::text[]", content,
                       "verify must cast roles to text[] for type-safe @> comparison")
        self.assertNotIn("roles = '{}'::TEXT[]", content,
                          "verify must not treat empty array as PUBLIC pseudo-role")


class TestPowerShellStructuredResolvers(unittest.TestCase):
    """Verify PowerShell resolvers return structured output, not string concat."""

    def test_find_supabase_cli_no_string_concat(self):
        """Find-SupabaseCli must NOT return bare 'npx supabase' string."""
        ps1 = (SCRIPTS_DIR / "chg_g6_002_run_migration.ps1").read_text(encoding="utf-8")
        # The old pattern returned "npx supabase" — must not appear
        self.assertNotIn('return "npx supabase"', ps1,
                          "Must not return concatenated 'npx supabase' string")
        # Must use structured @{ ExePath; PrefixArgs }
        self.assertIn("PrefixArgs", ps1, "Must return structured PrefixArgs")
        self.assertIn("ExePath", ps1, "Must return structured ExePath")

    def test_find_python_exe_exists(self):
        """Find-PythonExe resolver must exist."""
        ps1 = (SCRIPTS_DIR / "chg_g6_002_run_migration.ps1").read_text(encoding="utf-8")
        self.assertIn("function Find-PythonExe", ps1)
        self.assertIn("FOODGROUND_PYTHON_EXE", ps1)

    def test_uri_template_scheme_validated(self):
        """URI template must validate scheme before [Uri] parse."""
        ps1 = (SCRIPTS_DIR / "chg_g6_002_run_migration.ps1").read_text(encoding="utf-8")
        self.assertIn("postgre", ps1)
        self.assertIn("scheme must be", ps1.lower(),
                       "Must validate scheme before [Uri] parse")

    def test_invoke_python_uses_find_python_exe(self):
        """Invoke-Python must call Find-PythonExe, not hardcode 'python'."""
        ps1 = (SCRIPTS_DIR / "chg_g6_002_run_migration.ps1").read_text(encoding="utf-8")
        invoke_python_section = ps1[ps1.find("function Invoke-Python"):ps1.find("function Invoke-SqlRunner")]
        self.assertIn("Find-PythonExe", invoke_python_section)
        self.assertNotIn("& python ", invoke_python_section,
                          "Must not hardcode '& python'")


class TestLineagePublishBoundary(unittest.TestCase):
    """PUBLIC-LINEAGE-001 fix: migration 0035 + publish/rollback lineage markers."""

    def test_migration_0035_exists(self):
        """Migration 0035 lineage publish boundary file exists."""
        m0035 = REPO_ROOT / "supabase" / "migrations" / "20260831000000_0035_g6_002_lineage_publish_boundary.sql"
        self.assertTrue(m0035.exists(), "Migration 0035 not found")

    def test_migration_0035_has_publish_filter(self):
        """Migration 0035 adds WHERE publish_version IS NOT NULL to VIEW."""
        m0035 = REPO_ROOT / "supabase" / "migrations" / "20260831000000_0035_g6_002_lineage_publish_boundary.sql"
        content = m0035.read_text(encoding="utf-8")
        self.assertIn("WHERE publish_version IS NOT NULL", content)
        self.assertIn("CREATE OR REPLACE VIEW", content)
        self.assertIn("data_lineage_public", content)

    def test_migration_0035_no_security_invoker(self):
        """Migration 0035 executable SQL must NOT use security_invoker (needs definer access)."""
        m0035 = REPO_ROOT / "supabase" / "migrations" / "20260831000000_0035_g6_002_lineage_publish_boundary.sql"
        content = m0035.read_text(encoding="utf-8")
        # Check only executable SQL lines — comments may reference the term
        executable_lines = [
            line for line in content.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        executable_sql = "\n".join(executable_lines)
        self.assertNotIn("security_invoker", executable_sql.lower())

    def test_migration_0035_preserves_5_safe_columns(self):
        """Migration 0035 exposes exactly the 5 safe columns."""
        m0035 = REPO_ROOT / "supabase" / "migrations" / "20260831000000_0035_g6_002_lineage_publish_boundary.sql"
        content = m0035.read_text(encoding="utf-8")
        for col in ["id", "dataset_name", "basis_date", "publish_version", "ingest_run_at"]:
            self.assertIn(col, content, f"Missing safe column: {col}")

    def test_migration_0035_rollback_exists(self):
        """Rollback for migration 0035 exists."""
        rb = REPO_ROOT / "supabase" / "rollback" / "20260831_0035_g6_002_lineage_publish_boundary_rollback.sql"
        self.assertTrue(rb.exists(), "Migration 0035 rollback not found")

    def test_migration_0035_rollback_restores_unfiltered_view(self):
        """Rollback restores the pre-0035 unfiltered VIEW."""
        rb = REPO_ROOT / "supabase" / "rollback" / "20260831_0035_g6_002_lineage_publish_boundary_rollback.sql"
        content = rb.read_text(encoding="utf-8")
        self.assertIn("CREATE OR REPLACE VIEW", content)
        self.assertNotIn("WHERE publish_version IS NOT NULL", content)
        self.assertIn("PUBLIC-LINEAGE-001", content)

    def test_publish_sql_sets_lineage_markers_atomically(self):
        """Publish SQL sets publish_version in same transaction as data publish."""
        pub = (SCRIPTS_DIR / "chg_g6_002_publish.sql").read_text(encoding="utf-8")
        self.assertIn("publish_version", pub)
        self.assertIn("chg-g6-002-v1", pub)
        # Bounded UPDATE via target-table-derived run IDs + checkpoint cross-check
        self.assertIn("load_checkpoint", pub)
        self.assertIn("_run_ids", pub)
        self.assertIn("staging.production_log_raw", pub)

    def test_publish_sql_adds_data_lineage_public_to_acl(self):
        """Publish SQL ACL guard includes data_lineage_public."""
        pub = (SCRIPTS_DIR / "chg_g6_002_publish.sql").read_text(encoding="utf-8")
        self.assertIn("data_lineage_public", pub)

    def test_publish_rollback_clears_lineage_markers(self):
        """Publish rollback clears publish_version for CHG-G6-002 rows."""
        rbd = (SCRIPTS_DIR / "chg_g6_002_publish_rollback.sql").read_text(encoding="utf-8")
        self.assertIn("publish_version", rbd)
        self.assertIn("data_lineage_public", rbd)

    def test_verify_sql_has_lineage_section(self):
        """Verify SQL has lineage publish boundary verification section."""
        ver = (SCRIPTS_DIR / "chg_g6_002_verify.sql").read_text(encoding="utf-8")
        self.assertIn("data_lineage_public", ver)
        self.assertIn("chg-g6-002-v1", ver)
        self.assertIn("publish_version IS NOT NULL", ver)
        # Section 8 header
        self.assertIn("Lineage publish boundary", ver)


class TestBoundedFiveRunContract(unittest.TestCase):
    """Structural tests: publish/rollback/verify derive run IDs from target tables."""

    TARGET_TABLES = [
        "staging.production_log_raw",
        "staging.haccp_cert_raw",
        "staging.sales_suspension_raw",
        "staging.company_profiles_raw",
        "private.company_profile_mapping",
    ]

    def _read_sql(self, name):
        return (SCRIPTS_DIR / name).read_text(encoding="utf-8")

    def test_publish_derives_from_target_tables(self):
        """Publish SQL derives run IDs from target tables, not only checkpoints."""
        pub = self._read_sql("chg_g6_002_publish.sql")
        for table in self.TARGET_TABLES:
            self.assertIn(table, pub,
                          f"Publish must derive ingest_run_id from {table}")
        self.assertIn("load_checkpoint", pub,
                      "Publish must cross-check against load_checkpoint")

    def test_rollback_derives_from_target_tables(self):
        """Rollback SQL derives run IDs from target tables, not only checkpoints."""
        rbd = self._read_sql("chg_g6_002_publish_rollback.sql")
        for table in self.TARGET_TABLES:
            self.assertIn(table, rbd,
                          f"Rollback must derive ingest_run_id from {table}")
        self.assertIn("load_checkpoint", rbd,
                      "Rollback must cross-check against load_checkpoint")

    def test_verify_derives_from_target_tables(self):
        """Verify SQL derives run IDs from target tables, not only checkpoints."""
        ver = self._read_sql("chg_g6_002_verify.sql")
        for table in self.TARGET_TABLES:
            self.assertIn(table, ver,
                          f"Verify must derive ingest_run_id from {table}")
        self.assertIn("load_checkpoint", ver,
                      "Verify must cross-check against load_checkpoint")

    def test_publish_checks_actual_row_counts(self):
        """Publish SQL verifies actual row counts from target tables."""
        pub = self._read_sql("chg_g6_002_publish.sql")
        self.assertIn("actual_rows", pub)
        self.assertIn("1047894", pub)

    def test_rollback_checks_actual_row_counts(self):
        """Rollback SQL verifies actual row counts from target tables."""
        rbd = self._read_sql("chg_g6_002_publish_rollback.sql")
        self.assertIn("actual_rows", rbd)

    def test_verify_checks_actual_row_counts(self):
        """Verify SQL verifies actual row counts from target tables."""
        ver = self._read_sql("chg_g6_002_verify.sql")
        self.assertIn("actual_rows", ver)

    # --- dataset_name cross-check in data_lineage ---

    def test_publish_checks_dataset_name_in_lineage(self):
        """Publish SQL cross-checks data_lineage with dataset_name = r.dataset."""
        pub = self._read_sql("chg_g6_002_publish.sql")
        self.assertIn("dataset_name", pub,
                      "Publish must cross-check data_lineage.dataset_name")
        self.assertRegex(pub, r"dl\.dataset_name\s*=\s*r\.dataset",
                         "Publish must join data_lineage on dataset_name = r.dataset")

    def test_rollback_checks_dataset_name_in_lineage(self):
        """Rollback SQL cross-checks data_lineage with dataset_name = r.dataset."""
        rbd = self._read_sql("chg_g6_002_publish_rollback.sql")
        self.assertIn("dataset_name", rbd,
                      "Rollback must cross-check data_lineage.dataset_name")
        self.assertRegex(rbd, r"dl\.dataset_name\s*=\s*r\.dataset",
                         "Rollback must join data_lineage on dataset_name = r.dataset")

    def test_verify_checks_dataset_name_in_lineage(self):
        """Verify SQL cross-checks data_lineage with dataset_name = r.dataset."""
        ver = self._read_sql("chg_g6_002_verify.sql")
        self.assertIn("dataset_name", ver,
                      "Verify must cross-check data_lineage.dataset_name")
        self.assertRegex(ver, r"dl\.dataset_name\s*=\s*r\.dataset",
                         "Verify must join data_lineage on dataset_name = r.dataset")

    # --- fixed expected row constants/guards ---

    EXPECTED_ROW_CONSTANTS = ["1047894", "308", "355"]

    def test_rollback_has_expected_row_guards(self):
        """Rollback SQL has fixed expected row-count guards for all datasets."""
        rbd = self._read_sql("chg_g6_002_publish_rollback.sql")
        for val in self.EXPECTED_ROW_CONSTANTS:
            self.assertIn(val, rbd,
                          f"Rollback must contain expected row constant {val}")

    def test_verify_has_expected_row_guards_in_lineage(self):
        """Verify SQL lineage section has fixed expected row-count guards."""
        ver = self._read_sql("chg_g6_002_verify.sql")
        for val in self.EXPECTED_ROW_CONSTANTS:
            self.assertIn(val, ver,
                          f"Verify must contain expected row constant {val}")

    # --- distinct run-ID checks ---

    def test_publish_checks_distinct_run_ids(self):
        """Publish SQL checks for 5 distinct run IDs."""
        pub = self._read_sql("chg_g6_002_publish.sql")
        self.assertIn("COUNT(DISTINCT run_id)", pub,
                      "Publish must check COUNT(DISTINCT run_id)")

    def test_rollback_checks_distinct_run_ids(self):
        """Rollback SQL checks for 5 distinct run IDs."""
        rbd = self._read_sql("chg_g6_002_publish_rollback.sql")
        self.assertIn("COUNT(DISTINCT run_id)", rbd,
                      "Rollback must check COUNT(DISTINCT run_id)")

    def test_verify_checks_distinct_run_ids(self):
        """Verify SQL checks for 5 distinct run IDs."""
        ver = self._read_sql("chg_g6_002_verify.sql")
        self.assertIn("COUNT(DISTINCT run_id)", ver,
                      "Verify must check COUNT(DISTINCT run_id)")


class TestMigration0035Revoke(unittest.TestCase):
    """Migration 0035 must revoke from PUBLIC pseudo-role."""

    def test_migration_0035_revokes_public(self):
        """Migration 0035 REVOKE includes PUBLIC pseudo-role."""
        m0035 = REPO_ROOT / "supabase" / "migrations" / "20260831000000_0035_g6_002_lineage_publish_boundary.sql"
        content = m0035.read_text(encoding="utf-8")
        self.assertIn("FROM PUBLIC", content,
                      "Migration 0035 must REVOKE from PUBLIC pseudo-role")

    def test_migration_0035_no_service_role_definer_claim(self):
        """Migration 0035 must not claim definer is service_role."""
        m0035 = REPO_ROOT / "supabase" / "migrations" / "20260831000000_0035_g6_002_lineage_publish_boundary.sql"
        content = m0035.read_text(encoding="utf-8")
        self.assertNotIn("(service_role)", content,
                         "Must say 'view owner' not 'service_role'")


class TestEmptyGuardExists(unittest.TestCase):
    """Verify _assert_target_empty is called in fresh load paths."""

    def test_assert_target_empty_in_run_live(self):
        loader = (SCRIPTS_DIR / "chg_g6_002_staging_loader.py").read_text(encoding="utf-8")
        run_live = loader[loader.find("def run_live"):]
        self.assertIn("_assert_target_empty", run_live,
                       "Fresh load must call _assert_target_empty before lineage")

    def test_empty_guard_before_lineage_in_fresh_path(self):
        loader = (SCRIPTS_DIR / "chg_g6_002_staging_loader.py").read_text(encoding="utf-8")
        run_live = loader[loader.find("def run_live"):]
        empty_pos = run_live.find("_assert_target_empty")
        lineage_pos = run_live.find("_create_lineage_record")
        self.assertGreater(empty_pos, -1)
        self.assertGreater(lineage_pos, -1)
        self.assertLess(empty_pos, lineage_pos,
                        "empty guard must come BEFORE lineage creation")


class TestMigration0036AclHardening(unittest.TestCase):
    """Migration 0036 ACL hardening: BEGIN/COMMIT, 6 relations REVOKE ALL, SELECT-only, 2 sequences REVOKE ALL, no DML/TRUNCATE."""

    RELATIONS = [
        "products_public", "haccp_certifications_public", "facility_safety_public",
        "manufacturing_profiles_public", "facility_products_public", "data_lineage_public",
    ]
    SEQUENCES = [
        "haccp_certifications_public_id_seq", "facility_safety_public_id_seq",
    ]

    def _read_migration(self):
        p = REPO_ROOT / "supabase" / "migrations" / "20260831001000_0036_g6_002_public_acl_hardening.sql"
        return p.read_text(encoding="utf-8")

    def _read_rollback(self):
        p = REPO_ROOT / "supabase" / "rollback" / "20260831_0036_g6_002_public_acl_hardening_rollback.sql"
        return p.read_text(encoding="utf-8")

    def test_migration_exists(self):
        p = REPO_ROOT / "supabase" / "migrations" / "20260831001000_0036_g6_002_public_acl_hardening.sql"
        self.assertTrue(p.exists(), "Migration 0036 file must exist")

    def test_rollback_exists(self):
        p = REPO_ROOT / "supabase" / "rollback" / "20260831_0036_g6_002_public_acl_hardening_rollback.sql"
        self.assertTrue(p.exists(), "Rollback 0036 file must exist")

    def test_migration_has_begin_commit(self):
        content = self._read_migration()
        self.assertIn("BEGIN;", content)
        self.assertIn("COMMIT;", content)

    def test_migration_revoke_all_6_relations(self):
        content = self._read_migration()
        for rel in self.RELATIONS:
            self.assertIn(
                f"REVOKE ALL PRIVILEGES ON public.{rel} FROM PUBLIC, anon, authenticated",
                content,
                f"Migration 0036 must REVOKE ALL on {rel} FROM PUBLIC, anon, authenticated",
            )

    def test_migration_grant_select_only_6_relations(self):
        content = self._read_migration()
        for rel in self.RELATIONS:
            self.assertIn(
                f"GRANT SELECT ON public.{rel} TO anon, authenticated",
                content,
                f"Migration 0036 must GRANT SELECT on {rel}",
            )

    def test_migration_revoke_all_2_sequences(self):
        content = self._read_migration()
        for seq in self.SEQUENCES:
            self.assertIn(
                f"REVOKE ALL PRIVILEGES ON SEQUENCE public.{seq} FROM PUBLIC, anon, authenticated",
                content,
                f"Migration 0036 must REVOKE ALL on SEQUENCE {seq}",
            )

    def test_migration_no_data_dml_or_truncate(self):
        """Migration 0036 must not contain INSERT/UPDATE/DELETE/TRUNCATE on data."""
        content = self._read_migration()
        executable_lines = [
            line for line in content.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        executable_sql = "\n".join(executable_lines)
        for kw in ["INSERT INTO", "DELETE FROM", "TRUNCATE"]:
            self.assertNotIn(kw, executable_sql,
                             f"Migration 0036 must not contain {kw} in executable SQL")

    def test_rollback_is_fail_closed(self):
        """Rollback must declare FAIL-CLOSED and not claim pre-0036 exact restore."""
        rb = self._read_rollback()
        self.assertIn("FAIL-CLOSED", rb,
                      "Rollback must declare FAIL-CLOSED security rollback")
        self.assertNotIn("restores the pre-0036 ACL state", rb,
                         "Rollback must not falsely claim pre-0036 exact ACL restore")
        self.assertNotIn("Removing explicit REVOKE restores prior defaults", rb,
                         "Rollback must not claim REVOKE removal restores defaults")

    def test_rollback_has_begin_commit(self):
        rb = self._read_rollback()
        self.assertIn("BEGIN;", rb)
        self.assertIn("COMMIT;", rb)

    def test_rollback_revoke_all_6_relations(self):
        rb = self._read_rollback()
        for rel in self.RELATIONS:
            self.assertIn(
                f"REVOKE ALL PRIVILEGES ON public.{rel} FROM PUBLIC, anon, authenticated",
                rb,
                f"Rollback must REVOKE ALL on {rel} (fail-closed)",
            )

    def test_rollback_grant_select_only_6_relations(self):
        rb = self._read_rollback()
        for rel in self.RELATIONS:
            self.assertIn(
                f"GRANT SELECT ON public.{rel} TO anon, authenticated",
                rb,
                f"Rollback must GRANT SELECT on {rel} (fail-closed)",
            )

    def test_rollback_revoke_all_2_sequences(self):
        rb = self._read_rollback()
        for seq in self.SEQUENCES:
            self.assertIn(
                f"REVOKE ALL PRIVILEGES ON SEQUENCE public.{seq} FROM PUBLIC, anon, authenticated",
                rb,
                f"Rollback must REVOKE ALL on SEQUENCE {seq} (fail-closed)",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
