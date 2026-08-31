-- CHG-G6-002 VS-A Migration 0031: facility_safety_public
-- Source: sales_suspension WHERE facility_mgt_no IS NOT NULL (SQLite, read-only)
-- Expected rows: 103 (facility-linked only)
-- Depends on: 0025_vs2_facilities_v2 (public.facilities)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Facility-keyed sales suspension records.
--   Only the 103 rows with a confirmed facility link are included.
--   The 252 unlinked rows are excluded from the public projection.

-- ============================================================
-- 0. Prerequisites guard
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'facilities'
  ) THEN
    RAISE EXCEPTION 'public.facilities must exist (run 0025 first)';
  END IF;
END $$;

-- ============================================================
-- 1. public.facility_safety_public
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facility_safety_public (
  id              BIGSERIAL   PRIMARY KEY,
  facility_mgt_no TEXT        NOT NULL REFERENCES public.facilities(mgt_no),
  product_name    TEXT,                   -- 제품명 (해당 판매중지 제품)
  maker_name      TEXT,                   -- source: sales_suspension.maker_name
  reason          TEXT,                   -- 판매중지 사유 (공개)
  method          TEXT,                   -- 회수·판매중지 방법
  batch_mfg_date  TEXT,
  batch_exp_date  TEXT,
  barcode         TEXT,
  product_code    TEXT,
  image_url       TEXT,
  published_at    TEXT,                   -- source 공개일자
  source_created_at TEXT,
  -- maker_addr and other unnecessary address detail excluded
  created_at      TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID        REFERENCES private.data_lineage(id)
);

CREATE INDEX IF NOT EXISTS idx_facility_safety_facility
  ON public.facility_safety_public (facility_mgt_no);

-- ============================================================
-- 2. Row-Level Security
-- ============================================================
ALTER TABLE public.facility_safety_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_safety_public_select" ON public.facility_safety_public
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.facility_safety_public TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.facility_safety_public FROM anon, authenticated;

COMMENT ON TABLE public.facility_safety_public IS
  'CHG-G6-002 VS-A: Sales suspension records — facility-linked only (103 rows). '
  'The 252 unlinked rows are excluded from public view.';
