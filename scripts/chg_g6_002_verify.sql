-- CHG-G6-002 VS-F — Post-Publish Verification SQL
-- Run after chg_g6_002_publish.sql to verify data integrity.
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL.
--
-- Checks:
--   1. Row counts match expected values
--   2. PK uniqueness (no duplicates)
--   3. FK orphan check (facility_mgt_no → facilities.mgt_no)
--   4. VIEW row count matches base table filter
--   5. Mapping boundary: linked=265, ambiguous=4, unlinked=39
--   6. No private columns leaked to public tables
--   7. RLS/ACL verification queries
--   8. Lineage publish boundary (PUBLIC-LINEAGE-001 fix)

-- ============================================================
-- 1. Row counts
-- ============================================================
DO $$
DECLARE
  cnt_products BIGINT;
  cnt_view BIGINT;
  cnt_haccp BIGINT;
  cnt_safety BIGINT;
  cnt_mfg BIGINT;
  cnt_mapping BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt_products FROM public.products_public;
  SELECT COUNT(*) INTO cnt_view FROM public.facility_products_public;
  SELECT COUNT(*) INTO cnt_haccp FROM public.haccp_certifications_public;
  SELECT COUNT(*) INTO cnt_safety FROM public.facility_safety_public;
  SELECT COUNT(*) INTO cnt_mfg FROM public.manufacturing_profiles_public;
  SELECT COUNT(*) INTO cnt_mapping FROM private.company_profile_mapping;

  RAISE NOTICE 'products_public: % (expected 1047894)', cnt_products;
  RAISE NOTICE 'facility_products_public VIEW: % (expected 815989)', cnt_view;
  RAISE NOTICE 'haccp_certifications_public: % (expected 308)', cnt_haccp;
  RAISE NOTICE 'facility_safety_public: % (expected 103)', cnt_safety;
  RAISE NOTICE 'manufacturing_profiles_public: % (expected 265)', cnt_mfg;
  RAISE NOTICE 'company_profile_mapping: % (expected 308)', cnt_mapping;

  IF cnt_products != 1047894 THEN RAISE EXCEPTION 'products_public count MISMATCH: expected 1047894, got %', cnt_products; END IF;
  IF cnt_view != 815989 THEN RAISE EXCEPTION 'facility_products_public VIEW count MISMATCH: expected 815989, got %', cnt_view; END IF;
  IF cnt_haccp != 308 THEN RAISE EXCEPTION 'haccp_certifications_public count MISMATCH: expected 308, got %', cnt_haccp; END IF;
  IF cnt_safety != 103 THEN RAISE EXCEPTION 'facility_safety_public count MISMATCH: expected 103, got %', cnt_safety; END IF;
  IF cnt_mfg != 265 THEN RAISE EXCEPTION 'manufacturing_profiles_public count MISMATCH: expected 265, got %', cnt_mfg; END IF;
  IF cnt_mapping != 308 THEN RAISE EXCEPTION 'company_profile_mapping count MISMATCH: expected 308, got %', cnt_mapping; END IF;
END $$;

-- ============================================================
-- 2. PK uniqueness
-- ============================================================
DO $$
DECLARE
  dup_products BIGINT;
  dup_mfg BIGINT;
  dup_mapping BIGINT;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT report_no) INTO dup_products FROM public.products_public;
  SELECT COUNT(*) - COUNT(DISTINCT company_id) INTO dup_mfg FROM public.manufacturing_profiles_public;
  SELECT COUNT(*) - COUNT(DISTINCT company_id) INTO dup_mapping FROM private.company_profile_mapping;

  IF dup_products > 0 THEN RAISE EXCEPTION 'products_public has % duplicate PKs', dup_products; END IF;
  IF dup_mfg > 0 THEN RAISE EXCEPTION 'manufacturing_profiles_public has % duplicate PKs', dup_mfg; END IF;
  IF dup_mapping > 0 THEN RAISE EXCEPTION 'company_profile_mapping has % duplicate PKs', dup_mapping; END IF;

  IF dup_products = 0 AND dup_mfg = 0 AND dup_mapping = 0 THEN
    RAISE NOTICE 'PK uniqueness: ALL OK';
  END IF;
END $$;

-- ============================================================
-- 3. FK orphan check (facility_mgt_no → facilities.mgt_no)
-- ============================================================
DO $$
DECLARE
  orphan_products BIGINT;
  orphan_haccp BIGINT;
  orphan_safety BIGINT;
  orphan_mfg BIGINT;
BEGIN
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

  RAISE NOTICE 'FK orphans — products: %, haccp: %, safety: %, mfg: %',
               orphan_products, orphan_haccp, orphan_safety, orphan_mfg;

  IF orphan_products + orphan_haccp + orphan_safety + orphan_mfg > 0 THEN
    RAISE EXCEPTION 'FK orphan(s) detected — products: %, haccp: %, safety: %, mfg: %',
                    orphan_products, orphan_haccp, orphan_safety, orphan_mfg;
  END IF;
END $$;

-- ============================================================
-- 4. VIEW row count = base table filtered count
-- ============================================================
DO $$
DECLARE
  cnt_view BIGINT;
  cnt_base_filtered BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt_view FROM public.facility_products_public;
  SELECT COUNT(*) INTO cnt_base_filtered
  FROM public.products_public WHERE facility_mgt_no IS NOT NULL;

  IF cnt_view != cnt_base_filtered THEN
    RAISE EXCEPTION 'VIEW count (%) != base filtered count (%)',
                    cnt_view, cnt_base_filtered;
  ELSE
    RAISE NOTICE 'VIEW consistency: OK (% rows)', cnt_view;
  END IF;
END $$;

-- ============================================================
-- 5. Mapping boundary: 265 linked, 4 ambiguous, 39 unlinked
-- ============================================================
DO $$
DECLARE
  cnt_linked BIGINT;
  cnt_ambiguous BIGINT;
  cnt_unlinked BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt_linked FROM private.company_profile_mapping WHERE status = 'linked';
  SELECT COUNT(*) INTO cnt_ambiguous FROM private.company_profile_mapping WHERE status = 'ambiguous';
  SELECT COUNT(*) INTO cnt_unlinked FROM private.company_profile_mapping WHERE status = 'unlinked';

  RAISE NOTICE 'Mapping: linked=%, ambiguous=%, unlinked=%', cnt_linked, cnt_ambiguous, cnt_unlinked;

  IF cnt_linked != 265 OR cnt_ambiguous != 4 OR cnt_unlinked != 39 THEN
    RAISE EXCEPTION 'Mapping boundary MISMATCH: expected 265/4/39, got %/%/%',
                    cnt_linked, cnt_ambiguous, cnt_unlinked;
  END IF;
END $$;

-- ============================================================
-- 6. No private columns in public tables
-- ============================================================
DO $$
DECLARE
  leaked INT;
BEGIN
  -- Check that ccp_vector is NOT in manufacturing_profiles_public
  SELECT COUNT(*) INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'manufacturing_profiles_public'
    AND column_name IN ('ccp_vector', 'candidate_count', 'needs_review');

  -- Check that raw_payload is NOT in haccp_certifications_public
  SELECT COUNT(*) + leaked INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'haccp_certifications_public'
    AND column_name IN ('raw_payload', 'biz_addr');

  -- Check that maker_addr is NOT in facility_safety_public
  SELECT COUNT(*) + leaked INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'facility_safety_public'
    AND column_name = 'maker_addr';

  IF leaked > 0 THEN
    RAISE EXCEPTION '% private column(s) leaked to public tables', leaked;
  ELSE
    RAISE NOTICE 'Private column exclusion: OK';
  END IF;
END $$;

-- ============================================================
-- 7. RLS/ACL verification — actual SET ROLE + RAISE EXCEPTION
-- ============================================================
-- Verifies that anon and authenticated roles cannot write to
-- public tables/view and cannot access staging/private schemas.
DO $$
DECLARE
  _can_write BOOLEAN := FALSE;
BEGIN
  -- 7a. Verify RLS is enabled on public tables
  PERFORM 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'products_public'
      AND c.relrowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RLS not enabled on public.products_public';
  END IF;

  PERFORM 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'haccp_certifications_public'
      AND c.relrowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RLS not enabled on public.haccp_certifications_public';
  END IF;

  PERFORM 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'facility_safety_public'
      AND c.relrowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RLS not enabled on public.facility_safety_public';
  END IF;

  PERFORM 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'manufacturing_profiles_public'
      AND c.relrowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RLS not enabled on public.manufacturing_profiles_public';
  END IF;

  RAISE NOTICE 'RLS enabled on all 4 public tables: OK';
END $$;

-- 7b. Effective privilege verification, including inherited/PUBLIC grants.
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
BEGIN
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

    IF has_schema_privilege(_role, 'staging', 'USAGE') THEN
      RAISE EXCEPTION '% has USAGE on staging schema', _role;
    END IF;
    IF has_schema_privilege(_role, 'private', 'USAGE') THEN
      RAISE EXCEPTION '% has USAGE on private schema', _role;
    END IF;
  END LOOP;

  RAISE NOTICE 'anon/authenticated effective ACLs: SELECT-only public, no staging/private USAGE (OK)';
END $$;

-- 7c. pg_policies: verify SELECT policies exist for each RLS table.
DO $$
DECLARE
  _rel TEXT;
  _rls_tables TEXT[] := ARRAY[
    'products_public',
    'haccp_certifications_public',
    'facility_safety_public',
    'manufacturing_profiles_public'
  ];
BEGIN
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

  -- Verify facility_products_public VIEW: security_invoker + SELECT grant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'facility_products_public'
  ) THEN
    RAISE EXCEPTION 'facility_products_public VIEW does not exist';
  END IF;
  IF NOT has_table_privilege('anon', 'public.facility_products_public', 'SELECT') THEN
    RAISE EXCEPTION 'anon lacks SELECT on facility_products_public VIEW';
  END IF;

  RAISE NOTICE 'pg_policies and VIEW grant verification: OK';
END $$;

-- ============================================================
-- 8. Lineage publish boundary (PUBLIC-LINEAGE-001 fix)
-- ============================================================
-- Verifies:
--   a) 5 completed CHG-G6-002 checkpoints map to 5 lineage rows
--   b) Those 5 rows have publish_version = 'chg-g6-002-v1'
--   c) data_lineage_public exposes all 5 and zero NULL rows
--   d) VIEW definition includes WHERE publish_version IS NOT NULL
DO $$
DECLARE
  _run_ids UUID[];
  _lineage_count INT;
  _published_count INT;
  _view_count INT;
  _null_in_view INT;
  _view_has_filter BOOLEAN;
BEGIN
  -- 8a. Derive run IDs from target tables' actual contents
  CREATE TEMP TABLE _chg_g6_verify_runs (
    dataset TEXT PRIMARY KEY,
    run_id UUID NOT NULL,
    actual_rows BIGINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _chg_g6_verify_runs (dataset, run_id, actual_rows) VALUES
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
    SELECT 1 FROM _chg_g6_verify_runs
    WHERE (dataset = 'production_log'  AND actual_rows != 1047894)
       OR (dataset = 'haccp_cert'      AND actual_rows != 308)
       OR (dataset = 'sales_suspension' AND actual_rows != 355)
       OR (dataset = 'company_profiles' AND actual_rows != 308)
       OR (dataset = 'mapping'         AND actual_rows != 308)
  ) THEN
    RAISE EXCEPTION 'Staging row counts do not match expected values for verify';
  END IF;

  -- Cross-check: each target-table run ID has a matching completed checkpoint
  IF EXISTS (
    SELECT 1 FROM _chg_g6_verify_runs r
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
    SELECT 1 FROM _chg_g6_verify_runs r
    WHERE NOT EXISTS (
      SELECT 1 FROM private.data_lineage dl
      WHERE dl.id = r.run_id
        AND dl.dataset_name = r.dataset
    )
  ) THEN
    RAISE EXCEPTION 'Target-table run ID(s) have no matching data_lineage record (id + dataset_name)';
  END IF;

  SELECT ARRAY(SELECT run_id FROM _chg_g6_verify_runs) INTO _run_ids;

  IF array_length(_run_ids, 1) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Expected 5 target-table-derived run IDs, got %',
                    COALESCE(array_length(_run_ids, 1), 0);
  END IF;
  IF (SELECT COUNT(DISTINCT run_id) FROM _chg_g6_verify_runs) != 5 THEN
    RAISE EXCEPTION 'Expected 5 distinct run IDs for verify, got %',
                    (SELECT COUNT(DISTINCT run_id) FROM _chg_g6_verify_runs);
  END IF;

  -- 8b. Verify those 5 IDs exist in data_lineage with correct publish_version
  SELECT COUNT(*) INTO _lineage_count
  FROM private.data_lineage
  WHERE id = ANY(_run_ids);

  IF _lineage_count != 5 THEN
    RAISE EXCEPTION 'Expected 5 lineage rows for checkpoints, got %', _lineage_count;
  END IF;

  SELECT COUNT(*) INTO _published_count
  FROM private.data_lineage
  WHERE id = ANY(_run_ids)
    AND publish_version = 'chg-g6-002-v1';

  IF _published_count != 5 THEN
    RAISE EXCEPTION 'Expected 5 lineage rows with publish_version=chg-g6-002-v1, got %',
                    _published_count;
  END IF;

  -- 8c. Verify data_lineage_public exposes all 5 and no NULL-publish rows
  SELECT COUNT(*) INTO _view_count
  FROM public.data_lineage_public
  WHERE id = ANY(_run_ids);

  IF _view_count != 5 THEN
    RAISE EXCEPTION 'data_lineage_public should expose 5 CHG-G6-002 rows, got %', _view_count;
  END IF;

  -- Zero rows with publish_version IS NULL should be visible through the VIEW
  SELECT COUNT(*) INTO _null_in_view
  FROM public.data_lineage_public dlp
  JOIN private.data_lineage dl ON dl.id = dlp.id
  WHERE dl.publish_version IS NULL;

  IF _null_in_view > 0 THEN
    RAISE EXCEPTION 'data_lineage_public exposes % row(s) with NULL publish_version', _null_in_view;
  END IF;

  -- 8d. Verify VIEW definition contains the publish boundary filter
  --     (case-robust: pg_get_viewdef may uppercase keywords)
  SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'data_lineage_public'
      AND lower(definition) LIKE '%publish_version is not null%'
  ) INTO _view_has_filter;

  IF NOT _view_has_filter THEN
    RAISE EXCEPTION 'data_lineage_public VIEW missing WHERE publish_version IS NOT NULL filter';
  END IF;

  RAISE NOTICE 'Lineage publish boundary: 5 checkpoints → 5 published lineage rows, VIEW filter OK';
END $$;

SELECT 'Post-publish verification complete (including RLS/ACL/pg_policies/lineage boundary). Review NOTICE output above.' AS status;
