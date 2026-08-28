-- VS-2 Migration 0023: ingredient_name_match + staging table + RLS
-- Source: analysis_outputs/ingredient_matching.csv (23,806 rows)
-- Primary key: input_name (재료명 — confirmed unique by VS-1)
-- Depends on: 0020 (private.data_lineage + staging schema)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- Column mapping from ingredient_matching.csv:
--   재료명          → input_name (PK)
--   표준재료        → (used to look up standard_food_id via recipe_ingredients mapping)
--   재료매칭신뢰도  → match_confidence
--   재료매칭방법    → match_type (Korean → English enum mapping in load script)
--
-- match_type Korean → English enum:
--   완전일치 → 'exact'      (488 rows,  2.05%)
--   포함일치 → 'substring'  (11,764 rows, 49.42%)
--   철자유사 → 'fuzzy'      (295 rows,  1.24%)
--   동의어   → 'synonym'    (35 rows,   0.15%)
--   미매칭   → 'unmatched'  (11,224 rows, 47.15%)
--
-- standard_food_id lookup (load script):
--   표준재료 → 식품ID via recipe_ingredients.csv (표준재료, 식품ID) mapping (577 pairs, 100% coverage)
--   미매칭 rows: standard_food_id = NULL (표준재료 is empty or irrelevant)
--
-- B-20: match_type is owned by this table; substitute_pairs does NOT have a match_type column.

-- ============================================================
-- 1. public.ingredient_name_match
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ingredient_name_match (
  input_name        TEXT        PRIMARY KEY,  -- 재료명 (original ingredient name; unique)
  standard_food_id  TEXT,                     -- 식품ID lookup result; NULL when unmatched
  match_type        TEXT        NOT NULL
    CHECK (match_type IN ('exact','substring','fuzzy','synonym','unmatched')),
  match_confidence  NUMERIC(6,4),             -- 재료매칭신뢰도 (NULL for unmatched rows)
  -- Lineage
  basis_date        DATE,
  ingest_run_id     UUID        REFERENCES private.data_lineage(id)
);

-- Reverse lookup: given a standard_food_id, find all input names that map to it
-- (partial index: only matched rows — unmatched have NULL standard_food_id)
CREATE INDEX IF NOT EXISTS idx_ingr_match_sfid
  ON public.ingredient_name_match(standard_food_id)
  WHERE standard_food_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingr_match_type
  ON public.ingredient_name_match(match_type);

COMMENT ON TABLE public.ingredient_name_match IS
  'Input name → standard_food_id mapping (23,806 rows including 11,224 unmatched). Source: ingredient_matching.csv. VS-1 confirmed.';
COMMENT ON COLUMN public.ingredient_name_match.standard_food_id IS
  'NULL when match_type = ''unmatched''. Matches standard_foods.standard_food_id.';
COMMENT ON COLUMN public.ingredient_name_match.match_type IS
  'Enum: exact | substring | fuzzy | synonym | unmatched. B-20 ownership.';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.ingredient_name_match
  FROM anon, authenticated;

GRANT SELECT ON public.ingredient_name_match TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.ingredient_name_match ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.ingredient_name_match
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.ingredient_name_match (
  LIKE public.ingredient_name_match INCLUDING ALL
);

ALTER TABLE staging.ingredient_name_match
  DROP CONSTRAINT IF EXISTS ingredient_name_match_ingest_run_id_fkey;

COMMENT ON TABLE staging.ingredient_name_match IS
  'Ingest staging. Expected: 23,806 rows (12,582 matched + 11,224 unmatched).';

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT count(*) FROM staging.ingredient_name_match;  -- 23,806
-- SELECT match_type, count(*) FROM staging.ingredient_name_match GROUP BY 1 ORDER BY 2 DESC;
--   exact: 488, substring: 11764, fuzzy: 295, synonym: 35, unmatched: 11224
-- SELECT count(*) FROM staging.ingredient_name_match WHERE match_type='unmatched' AND standard_food_id IS NOT NULL;  -- 0
-- SELECT count(*) FROM staging.ingredient_name_match WHERE match_type!='unmatched' AND standard_food_id IS NULL;  -- 0
