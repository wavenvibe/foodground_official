-- CHG-G6-002 VS-F — Staging → Public Publish SQL
-- Atomic transaction: staging data → public tables (full refresh).
-- The VIEW facility_products_public auto-reflects products_public changes.
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
--
-- Execution order:
--   1. chg_g6_002_preflight.py (live)
--   2. chg_g6_002_staging_loader.py (live, all datasets)
--   3. This script (publish)
--   4. chg_g6_002_verify.sql (post-publish verify)
--
-- Rollback: chg_g6_002_publish_rollback.sql

BEGIN;

-- ============================================================
-- 1. products_public — full refresh from staging.production_log_raw
-- ============================================================
TRUNCATE public.products_public;

INSERT INTO public.products_public
  (report_no, product_name, category, maker_name,
   ingredients, shelf_life_days, facility_mgt_no,
   reported_at, updated_at, ingest_run_id)
SELECT
  report_no, product_name, category, maker_name,
  ingredients, shelf_life_days,
  NULLIF(NULLIF(facility_mgt_no, ''), ' '),
  reported_at, updated_at, ingest_run_id
FROM staging.production_log_raw;

-- facility_products_public VIEW auto-reflects (no action needed)

-- ============================================================
-- 2. haccp_certifications_public — full refresh
-- ============================================================
TRUNCATE public.haccp_certifications_public;

INSERT INTO public.haccp_certifications_public
  (facility_mgt_no, biz_name, cert_no, cert_date,
   ccp_list, source_updated_at, ingest_run_id)
SELECT
  NULLIF(NULLIF(facility_mgt_no, ''), ' '),
  biz_name, cert_no, cert_date,
  ccp_list, updated_at, ingest_run_id
FROM staging.haccp_cert_raw;

-- ============================================================
-- 3. facility_safety_public — facility-linked only
-- ============================================================
TRUNCATE public.facility_safety_public;

INSERT INTO public.facility_safety_public
  (facility_mgt_no, product_name, maker_name,
   reason, method, batch_mfg_date, batch_exp_date,
   barcode, product_code, image_url, published_at,
   source_created_at, ingest_run_id)
SELECT
  facility_mgt_no, product_name, maker_name,
  reason, method, batch_mfg_date, batch_exp_date,
  barcode, product_code, image_url, published_at,
  created_at, ingest_run_id
FROM staging.sales_suspension_raw
WHERE facility_mgt_no IS NOT NULL
  AND facility_mgt_no != '';

-- ============================================================
-- 4. manufacturing_profiles_public — linked only (from mapping)
-- ============================================================
TRUNCATE public.manufacturing_profiles_public;

INSERT INTO public.manufacturing_profiles_public
  (company_id, company_name, facility_mgt_no, item_set,
   ccp_set_std, has_cooking_ccp, has_sterilize_ccp, sido,
   match_basis, mapping_rule, ingest_run_id)
SELECT
  m.company_id,
  p.company_name,
  m.facility_mgt_no,
  p.item_set,
  p.ccp_set_std,
  p.has_cooking_ccp,
  p.has_sterilize_ccp,
  p.sido,
  m.match_basis,
  m.mapping_rule,
  p.ingest_run_id
FROM private.company_profile_mapping m
JOIN staging.company_profiles_raw p ON p.company_id = m.company_id
WHERE m.status = 'linked';

-- ============================================================
-- 5. Lineage publish markers — atomic with data publish
-- ============================================================
-- Derive run IDs from the five target tables' actual contents,
-- then cross-check against checkpoints and data_lineage. This
-- bounded five-run contract ensures lineage markers are set only
-- for rows whose data is actually present in the target tables.
DO $$
DECLARE
  _run_ids UUID[];
  _marked INT;
  _unmarked INT;
BEGIN
  -- Derive one distinct ingest_run_id per target table from actual contents
  CREATE TEMP TABLE _chg_g6_runs (
    dataset TEXT PRIMARY KEY,
    run_id UUID NOT NULL,
    actual_rows BIGINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _chg_g6_runs (dataset, run_id, actual_rows) VALUES
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

  -- Each target table must have exactly one distinct run ID
  IF (SELECT COUNT(*) FROM _chg_g6_runs) != 5 THEN
    RAISE EXCEPTION 'Expected 5 target-table-derived run IDs, got %',
                    (SELECT COUNT(*) FROM _chg_g6_runs);
  END IF;
  IF (SELECT COUNT(DISTINCT run_id) FROM _chg_g6_runs) != 5 THEN
    RAISE EXCEPTION 'Expected 5 distinct run IDs, got %',
                    (SELECT COUNT(DISTINCT run_id) FROM _chg_g6_runs);
  END IF;

  -- Verify actual row counts match expected per dataset
  IF EXISTS (
    SELECT 1 FROM _chg_g6_runs
    WHERE (dataset = 'production_log'  AND actual_rows != 1047894)
       OR (dataset = 'haccp_cert'      AND actual_rows != 308)
       OR (dataset = 'sales_suspension' AND actual_rows != 355)
       OR (dataset = 'company_profiles' AND actual_rows != 308)
       OR (dataset = 'mapping'         AND actual_rows != 308)
  ) THEN
    RAISE EXCEPTION 'Target table row counts do not match expected values';
  END IF;

  -- Cross-check: each derived run ID must have a completed checkpoint
  -- with matching loaded_rows
  IF EXISTS (
    SELECT 1 FROM _chg_g6_runs r
    WHERE NOT EXISTS (
      SELECT 1 FROM private.load_checkpoint cp
      WHERE cp.dataset = r.dataset
        AND cp.ingest_run_id = r.run_id
        AND cp.status = 'completed'
        AND cp.loaded_rows = r.actual_rows
    )
  ) THEN
    RAISE EXCEPTION 'Target-table run ID(s) missing matching completed checkpoint';
  END IF;

  -- Cross-check: each derived run ID must have a data_lineage record
  -- with matching dataset_name (dual-key: id + dataset_name)
  IF EXISTS (
    SELECT 1 FROM _chg_g6_runs r
    WHERE NOT EXISTS (
      SELECT 1 FROM private.data_lineage dl
      WHERE dl.id = r.run_id
        AND dl.dataset_name = r.dataset
    )
  ) THEN
    RAISE EXCEPTION 'Target-table run ID(s) have no matching data_lineage record (id + dataset_name)';
  END IF;

  -- Collect run IDs into array for bounded UPDATE
  SELECT ARRAY(SELECT run_id FROM _chg_g6_runs) INTO _run_ids;

  -- Mark exactly these 5 lineage rows (bounded by run ID array)
  UPDATE private.data_lineage
  SET publish_version = 'chg-g6-002-v1'
  WHERE id = ANY(_run_ids)
    AND (publish_version IS NULL OR publish_version != 'chg-g6-002-v1');

  GET DIAGNOSTICS _marked = ROW_COUNT;

  -- Assert exactly 5 rows are now marked
  IF (SELECT COUNT(*) FROM private.data_lineage
      WHERE id = ANY(_run_ids)
        AND publish_version = 'chg-g6-002-v1') != 5 THEN
    RAISE EXCEPTION 'Expected 5 lineage rows marked chg-g6-002-v1, check failed';
  END IF;

  -- Assert no CHG-G6-002 target-linked row remains unpublished
  SELECT COUNT(*) INTO _unmarked
  FROM private.data_lineage dl
  JOIN _chg_g6_runs r ON r.run_id = dl.id
  WHERE dl.publish_version IS NULL;

  IF _unmarked > 0 THEN
    RAISE EXCEPTION '% CHG-G6-002 lineage row(s) still unpublished', _unmarked;
  END IF;

  RAISE NOTICE 'Lineage markers: % rows set to chg-g6-002-v1', _marked;
END $$;

-- ============================================================
-- 6. Pre-COMMIT verification — RAISE EXCEPTION on mismatch
-- ============================================================
DO $$
DECLARE
  cnt_products BIGINT;
  cnt_view BIGINT;
  cnt_haccp BIGINT;
  cnt_safety BIGINT;
  cnt_mfg BIGINT;
  cnt_mapping BIGINT;
  dup_products BIGINT;
  dup_mfg BIGINT;
  orphan_products BIGINT;
  orphan_haccp BIGINT;
  orphan_safety BIGINT;
  orphan_mfg BIGINT;
  cnt_linked BIGINT;
  cnt_ambiguous BIGINT;
  cnt_unlinked BIGINT;
  leaked INT;
BEGIN
  -- Row counts
  SELECT COUNT(*) INTO cnt_products FROM public.products_public;
  SELECT COUNT(*) INTO cnt_view FROM public.facility_products_public;
  SELECT COUNT(*) INTO cnt_haccp FROM public.haccp_certifications_public;
  SELECT COUNT(*) INTO cnt_safety FROM public.facility_safety_public;
  SELECT COUNT(*) INTO cnt_mfg FROM public.manufacturing_profiles_public;
  SELECT COUNT(*) INTO cnt_mapping FROM private.company_profile_mapping;

  IF cnt_products != 1047894 THEN
    RAISE EXCEPTION 'products_public count MISMATCH: expected 1047894, got %', cnt_products;
  END IF;
  IF cnt_view != 815989 THEN
    RAISE EXCEPTION 'facility_products_public VIEW count MISMATCH: expected 815989, got %', cnt_view;
  END IF;
  IF cnt_haccp != 308 THEN
    RAISE EXCEPTION 'haccp_certifications_public count MISMATCH: expected 308, got %', cnt_haccp;
  END IF;
  IF cnt_safety != 103 THEN
    RAISE EXCEPTION 'facility_safety_public count MISMATCH: expected 103, got %', cnt_safety;
  END IF;
  IF cnt_mfg != 265 THEN
    RAISE EXCEPTION 'manufacturing_profiles_public count MISMATCH: expected 265, got %', cnt_mfg;
  END IF;
  IF cnt_mapping != 308 THEN
    RAISE EXCEPTION 'company_profile_mapping count MISMATCH: expected 308, got %', cnt_mapping;
  END IF;

  -- PK uniqueness
  SELECT COUNT(*) - COUNT(DISTINCT report_no) INTO dup_products FROM public.products_public;
  SELECT COUNT(*) - COUNT(DISTINCT company_id) INTO dup_mfg FROM public.manufacturing_profiles_public;

  IF dup_products > 0 THEN
    RAISE EXCEPTION 'products_public has % duplicate report_no PKs', dup_products;
  END IF;
  IF dup_mfg > 0 THEN
    RAISE EXCEPTION 'manufacturing_profiles_public has % duplicate company_id PKs', dup_mfg;
  END IF;

  -- FK orphan check (facility_mgt_no → facilities.mgt_no)
  SELECT COUNT(*) INTO orphan_products
  FROM public.products_public p
  WHERE p.facility_mgt_no IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.mgt_no = p.facility_mgt_no);

  SELECT COUNT(*) INTO orphan_haccp
  FROM public.haccp_certifications_public h
  WHERE h.facility_mgt_no IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.mgt_no = h.facility_mgt_no);

  SELECT COUNT(*) INTO orphan_safety
  FROM public.facility_safety_public s
  WHERE NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.mgt_no = s.facility_mgt_no);

  SELECT COUNT(*) INTO orphan_mfg
  FROM public.manufacturing_profiles_public m
  WHERE NOT EXISTS (SELECT 1 FROM public.facilities f WHERE f.mgt_no = m.facility_mgt_no);

  IF orphan_products + orphan_haccp + orphan_safety + orphan_mfg > 0 THEN
    RAISE EXCEPTION 'FK orphans detected — products: %, haccp: %, safety: %, mfg: %',
                    orphan_products, orphan_haccp, orphan_safety, orphan_mfg;
  END IF;

  -- Mapping boundary: 265 linked, 4 ambiguous, 39 unlinked
  SELECT COUNT(*) INTO cnt_linked FROM private.company_profile_mapping WHERE status = 'linked';
  SELECT COUNT(*) INTO cnt_ambiguous FROM private.company_profile_mapping WHERE status = 'ambiguous';
  SELECT COUNT(*) INTO cnt_unlinked FROM private.company_profile_mapping WHERE status = 'unlinked';

  IF cnt_linked != 265 OR cnt_ambiguous != 4 OR cnt_unlinked != 39 THEN
    RAISE EXCEPTION 'Mapping boundary MISMATCH: expected 265/4/39, got %/%/%',
                    cnt_linked, cnt_ambiguous, cnt_unlinked;
  END IF;

  -- Private column leakage check
  SELECT COUNT(*) INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'manufacturing_profiles_public'
    AND column_name IN ('ccp_vector', 'candidate_count', 'needs_review');

  SELECT COUNT(*) + leaked INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'haccp_certifications_public'
    AND column_name IN ('raw_payload', 'biz_addr');

  SELECT COUNT(*) + leaked INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'facility_safety_public'
    AND column_name = 'maker_addr';

  IF leaked > 0 THEN
    RAISE EXCEPTION '% private column(s) leaked to public tables', leaked;
  END IF;

  RAISE NOTICE 'Pre-COMMIT verification PASSED: all counts, PKs, FKs, mapping, column exclusion OK';
END $$;

-- ============================================================
-- 7. Pre-COMMIT RLS/ACL guard — a bad grant must roll back data publish
-- ============================================================
DO $$
DECLARE
  _role TEXT;
  _rel TEXT;
  _roles TEXT[] := ARRAY['anon', 'authenticated'];
  _relations TEXT[] := ARRAY[
    'products_public',
    'facility_products_public',
    'haccp_certifications_public',
    'facility_safety_public',
    'manufacturing_profiles_public',
    'data_lineage_public'
  ];
  _rls_tables TEXT[] := ARRAY[
    'products_public',
    'haccp_certifications_public',
    'facility_safety_public',
    'manufacturing_profiles_public'
  ];
BEGIN
  FOREACH _rel IN ARRAY _rls_tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = _rel
        AND c.relrowsecurity = TRUE
    ) THEN
      RAISE EXCEPTION 'RLS not enabled on public.%', _rel;
    END IF;
  END LOOP;

  FOREACH _role IN ARRAY _roles LOOP
    FOREACH _rel IN ARRAY _relations LOOP
      IF NOT has_table_privilege(_role, format('public.%I', _rel), 'SELECT') THEN
        RAISE EXCEPTION '% lacks SELECT on public.%', _role, _rel;
      END IF;
      IF has_table_privilege(_role, format('public.%I', _rel), 'INSERT')
         OR has_table_privilege(_role, format('public.%I', _rel), 'UPDATE')
         OR has_table_privilege(_role, format('public.%I', _rel), 'DELETE')
         OR has_table_privilege(_role, format('public.%I', _rel), 'TRUNCATE') THEN
        RAISE EXCEPTION '% has write privilege on public.%', _role, _rel;
      END IF;
    END LOOP;
    IF has_schema_privilege(_role, 'staging', 'USAGE')
       OR has_schema_privilege(_role, 'private', 'USAGE') THEN
      RAISE EXCEPTION '% has forbidden staging/private schema USAGE', _role;
    END IF;
  END LOOP;

  -- Verify pg_policies: each RLS table must have a SELECT policy covering
  -- anon, authenticated, or the PUBLIC pseudo-role.
  -- NOTE: pg_policies.cmd stores full English form ('SELECT','ALL'), NOT ACL
  -- shorthand ('r','*'). pg_policies.roles is name[], cast to text[] for @>.
  -- PUBLIC pseudo-role appears as 'public' in roles, NOT as an empty array.
  FOREACH _rel IN ARRAY _rls_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = _rel
        AND upper(cmd) IN ('SELECT', 'ALL')
        AND (
          roles::text[] @> ARRAY['anon','authenticated']::text[]
          OR roles::text[] @> ARRAY['public']::text[]
        )
    ) THEN
      RAISE EXCEPTION 'No SELECT policy for anon/authenticated on public.%', _rel;
    END IF;
  END LOOP;

  -- Verify facility_products_public VIEW exists and has SELECT grant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'facility_products_public'
  ) THEN
    RAISE EXCEPTION 'facility_products_public VIEW does not exist';
  END IF;
  IF NOT has_table_privilege('anon', 'public.facility_products_public', 'SELECT') THEN
    RAISE EXCEPTION 'anon lacks SELECT on facility_products_public VIEW';
  END IF;

  RAISE NOTICE 'Pre-COMMIT RLS/ACL guard PASSED (including pg_policies and VIEW grant)';
END $$;

COMMIT;
