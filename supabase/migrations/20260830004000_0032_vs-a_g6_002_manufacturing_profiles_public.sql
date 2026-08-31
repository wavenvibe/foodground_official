-- CHG-G6-002 VS-A Migration 0032: manufacturing_profiles_public
-- Source: data/derived/chg-g6-002/company_profile_facility_mapping.csv
-- Expected rows (public): 265 (linked only — ambiguous=4 and unlinked=39 excluded)
-- Depends on: 0025_vs2_facilities_v2 (public.facilities)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Public projection of approved co-manufacturing profile → facility mappings.
--   Only "linked" status rows (265) are exposed publicly.
--   "ambiguous" (4) and "unlinked" (39) are stored in private.company_profile_mapping only.
--
-- Rule version: v0.2-norm-name-sido-in-addr-no-bidirectional
--   norm(value) = re.sub(r"[^0-9a-z가-힣]", "", value.lower())
--   Region match: norm(sido) contained in norm(biz_addr)
--   No cross-profile bidirectional facility uniqueness check.

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
-- 1. public.manufacturing_profiles_public
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manufacturing_profiles_public (
  company_id      TEXT        PRIMARY KEY,
  company_name    TEXT        NOT NULL,
  facility_mgt_no TEXT        NOT NULL REFERENCES public.facilities(mgt_no),
  item_set        TEXT        NOT NULL,   -- 원본 pipe 구분 품목집합 보존
  ccp_set_std     TEXT,                   -- 표준 CCP 집합
  has_cooking_ccp BOOLEAN     NOT NULL,
  has_sterilize_ccp BOOLEAN   NOT NULL,
  sido            TEXT,
  match_basis     TEXT        NOT NULL,   -- 'name+sido' or 'name-only'
  -- ccp_vector, candidate_count, needs_review omitted from public
  mapping_rule    TEXT        NOT NULL    -- rule version for auditability
                  DEFAULT 'v0.2-norm-name-sido-in-addr-no-bidirectional',
  created_at      TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID        REFERENCES private.data_lineage(id)
);

CREATE INDEX IF NOT EXISTS idx_mfg_profiles_facility
  ON public.manufacturing_profiles_public (facility_mgt_no);

-- ============================================================
-- 2. Row-Level Security
-- ============================================================
ALTER TABLE public.manufacturing_profiles_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manufacturing_profiles_public_select" ON public.manufacturing_profiles_public
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.manufacturing_profiles_public TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.manufacturing_profiles_public FROM anon, authenticated;

COMMENT ON TABLE public.manufacturing_profiles_public IS
  'CHG-G6-002 VS-A: Approved co-manufacturing profile→facility links (265 linked rows). '
  'Ambiguous (4) and unlinked (39) are in private.company_profile_mapping only.';
