-- CHG-G6-002 VS-A/VS-F Rollback: removes objects created by migrations 0028–0034
-- APPLIES ONLY to objects created in this slice (0028–0034).
-- Does NOT touch pre-existing tables (facilities, recipes, etc.).
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Execute in reverse dependency order.
-- NOTE: facility_products_public is a VIEW (VS-F Choice C), not a TABLE.

BEGIN;

-- ============================================================
-- 1. private schema — VS-F checkpoint (0034, reverse order)
-- ============================================================

-- 0034: private.load_checkpoint
DROP TABLE IF EXISTS private.load_checkpoint;

-- ============================================================
-- 2. public schema — VS-A objects (reverse order)
-- ============================================================

-- 0032: manufacturing_profiles_public
DROP TABLE IF EXISTS public.manufacturing_profiles_public;

-- 0031: facility_safety_public
DROP TABLE IF EXISTS public.facility_safety_public;

-- 0030: haccp_certifications_public
DROP TABLE IF EXISTS public.haccp_certifications_public;

-- 0029: facility_products_public (VIEW, not TABLE)
DROP VIEW IF EXISTS public.facility_products_public;

-- 0028: products_public
DROP TABLE IF EXISTS public.products_public;

-- ============================================================
-- 3. private schema — VS-A tables
-- ============================================================

-- 0033: private.company_profile_mapping
DROP TABLE IF EXISTS private.company_profile_mapping;

-- ============================================================
-- 4. staging schema — VS-A tables
-- ============================================================

-- 0033: staging tables
DROP TABLE IF EXISTS staging.company_profiles_raw;
DROP TABLE IF EXISTS staging.production_log_raw;
DROP TABLE IF EXISTS staging.sales_suspension_raw;
DROP TABLE IF EXISTS staging.haccp_cert_raw;

-- Note: schemas (private, staging) are NOT dropped here.
-- They may contain other tables from other migrations.
-- If schemas are empty and should be removed, do so manually after verifying.

-- ============================================================
-- 5. Verify rollback completeness (advisory check)
-- ============================================================
DO $$
DECLARE
  remaining_tables INT;
  remaining_views INT;
BEGIN
  SELECT COUNT(*) INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema IN ('public', 'private', 'staging')
    AND table_type = 'BASE TABLE'
    AND table_name IN (
      'products_public',
      'haccp_certifications_public', 'facility_safety_public',
      'manufacturing_profiles_public', 'company_profile_mapping',
      'haccp_cert_raw', 'sales_suspension_raw', 'production_log_raw',
      'company_profiles_raw', 'load_checkpoint'
    );

  SELECT COUNT(*) INTO remaining_views
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name = 'facility_products_public';

  IF remaining_tables > 0 OR remaining_views > 0 THEN
    RAISE WARNING 'Rollback incomplete: % table(s) and % view(s) still exist',
                  remaining_tables, remaining_views;
  ELSE
    RAISE NOTICE 'Rollback complete: all VS-A/VS-F objects removed';
  END IF;
END $$;

COMMIT;
