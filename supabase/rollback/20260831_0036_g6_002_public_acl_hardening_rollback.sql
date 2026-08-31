-- CHG-G6-002 Migration 0036 Rollback: Public ACL Hardening Rollback
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
--
-- FAIL-CLOSED SECURITY ROLLBACK
-- ==============================
-- This rollback does NOT attempt to restore the pre-0036 ACL state exactly.
-- Pre-0036, Supabase default grants left TRUNCATE, REFERENCES, TRIGGER on
-- the PUBLIC pseudo-role for tables created in 0028/0030/0031/0032. Restoring
-- those insecure defaults would re-open the Approval C ACL defect.
--
-- Instead, this rollback preserves a safe SELECT-only ACL state:
--   - REVOKE ALL from PUBLIC, anon, authenticated on all 6 relations
--   - Re-GRANT SELECT only to anon, authenticated
--   - REVOKE ALL on both sequences
-- This is identical to the 0036 forward state. Running this rollback SQL
-- re-confirms the fail-closed ACL but does NOT alter Supabase migration
-- history. Migration-history repair is outside this rollback scope and
-- requires a separately approved migration-repair workflow.
-- If the pre-0036 insecure defaults are truly needed, they must be restored
-- manually with explicit justification.
--
-- Data: NO rows are modified. Only privilege grants are changed.
-- RLS/policies: NOT modified — remain as set by 0028-0035.

BEGIN;

-- ============================================================
-- 1. Tables: REVOKE ALL then GRANT SELECT only (fail-closed)
-- ============================================================

-- 1a. products_public
REVOKE ALL PRIVILEGES ON public.products_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- 1b. haccp_certifications_public
REVOKE ALL PRIVILEGES ON public.haccp_certifications_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.haccp_certifications_public TO anon, authenticated;

-- 1c. facility_safety_public
REVOKE ALL PRIVILEGES ON public.facility_safety_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.facility_safety_public TO anon, authenticated;

-- 1d. manufacturing_profiles_public
REVOKE ALL PRIVILEGES ON public.manufacturing_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.manufacturing_profiles_public TO anon, authenticated;

-- ============================================================
-- 2. Views: REVOKE ALL then GRANT SELECT only (fail-closed)
-- ============================================================

-- 2a. facility_products_public (VIEW)
REVOKE ALL PRIVILEGES ON public.facility_products_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.facility_products_public TO anon, authenticated;

-- 2b. data_lineage_public (VIEW)
REVOKE ALL PRIVILEGES ON public.data_lineage_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.data_lineage_public TO anon, authenticated;

-- ============================================================
-- 3. Sequences: REVOKE all privileges (fail-closed)
-- ============================================================

-- 3a. haccp_certifications_public_id_seq
REVOKE ALL PRIVILEGES ON SEQUENCE public.haccp_certifications_public_id_seq FROM PUBLIC, anon, authenticated;

-- 3b. facility_safety_public_id_seq
REVOKE ALL PRIVILEGES ON SEQUENCE public.facility_safety_public_id_seq FROM PUBLIC, anon, authenticated;

COMMIT;
