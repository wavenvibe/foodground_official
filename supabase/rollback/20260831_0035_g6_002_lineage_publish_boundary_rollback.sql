-- CHG-G6-002 VS-H Rollback for Migration 0035: lineage publish boundary
-- Restores the pre-0035 unfiltered data_lineage_public VIEW.
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
--
-- WARNING: This is a SCHEMA rollback only. It reopens the old visibility
-- behavior where ALL lineage rows (including those with publish_version
-- IS NULL) are visible through the public VIEW. This is the
-- PUBLIC-LINEAGE-001 defect that 0035 fixed.
--
-- This rollback does NOT touch lineage rows — it only reverts the VIEW
-- definition. It is structurally separate from the data rollback in
-- chg_g6_002_publish_rollback.sql. Do not use this as a data rollback.

BEGIN;

-- ============================================================
-- 1. Restore unfiltered VIEW (same five columns as 0020)
-- ============================================================
CREATE OR REPLACE VIEW public.data_lineage_public AS
  SELECT id, dataset_name, basis_date, publish_version, ingest_run_at
  FROM private.data_lineage;

-- ============================================================
-- 2. Restore SELECT grants
-- ============================================================
GRANT SELECT ON public.data_lineage_public TO anon, authenticated;

COMMENT ON VIEW public.data_lineage_public IS
  'Rolled back from 0035 to pre-0035 unfiltered VIEW. '
  'WARNING: This re-exposes rows with publish_version IS NULL (PUBLIC-LINEAGE-001).';

COMMIT;
