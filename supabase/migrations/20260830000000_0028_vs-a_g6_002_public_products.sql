-- CHG-G6-002 VS-A Migration 0028: products_public
-- Source: production_log (SQLite, read-only reference)
-- Expected rows: 1,047,894 (all rows — facility_mgt_no nullable)
-- Depends on: 0025_vs2_facilities_v2 (public.facilities)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Light-weight searchable projection of production_log.
--   All rows are included; facility link is optional (facility_mgt_no may be NULL).
--   No raw_payload, no personal data.
--
-- RLS:
--   anon + authenticated: SELECT only
--   service_role: full access (ingest only)
--   NO insert/update/delete by anon or authenticated

-- ============================================================
-- 0. Prerequisites guard
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'facilities'
  ) THEN
    RAISE EXCEPTION 'public.facilities must exist before this migration (run 0025 first)';
  END IF;
END $$;

-- ============================================================
-- 1. public.products_public
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products_public (
  report_no           TEXT        PRIMARY KEY,   -- 품목제조보고번호 (unique)
  product_name        TEXT        NOT NULL,       -- 제품명
  category            TEXT,                       -- source: production_log.category
  maker_name          TEXT,                       -- source: production_log.maker_name
  ingredients         TEXT,                       -- 원재료 표시 원문
  shelf_life_days     INTEGER,                    -- source: production_log.shelf_life_days
  facility_mgt_no     TEXT        REFERENCES public.facilities(mgt_no)
                                   DEFERRABLE INITIALLY DEFERRED,
                                                  -- FK nullable: 231,905 rows without link
  reported_at         TEXT,                       -- 원천 오기 보존을 위해 TEXT 유지
  updated_at          TEXT,                       -- source: production_log.updated_at
  created_at          TIMESTAMPTZ DEFAULT now(),
  ingest_run_id       UUID        REFERENCES private.data_lineage(id)
);

-- Index for common search patterns
CREATE INDEX IF NOT EXISTS idx_products_public_facility
  ON public.products_public (facility_mgt_no)
  WHERE facility_mgt_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_public_name
  ON public.products_public USING gin (to_tsvector('simple', product_name));

CREATE INDEX IF NOT EXISTS idx_products_public_category
  ON public.products_public (category);

-- ============================================================
-- 2. Row-Level Security
-- ============================================================
ALTER TABLE public.products_public ENABLE ROW LEVEL SECURITY;

-- anon / authenticated: read-only
CREATE POLICY "products_public_select" ON public.products_public
  FOR SELECT TO anon, authenticated USING (true);

-- service_role: unrestricted (for ingest)
-- (service_role bypasses RLS by default; no explicit policy needed)

-- ============================================================
-- 3. Grants
-- ============================================================
GRANT SELECT ON public.products_public TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.products_public FROM anon, authenticated;

COMMENT ON TABLE public.products_public IS
  'CHG-G6-002 VS-A: Light-weight public projection of production_log. '
  'Source mapping is 1:1 for report_no, product_name, category, maker_name, '
  'ingredients, shelf_life_days, facility_mgt_no, reported_at and updated_at. '
  'All 1,047,894 rows; facility_mgt_no is NULL for 231,905 unlinked products.';
