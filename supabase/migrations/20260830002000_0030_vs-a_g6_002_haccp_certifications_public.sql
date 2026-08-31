-- CHG-G6-002 VS-A Migration 0030: haccp_certifications_public
-- Source: haccp_cert (SQLite, read-only reference)
-- Expected rows: 308 total; 269 with facility_mgt_no; 39 NULL
-- Depends on: 0025_vs2_facilities_v2 (public.facilities)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Public HACCP certification records without raw_payload.
--   Enables: "this facility has HACCP certification".
--   CCP list (공개 안전정보) is included; raw_payload is excluded.

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
-- 1. public.haccp_certifications_public
-- ============================================================
CREATE TABLE IF NOT EXISTS public.haccp_certifications_public (
  id              BIGSERIAL   PRIMARY KEY,
  facility_mgt_no TEXT        REFERENCES public.facilities(mgt_no)
                               DEFERRABLE INITIALLY DEFERRED,
                                          -- NULL for 39 rows without facility link
  biz_name        TEXT        NOT NULL,   -- 업소명 (공개 검색용)
  cert_no         TEXT,                   -- 인증번호
  cert_date       TEXT,                   -- source 문자열을 손실 없이 보존
  ccp_list        TEXT,                   -- CCP 목록 (공개 안전정보)
  -- raw_payload EXCLUDED: contains internal audit details
  source_updated_at TEXT,                 -- source: haccp_cert.updated_at
  created_at      TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID        REFERENCES private.data_lineage(id)
);

CREATE INDEX IF NOT EXISTS idx_haccp_public_facility
  ON public.haccp_certifications_public (facility_mgt_no)
  WHERE facility_mgt_no IS NOT NULL;

-- ============================================================
-- 2. Row-Level Security
-- ============================================================
ALTER TABLE public.haccp_certifications_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "haccp_certifications_public_select" ON public.haccp_certifications_public
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.haccp_certifications_public TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.haccp_certifications_public FROM anon, authenticated;

COMMENT ON TABLE public.haccp_certifications_public IS
  'CHG-G6-002 VS-A: HACCP cert records — raw_payload excluded. '
  '308 total: 269 facility-linked (261 distinct facilities), 39 unlinked.';
