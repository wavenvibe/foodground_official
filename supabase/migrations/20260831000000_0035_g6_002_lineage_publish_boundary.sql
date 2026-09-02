-- CHG-G6-002 VS-H Migration 0035: Lineage publish boundary
-- Fixes PUBLIC-LINEAGE-001: unpublished lineage rows were visible
-- through public.data_lineage_public because the VIEW lacked a
-- publish_version filter.
--
-- This migration replaces the VIEW with one that exposes only rows
-- where publish_version IS NOT NULL, ensuring that CHG-G6-002 staging
-- lineage rows (publish_version IS NULL) are invisible to anon until
-- the publish transaction atomically sets their publish_version.
--
-- No data mutation. Same five safe columns as migration 0020.
-- Definer semantics are intentionally preserved so the VIEW can
-- read private.data_lineage on behalf of anon/authenticated.
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.

-- ============================================================
-- 1. Replace VIEW with publish_version IS NOT NULL filter
-- ============================================================
-- The VIEW reads private.data_lineage, which anon/authenticated
-- cannot access directly (private schema USAGE revoked in 0020).
-- Definer semantics are intentionally preserved: the VIEW runs as
-- the view owner to read private.data_lineage and expose only the
-- five safe columns to anon/authenticated.
CREATE OR REPLACE VIEW public.data_lineage_public AS
  SELECT id, dataset_name, basis_date, publish_version, ingest_run_at
  FROM private.data_lineage
  WHERE publish_version IS NOT NULL;

-- ============================================================
-- 2. Explicit REVOKE then GRANT SELECT — no write privileges
-- ============================================================
-- Revoke from PUBLIC pseudo-role as well as named roles to prevent
-- inherited grants from bypassing the restriction.
REVOKE ALL ON public.data_lineage_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.data_lineage_public TO anon, authenticated;

COMMENT ON VIEW public.data_lineage_public IS
  'CHG-G6-002 VS-H: Public lineage view filtered by publish_version IS NOT NULL. '
  'Fixes PUBLIC-LINEAGE-001 — unpublished staging lineage rows are no longer visible. '
  'Same five safe columns as 0020; definer semantics preserved (reads private.data_lineage).';
