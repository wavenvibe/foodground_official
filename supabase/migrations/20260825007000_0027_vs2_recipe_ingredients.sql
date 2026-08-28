-- VS-2 Migration 0027: recipe_ingredients relationship table + staging + RLS
-- Source: recipes.db → recipe_ingredients table (679,457 rows)
-- Depends on: 0024 (public.recipes), 0026 (public.ingredients), 0020 (staging schema)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- This table is RELATIONSHIP DATA only — not part of the 183,821 runtime master count.
-- Runtime master: recipes(70,165) + ingredients(18,932) + facilities(94,723) = 183,820
--
-- Column mapping from recipes.db → public.recipe_ingredients:
--   recipe_id     INTEGER → recipe_id (FK → public.recipes)
--   ingredient_id INTEGER → ingredient_id (FK → public.ingredients; excludes rejected id=1124336)
--   amount_raw    TEXT    → amount_raw
--   unit_raw      TEXT    → unit_raw
--   amount_gram   REAL    → amount_gram NUMERIC(10,2)
--   sort_order    INTEGER → sort_order
--   is_seasoning  INTEGER (0/1) → is_seasoning BOOLEAN
--
-- FK note: recipes.db recipe_ingredients rows that reference ingredient_id=1124336
--   were confirmed to be 0 (audit 2026-08-25). No FK violation from the 1 rejected ingredient.

-- ============================================================
-- 1. public.recipe_ingredients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id              BIGSERIAL     PRIMARY KEY,
  recipe_id       INTEGER       NOT NULL REFERENCES public.recipes(recipe_id),
  ingredient_id   INTEGER       NOT NULL REFERENCES public.ingredients(ingredient_id),
  amount_raw      TEXT,
  unit_raw        TEXT,
  amount_gram     NUMERIC(10,2),
  sort_order      INTEGER,
  is_seasoning    BOOLEAN
);

-- Indexes for recipe navigation and ingredient lookup
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON public.recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id
  ON public.recipe_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_sort
  ON public.recipe_ingredients(recipe_id, sort_order);

COMMENT ON TABLE public.recipe_ingredients IS
  'Recipe-ingredient relationship — 679,457 rows from recipes.db. '
  'Relationship data; not counted in the 183,821 runtime master total.';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.recipe_ingredients
  FROM anon, authenticated;

GRANT SELECT ON public.recipe_ingredients TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.recipe_ingredients
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.recipe_ingredients (
  LIKE public.recipe_ingredients INCLUDING ALL
);

-- Remove FK and serial constraints from staging copy
ALTER TABLE staging.recipe_ingredients
  DROP CONSTRAINT IF EXISTS recipe_ingredients_recipe_id_fkey;
ALTER TABLE staging.recipe_ingredients
  DROP CONSTRAINT IF EXISTS recipe_ingredients_ingredient_id_fkey;

COMMENT ON TABLE staging.recipe_ingredients IS
  'Ingest staging for recipe_ingredients. Expected: 679,457 rows.';

-- ============================================================
-- Verification queries (run after data load)
-- ============================================================
-- SELECT count(*) FROM staging.recipe_ingredients;                     -- 679,457
-- SELECT count(*) FROM staging.recipe_ingredients WHERE recipe_id IS NULL;    -- 0
-- SELECT count(*) FROM staging.recipe_ingredients WHERE ingredient_id IS NULL; -- 0
-- SELECT count(DISTINCT recipe_id) FROM staging.recipe_ingredients;   -- 70,165
