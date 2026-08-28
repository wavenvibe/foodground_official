-- VS-2 Migration 0025b: facilities anon SELECT restricted to approved columns only
-- Depends on: 0010 (table creation), 0025 (column additions + rename biz_type→business_type)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- Problem: Codex prototype 0010 creates public.facilities with non-approved columns
--   road_addr, suspension_count, coord_x, coord_y, updated_at, source_snapshot_id
--   that are not in the approved public field list (§3.4 + B-06).
--   Both 0010 and 0025 used table-level GRANT SELECT, exposing all columns to anon.
--
-- Fix: Revoke table-level SELECT and re-grant column-level SELECT on approved columns only.
--   Non-approved columns remain on the table for internal use but are invisible to anon/authenticated.
--
-- Approved columns (§3.4 co-manufacturing public read):
--   mgt_no, name, region_sido, region_sigungu, business_type,
--   is_haccp, status, tel, homepage, created_at, ingest_run_id

-- Step 1: Revoke table-level SELECT (overrides grants from 0010 and 0025)
REVOKE SELECT ON public.facilities FROM anon, authenticated;

-- Step 2: Grant column-level SELECT on approved columns only
GRANT SELECT (
  mgt_no,
  name,
  region_sido,
  region_sigungu,
  business_type,
  is_haccp,
  status,
  tel,
  homepage,
  created_at,
  ingest_run_id
) ON public.facilities TO anon, authenticated;

-- ============================================================
-- Verification
-- ============================================================
-- After applying, run:
-- SELECT column_name
-- FROM information_schema.column_privileges
-- WHERE table_schema = 'public' AND table_name = 'facilities'
--   AND grantee IN ('anon', 'authenticated')
--   AND privilege_type = 'SELECT'
-- ORDER BY column_name;
--
-- Expected: mgt_no, name, region_sido, region_sigungu, business_type,
--           is_haccp, status, tel, homepage, created_at, ingest_run_id
-- NOT present: road_addr, suspension_count, coord_x, coord_y, updated_at, source_snapshot_id
