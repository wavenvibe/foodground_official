-- CHG-G6-002 VS-F Migration 0034: private.load_checkpoint
-- Checkpoint table for idempotent, resumable staging data load.
-- Depends on: 0033 (private schema exists)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Tracks per-dataset ingest progress so that a 1M+ row load can be
--   interrupted and resumed without re-processing already-loaded rows.
--   source_fingerprint (SHA-256 of source file) prevents resuming
--   against a changed source.
--
-- Security:
--   private schema — no anon/authenticated access.
--   service_role only (bypasses RLS by default).

-- ============================================================
-- 0. Schema guard
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'private'
  ) THEN
    CREATE SCHEMA private;
  END IF;
END $$;

-- ============================================================
-- 1. private.load_checkpoint
-- ============================================================
CREATE TABLE IF NOT EXISTS private.load_checkpoint (
  dataset           TEXT        NOT NULL,
  ingest_run_id     UUID        NOT NULL DEFAULT gen_random_uuid(),
  source_fingerprint TEXT       NOT NULL,
  last_source_key   TEXT,                       -- report_no or id or company_id
  loaded_rows       BIGINT      NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset, ingest_run_id)
);

CREATE INDEX IF NOT EXISTS idx_load_checkpoint_dataset_status
  ON private.load_checkpoint (dataset, status);

-- Defense in depth: at most one resumable run (running or failed) per dataset.
CREATE UNIQUE INDEX IF NOT EXISTS uq_load_checkpoint_resumable_dataset
  ON private.load_checkpoint (dataset)
  WHERE status IN ('running', 'failed');

-- ============================================================
-- 2. Access control — NO public access
-- ============================================================
REVOKE ALL ON private.load_checkpoint FROM anon, authenticated, PUBLIC;

COMMENT ON TABLE private.load_checkpoint IS
  'CHG-G6-002 VS-F: Per-dataset ingest checkpoint for resumable staging load. '
  'source_fingerprint prevents resume against a changed source file. '
  'A stable session advisory lock serializes each dataset load across chunk commits. '
  'Access: service_role only.';
