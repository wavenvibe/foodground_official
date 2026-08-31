-- CHG-G6-002 VS-F — Publish Data Rollback
-- Removes published DATA from public tables without dropping the tables.
-- Staging and private data are preserved for re-publish.
-- Use this when publish data is wrong but schema (migrations) is correct.
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
--
-- For full schema rollback (drop tables+views), use:
--   supabase/rollback/20260830_0028_0033_vs-a_g6_002_rollback.sql
--
-- This script is DISTINCT from the schema rollback:
--   - Schema rollback: DROP TABLE/VIEW (removes DDL objects)
--   - Data rollback:   TRUNCATE (removes data, keeps DDL objects)

BEGIN;

-- ============================================================
-- 1. Truncate public tables (reverse dependency order)
-- ============================================================

-- manufacturing_profiles_public depends on facilities (FK)
TRUNCATE public.manufacturing_profiles_public;

-- facility_safety_public depends on facilities (FK)
TRUNCATE public.facility_safety_public;

-- haccp_certifications_public depends on facilities (FK)
TRUNCATE public.haccp_certifications_public;

-- products_public — facility_products_public VIEW auto-empties
TRUNCATE public.products_public;

-- ============================================================
-- 2. Clear CHG-G6-002 lineage publish markers
-- ============================================================
-- Derive run IDs from the five target tables' actual contents and
-- cross-check against checkpoints. Set publish_version = NULL only for
-- these five rows, making them invisible through data_lineage_public
-- (filtered by publish_version IS NOT NULL per migration 0035).
-- Existing VS-2 lineage is preserved.
DO $$
DECLARE
  _run_ids UUID[];
  _cleared INT;
  _still_visible INT;
BEGIN
  -- Derive run IDs from target tables' actual ingest_run_id values
  CREATE TEMP TABLE _chg_g6_rollback_runs (
    dataset TEXT PRIMARY KEY,
    run_id UUID NOT NULL,
    actual_rows BIGINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _chg_g6_rollback_runs (dataset, run_id, actual_rows) VALUES
    ('production_log',
     (SELECT DISTINCT ingest_run_id FROM staging.production_log_raw),
     (SELECT COUNT(*) FROM staging.production_log_raw)),
    ('haccp_cert',
     (SELECT DISTINCT ingest_run_id FROM staging.haccp_cert_raw),
     (SELECT COUNT(*) FROM staging.haccp_cert_raw)),
    ('sales_suspension',
     (SELECT DISTINCT ingest_run_id FROM staging.sales_suspension_raw),
     (SELECT COUNT(*) FROM staging.sales_suspension_raw)),
    ('company_profiles',
     (SELECT DISTINCT ingest_run_id FROM staging.company_profiles_raw),
     (SELECT COUNT(*) FROM staging.company_profiles_raw)),
    ('mapping',
     (SELECT DISTINCT ingest_run_id FROM private.company_profile_mapping),
     (SELECT COUNT(*) FROM private.company_profile_mapping));

  -- Verify actual row counts match expected per dataset
  IF EXISTS (
    SELECT 1 FROM _chg_g6_rollback_runs
    WHERE (dataset = 'production_log'  AND actual_rows != 1047894)
       OR (dataset = 'haccp_cert'      AND actual_rows != 308)
       OR (dataset = 'sales_suspension' AND actual_rows != 355)
       OR (dataset = 'company_profiles' AND actual_rows != 308)
       OR (dataset = 'mapping'         AND actual_rows != 308)
  ) THEN
    RAISE EXCEPTION 'Staging row counts do not match expected values for rollback';
  END IF;

  -- Cross-check: each derived run ID must have a completed checkpoint
  IF EXISTS (
    SELECT 1 FROM _chg_g6_rollback_runs r
    WHERE NOT EXISTS (
      SELECT 1 FROM private.load_checkpoint cp
      WHERE cp.dataset = r.dataset
        AND cp.ingest_run_id = r.run_id
        AND cp.status = 'completed'
        AND cp.loaded_rows = r.actual_rows
    )
  ) THEN
    RAISE EXCEPTION 'Target-table run ID(s) missing matching completed checkpoint for rollback';
  END IF;

  -- Cross-check: each derived run ID must have a data_lineage record
  -- with matching dataset_name (dual-key: id + dataset_name)
  IF EXISTS (
    SELECT 1 FROM _chg_g6_rollback_runs r
    WHERE NOT EXISTS (
      SELECT 1 FROM private.data_lineage dl
      WHERE dl.id = r.run_id
        AND dl.dataset_name = r.dataset
    )
  ) THEN
    RAISE EXCEPTION 'Target-table run ID(s) have no matching data_lineage record (id + dataset_name)';
  END IF;

  SELECT ARRAY(SELECT run_id FROM _chg_g6_rollback_runs) INTO _run_ids;

  IF array_length(_run_ids, 1) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Expected 5 target-table-derived run IDs for rollback, got %',
                    COALESCE(array_length(_run_ids, 1), 0);
  END IF;
  IF (SELECT COUNT(DISTINCT run_id) FROM _chg_g6_rollback_runs) != 5 THEN
    RAISE EXCEPTION 'Expected 5 distinct run IDs for rollback, got %',
                    (SELECT COUNT(DISTINCT run_id) FROM _chg_g6_rollback_runs);
  END IF;

  -- Clear publish markers for exactly these 5 rows
  UPDATE private.data_lineage
  SET publish_version = NULL
  WHERE id = ANY(_run_ids)
    AND publish_version IS NOT NULL;

  GET DIAGNOSTICS _cleared = ROW_COUNT;

  -- Assert those 5 IDs are now unpublished
  IF (SELECT COUNT(*) FROM private.data_lineage
      WHERE id = ANY(_run_ids)
        AND publish_version IS NOT NULL) > 0 THEN
    RAISE EXCEPTION 'Some CHG-G6-002 lineage rows still have publish_version set';
  END IF;

  -- Assert those 5 IDs are not visible through the public VIEW
  SELECT COUNT(*) INTO _still_visible
  FROM public.data_lineage_public
  WHERE id = ANY(_run_ids);

  IF _still_visible > 0 THEN
    RAISE EXCEPTION '% rolled-back lineage row(s) still visible in data_lineage_public',
                    _still_visible;
  END IF;

  RAISE NOTICE 'Lineage rollback: % markers cleared, 0 visible in public VIEW', _cleared;
END $$;

-- ============================================================
-- 3. Verify empty state
-- ============================================================
DO $$
DECLARE
  cnt_products BIGINT;
  cnt_view BIGINT;
  cnt_haccp BIGINT;
  cnt_safety BIGINT;
  cnt_mfg BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt_products FROM public.products_public;
  SELECT COUNT(*) INTO cnt_view FROM public.facility_products_public;
  SELECT COUNT(*) INTO cnt_haccp FROM public.haccp_certifications_public;
  SELECT COUNT(*) INTO cnt_safety FROM public.facility_safety_public;
  SELECT COUNT(*) INTO cnt_mfg FROM public.manufacturing_profiles_public;

  IF cnt_products + cnt_view + cnt_haccp + cnt_safety + cnt_mfg > 0 THEN
    RAISE EXCEPTION 'Data rollback incomplete: products=%, view=%, haccp=%, safety=%, mfg=%',
                    cnt_products, cnt_view, cnt_haccp, cnt_safety, cnt_mfg;
  ELSE
    RAISE NOTICE 'Data rollback complete: all public tables empty, staging preserved';
  END IF;
END $$;

COMMIT;
