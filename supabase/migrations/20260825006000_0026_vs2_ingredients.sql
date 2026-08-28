-- VS-2 Migration 0026: ingredients runtime master + staging table + RLS
-- Source: recipes.db → ingredients table (18,933 rows; 1 rejected: NULL ingredient_name)
-- Loaded: 18,932 rows (reject_count=1 recorded in private.data_lineage)
-- Depends on: 0020 (private.data_lineage + staging schema)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- Q-07 blocker resolved 2026-08-25: source confirmed at
--   D:\0. 업무\1. 연도별프로젝트_2025\2507 부산정보산업진흥원_빅데이터 분석활용 지원사업\
--   최종자료\맛모듈 레시피\맛모듈 개발소스\db\recipes.db → ingredients table
--
-- Reject: ingredient_id=1124336 (ingredient_name IS NULL).
--   Referenced by 0 recipe_ingredients rows → safe to exclude with no FK cascade.
--   Recorded in private.data_lineage.reject_count = 1.
--
-- Column mapping from recipes.db → public.ingredients:
--   ingredient_id   INTEGER (PK AUTOINCREMENT) → ingredient_id (PK)
--   ingredient_name TEXT UNIQUE                → ingredient_name (NOT NULL UNIQUE)

-- ============================================================
-- 1. public.ingredients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ingredients (
  ingredient_id   INTEGER   PRIMARY KEY,
  ingredient_name TEXT      NOT NULL,
  -- Lineage
  basis_date      DATE,
  ingest_run_id   UUID      REFERENCES private.data_lineage(id)
);

-- Unique constraint on ingredient name (UNIQUE NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_name
  ON public.ingredients(ingredient_name);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_ingredients_name_fts
  ON public.ingredients USING gin(to_tsvector('simple', ingredient_name));

COMMENT ON TABLE public.ingredients IS
  'Ingredient master — 18,932 loaded rows (1 rejected: NULL name). '
  'Source: recipes.db → ingredients. Distinct from analysis ingredient_name_match table.';
COMMENT ON COLUMN public.ingredients.ingredient_id IS
  'INTEGER PK matching recipes.db.ingredients.ingredient_id. '
  'ingredient_id=1124336 excluded (NULL name, 0 FK references).';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.ingredients
  FROM anon, authenticated;

GRANT SELECT ON public.ingredients TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.ingredients
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.ingredients (
  LIKE public.ingredients INCLUDING ALL
);

ALTER TABLE staging.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_ingest_run_id_fkey;

-- Drop the unique index copy from LIKE (re-create without interference)
DROP INDEX IF EXISTS staging.uq_ingredients_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staging_ingredients_name
  ON staging.ingredients(ingredient_name);

COMMENT ON TABLE staging.ingredients IS
  'Ingest staging for ingredients. Expected: 18,932 rows (1 row rejected at source).';

-- ============================================================
-- Verification queries (run after data load)
-- ============================================================
-- SELECT count(*) FROM staging.ingredients;                            -- 18,932
-- SELECT count(*) FROM staging.ingredients WHERE ingredient_name IS NULL;  -- 0
-- SELECT count(*) FROM staging.ingredients WHERE ingredient_id = 1124336;  -- 0 (rejected)
