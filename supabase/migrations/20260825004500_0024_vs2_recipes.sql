-- VS-2 Migration 0024 (REVISED): recipes runtime master + staging table + RLS
-- Source: recipes.db → recipes table (70,165 rows)
-- Primary key: recipe_id INTEGER (range 6,920,615 ~ 7,014,706, confirmed by local audit 2026-08-25)
-- Depends on: 0020 (private.data_lineage + staging schema)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- BASELINE SEPARATION (do not mix):
--   Web runtime master  : recipes.db → 70,165 rows (this table)
--   Analysis baseline   : recipe_ingredients.csv → 69,406 unique recipes (alternative-ingredient pipeline only)
--
-- Column mapping from recipes.db → public.recipes:
--   recipe_id      INTEGER   → recipe_id (PK)
--   title          TEXT      → title
--   category_large TEXT      → category_large
--   category_mid   TEXT      → category_mid
--   category_small TEXT      → category_small
--   servings       INTEGER   → servings
--   raw_text       TEXT      → EXCLUDED (too large; not needed for web runtime)
--
-- Note: public.recipe_ingredients (679,457 rows) is created in migration 0027.

-- ============================================================
-- 1. public.recipes (runtime master)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recipes (
  recipe_id       INTEGER   PRIMARY KEY,
  title           TEXT      NOT NULL,
  category_large  TEXT,
  category_mid    TEXT,
  category_small  TEXT,
  servings        INTEGER,
  -- Lineage
  basis_date      DATE,
  ingest_run_id   UUID      REFERENCES private.data_lineage(id)
);

-- Full-text search on recipe title
CREATE INDEX IF NOT EXISTS idx_recipes_title_fts
  ON public.recipes USING gin(to_tsvector('simple', title));

-- Category filters
CREATE INDEX IF NOT EXISTS idx_recipes_category_large
  ON public.recipes(category_large);

CREATE INDEX IF NOT EXISTS idx_recipes_category_mid
  ON public.recipes(category_mid);

COMMENT ON TABLE public.recipes IS
  'Recipe master — 70,165 rows from recipes.db (web runtime). '
  'DISTINCT from analysis baseline (69,406 rows, alternative-ingredient pipeline CSVs).';
COMMENT ON COLUMN public.recipes.recipe_id IS
  'INTEGER PK from recipes.db (range 6,920,615 ~ 7,014,706).';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.recipes
  FROM anon, authenticated;

GRANT SELECT ON public.recipes TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.recipes
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.recipes (
  LIKE public.recipes INCLUDING ALL
);

ALTER TABLE staging.recipes
  DROP CONSTRAINT IF EXISTS recipes_ingest_run_id_fkey;

COMMENT ON TABLE staging.recipes IS
  'Ingest staging for recipes. Expected: 70,165 rows from recipes.db.';

-- ============================================================
-- Verification queries (run after data load)
-- ============================================================
-- SELECT count(*) FROM staging.recipes;                                -- 70,165
-- SELECT count(*) FROM staging.recipes WHERE title IS NULL;            -- 0
-- SELECT category_large, count(*) FROM staging.recipes GROUP BY 1 ORDER BY 2 DESC;
-- SELECT min(recipe_id), max(recipe_id) FROM staging.recipes;         -- 6920615, 7014706
