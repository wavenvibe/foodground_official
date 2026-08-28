-- VS-2 Migration 0020: Private schema + staging schema + data_lineage
-- Target project: glczrbadvfgmblmkpgfj (Mumbai / ap-south-1)
-- Gate: CHG-G4-002 G3-07
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- Applies:
--   1. private schema (hidden from PostgREST Data API)
--   2. private.data_lineage (internal lineage / ingest run registry)
--   3. public.data_lineage_public VIEW (basis_date + publish_version only)
--   4. staging schema (ingest staging tables — NOT exposed via PostgREST)
--
-- Rollback: see supabase/rollback/vs2_rollback.sql

-- ============================================================
-- 1. private schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;

-- Supabase anon / authenticated must NOT access private schema.
-- service-role (used only for migration + ingest) retains default superuser access.
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- ============================================================
-- 2. staging schema
-- ============================================================
-- All ingest staging tables live here. PostgREST does NOT expose
-- non-public schemas, so staging data is never accessible via the Data API.
CREATE SCHEMA IF NOT EXISTS staging;

REVOKE ALL ON SCHEMA staging FROM anon, authenticated;

COMMENT ON SCHEMA staging IS
  'Ingest staging schema. Not exposed via PostgREST. Truncate/reload per run.';

-- ============================================================
-- 3. private.data_lineage
-- ============================================================
-- Stores one row per ingest run / dataset load.
-- Referenced by public tables via ingest_run_id UUID FK.
-- source_path and reject_count are internal only; never exposed via public API.
CREATE TABLE IF NOT EXISTS private.data_lineage (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name    TEXT        NOT NULL,   -- 'facilities', 'substitute_pairs', etc.
  source_path     TEXT,                   -- path under final_output/ (internal only)
  source_sha256   TEXT,                   -- SHA-256 of source file at ingest time
  row_count       INTEGER,
  reject_count    INTEGER     DEFAULT 0,
  basis_date      DATE,                   -- data as-of date (shown to public)
  rule_version    TEXT,                   -- analysis pipeline version tag
  ingest_run_at   TIMESTAMPTZ DEFAULT now(),
  publish_version TEXT                    -- semantic version label for this publish run
);

COMMENT ON TABLE private.data_lineage IS
  'Internal ingest run registry. Not exposed via PostgREST. B-06, B-08.';
COMMENT ON COLUMN private.data_lineage.source_path IS
  'Internal path — must not appear in public errors or API responses.';

-- ============================================================
-- 4. public.data_lineage_public VIEW
-- ============================================================
-- Exposes only the fields that are safe for anonymous browser access.
-- Omits source_path, source_sha256, reject_count, rule_version.
CREATE OR REPLACE VIEW public.data_lineage_public AS
  SELECT id, dataset_name, basis_date, publish_version, ingest_run_at
  FROM private.data_lineage;

GRANT SELECT ON public.data_lineage_public TO anon, authenticated;

-- ============================================================
-- Verification queries (run locally before submitting to remote)
-- ============================================================
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('private','staging');
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='private' AND table_name='data_lineage';
-- SELECT has_schema_privilege('anon', 'private', 'USAGE');  -- must be false
-- SELECT has_schema_privilege('anon', 'staging', 'USAGE');  -- must be false
