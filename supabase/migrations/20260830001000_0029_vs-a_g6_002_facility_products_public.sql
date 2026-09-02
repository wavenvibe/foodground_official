-- CHG-G6-002 VS-F Migration 0029: facility_products_public (VIEW)
-- Source: products_public WHERE facility_mgt_no IS NOT NULL
-- Expected rows via VIEW: 815,989 (facility-linked rows only)
-- Depends on: 0028_vs-a_g6_002_public_products
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Facility-keyed product VIEW for co-manufacturing search.
--   Only rows with a confirmed facility link are visible.
--   Enables: "this facility manufactures these product types".
--
-- Design decision (VS-F, user-approved Choice C):
--   This is a VIEW over products_public, NOT a separate table.
--   The idx_products_public_facility partial index on products_public
--   already covers facility_mgt_no IS NOT NULL queries.
--   No data duplication — 815,989 rows are served by the VIEW without
--   doubling storage.
--
-- Security:
--   security_invoker=true (PostgreSQL 15+): the VIEW executes with
--   the privileges of the calling role, so RLS on products_public
--   is evaluated per-caller. anon/authenticated get SELECT only.

-- ============================================================
-- 0. Prerequisites guard
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products_public'
  ) THEN
    RAISE EXCEPTION 'public.products_public must exist (run 0028 first)';
  END IF;
END $$;

-- ============================================================
-- 1. public.facility_products_public (VIEW, not TABLE)
-- ============================================================
CREATE OR REPLACE VIEW public.facility_products_public
  WITH (security_invoker = true)
AS
  SELECT
    report_no,
    product_name,
    category,
    maker_name,
    ingredients,
    shelf_life_days,
    facility_mgt_no,
    reported_at,
    updated_at,
    created_at
  FROM public.products_public
  WHERE facility_mgt_no IS NOT NULL;

-- ============================================================
-- 2. Grants — SELECT only for anon/authenticated
-- ============================================================
GRANT SELECT ON public.facility_products_public TO anon, authenticated;

COMMENT ON VIEW public.facility_products_public IS
  'CHG-G6-002 VS-F: VIEW over products_public WHERE facility_mgt_no IS NOT NULL. '
  'Expected 815,989 rows. Uses idx_products_public_facility partial index. '
  'security_invoker=true — RLS on products_public is enforced per caller. '
  'No data duplication; only SELECT is GRANTed to anon/authenticated.';
