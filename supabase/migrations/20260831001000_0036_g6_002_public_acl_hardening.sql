-- CHG-G6-002 Migration 0036: Public ACL Hardening
-- Fixes Approval C ACL defect: migrations 0028/0030/0031/0032 only revoked
-- INSERT/UPDATE/DELETE, leaving Supabase default grants for TRUNCATE,
-- REFERENCES, TRIGGER on PUBLIC/anon/authenticated.
--
-- This migration explicitly REVOKE ALL PRIVILEGES then re-GRANT SELECT only
-- for all 6 G6 public relations (5 tables/views + data_lineage_public).
-- Also revokes sequence privileges on BIGSERIAL sequences.
--
-- No data mutation (no INSERT/UPDATE/DELETE/TRUNCATE on data rows).
-- No RLS/policy changes. Idempotent.
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.

BEGIN;

-- ============================================================
-- 1. Tables: REVOKE ALL then GRANT SELECT only
-- ============================================================

-- 1a. products_public (0028)
REVOKE ALL PRIVILEGES ON public.products_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- 1b. haccp_certifications_public (0030)
REVOKE ALL PRIVILEGES ON public.haccp_certifications_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.haccp_certifications_public TO anon, authenticated;

-- 1c. facility_safety_public (0031)
REVOKE ALL PRIVILEGES ON public.facility_safety_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.facility_safety_public TO anon, authenticated;

-- 1d. manufacturing_profiles_public (0032)
REVOKE ALL PRIVILEGES ON public.manufacturing_profiles_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.manufacturing_profiles_public TO anon, authenticated;

-- ============================================================
-- 2. Views: REVOKE ALL then GRANT SELECT only
-- ============================================================

-- 2a. facility_products_public (0029, VIEW)
REVOKE ALL PRIVILEGES ON public.facility_products_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.facility_products_public TO anon, authenticated;

-- 2b. data_lineage_public (0035, VIEW — already hardened in 0035, repeated for completeness)
REVOKE ALL PRIVILEGES ON public.data_lineage_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.data_lineage_public TO anon, authenticated;

-- ============================================================
-- 3. Sequences: REVOKE all privileges
--    BIGSERIAL columns auto-create sequences; anon/authenticated must not
--    call nextval(), setval(), or currval() on them.
-- ============================================================

-- 3a. haccp_certifications_public_id_seq (from 0030 BIGSERIAL id)
REVOKE ALL PRIVILEGES ON SEQUENCE public.haccp_certifications_public_id_seq FROM PUBLIC, anon, authenticated;

-- 3b. facility_safety_public_id_seq (from 0031 BIGSERIAL id)
REVOKE ALL PRIVILEGES ON SEQUENCE public.facility_safety_public_id_seq FROM PUBLIC, anon, authenticated;

COMMIT;
