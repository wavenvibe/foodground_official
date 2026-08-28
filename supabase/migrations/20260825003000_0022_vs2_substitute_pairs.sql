-- VS-2 Migration 0022: substitute_pairs + staging table + RLS
-- Source: analysis_outputs/food_pair_similarities.csv (234,955 rows)
-- Primary key: (기준식품ID, 후보식품ID) composite
-- score_composite and score_final are computed during load (not in source CSV)
-- Depends on: 0020 (private.data_lineage + staging schema)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- Column mapping from food_pair_similarities.csv:
--   기준식품ID           → 기준식품ID
--   후보식품ID           → 후보식품ID
--   영양성분_유사도      → sim_nutrition
--   재료구분_유사도      → sim_ingredient_category
--   식품군_유사도        → sim_food_group
--   조리상태_유사도      → sim_cooking_state
--   요리종류_유사도      → sim_dish_type
--   동반재료_유사도      → sim_companion
--   계산가능_유사도수    → available_sim_count
--
-- Score computation (load script):
--   Step 1: score_composite = weighted avg of non-NULL sim fields
--     weights: nutrition×0.60, ingredient_category×0.15, food_group×0.15, cooking_state×0.10
--     NULL handling: re-normalize by sum of available weights
--   Step 2: score_final = weighted avg of score_composite + dish_type + companion
--     weights: composite×0.70, dish_type×0.20, companion×0.10
--     NULL handling: re-normalize by sum of available weights

-- ============================================================
-- 1. public.substitute_pairs
-- ============================================================
-- Note: PK columns keep Korean names to match source CSV and design doc (§3.6).
-- FK to standard_foods intentionally omitted:
--   food_pair_similarities.csv uses 685 unique IDs (1 absent as source);
--   strict FK would fail on that 1 ID if it appears as candidate.
--   Integrity validated in vs2_validate.py instead.
CREATE TABLE IF NOT EXISTS public.substitute_pairs (
  -- Source identifiers (Korean column names per design doc §3.6)
  "기준식품ID"              TEXT        NOT NULL,
  "후보식품ID"              TEXT        NOT NULL,
  -- Step 1 similarity inputs
  sim_nutrition             NUMERIC(8,6),   -- 영양성분_유사도
  sim_ingredient_category   NUMERIC(8,6),   -- 재료구분_유사도
  sim_food_group            NUMERIC(8,6),   -- 식품군_유사도
  sim_cooking_state         NUMERIC(8,6),   -- 조리상태_유사도
  -- Step 2 similarity inputs
  sim_dish_type             NUMERIC(8,6),   -- 요리종류_유사도
  sim_companion             NUMERIC(8,6),   -- 동반재료_유사도
  -- Derived scores (computed during load)
  score_composite           NUMERIC(8,6),   -- Step 1 result
  score_final               NUMERIC(8,6),   -- Step 2 result (primary sort key)
  -- Metadata
  available_sim_count       SMALLINT,       -- 계산가능_유사도수 (4–6)
  basis_date                DATE        NOT NULL,
  ingest_run_id             UUID        REFERENCES private.data_lineage(id),
  PRIMARY KEY ("기준식품ID", "후보식품ID")
);

-- Primary access pattern: given a 기준식품ID, get candidates ranked by score_final
CREATE INDEX IF NOT EXISTS idx_sub_source_score
  ON public.substitute_pairs("기준식품ID", score_final DESC NULLS LAST);

-- Reverse lookup: given a 후보식품ID, find what it substitutes for
CREATE INDEX IF NOT EXISTS idx_sub_candidate
  ON public.substitute_pairs("후보식품ID");

COMMENT ON TABLE public.substitute_pairs IS
  'Pre-computed substitute food pairs (234,955 rows). Source: food_pair_similarities.csv. VS-1 confirmed.';
COMMENT ON COLUMN public.substitute_pairs.score_composite IS
  'Step 1: nutrition×0.60 + ingredient_category×0.15 + food_group×0.15 + cooking_state×0.10 (null-renormalized).';
COMMENT ON COLUMN public.substitute_pairs.score_final IS
  'Step 2: score_composite×0.70 + dish_type×0.20 + companion×0.10 (null-renormalized). Primary sort key.';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.substitute_pairs
  FROM anon, authenticated;

GRANT SELECT ON public.substitute_pairs TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.substitute_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.substitute_pairs
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.substitute_pairs (
  LIKE public.substitute_pairs INCLUDING ALL
);

ALTER TABLE staging.substitute_pairs
  DROP CONSTRAINT IF EXISTS substitute_pairs_ingest_run_id_fkey;
-- Note: LIKE INCLUDING ALL copies the PRIMARY KEY constraint too;
-- that is desired for staging duplicate detection.

COMMENT ON TABLE staging.substitute_pairs IS
  'Ingest staging for substitute_pairs. 234,955 rows expected after load.';

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT count(*) FROM staging.substitute_pairs;  -- 234,955
-- SELECT count(*) FROM staging.substitute_pairs WHERE score_final IS NULL;  -- 0
-- SELECT count(*) FROM staging.substitute_pairs WHERE score_composite IS NULL;  -- 0
-- SELECT min(score_final), max(score_final) FROM staging.substitute_pairs;
-- SELECT available_sim_count, count(*) FROM staging.substitute_pairs GROUP BY 1 ORDER BY 1;
