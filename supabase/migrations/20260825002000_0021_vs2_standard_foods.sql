-- VS-2 Migration 0021: standard_foods + staging table + RLS
-- Source: analysis_outputs/food_master.csv (686 rows)
-- Primary key: 식품ID (confirmed by VS-1 audit, 686 unique values, 0 duplicates)
-- Depends on: 0020 (private.data_lineage + staging schema must exist)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)

-- ============================================================
-- 1. public.standard_foods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.standard_foods (
  standard_food_id  TEXT        PRIMARY KEY,   -- 식품ID from food_master.csv
  name              TEXT        NOT NULL,       -- 식품명
  food_group        TEXT,                       -- 식품군 (20 categories)
  representative_ingredient TEXT,               -- 대표재료명
  usage_row_count   INTEGER,                    -- 사용행수 (from food_master.csv)
  recipe_count      INTEGER,                    -- 레시피수 (from food_master.csv)
  -- Nutrition (key fields; food_master.csv has 135 cols total)
  energy_kcal       NUMERIC(10,2),              -- 에너지 (kcal)
  water_g           NUMERIC(10,2),              -- 수분 (g)
  protein_g         NUMERIC(10,2),              -- 단백질 (g)
  fat_g             NUMERIC(10,2),              -- 지방 (g) — source col has trailing space: '지방 '
  ash_g             NUMERIC(10,2),              -- 회분 (g)
  carbohydrate_g    NUMERIC(10,2),              -- 탄수화물 (g)
  -- Lineage
  basis_date        DATE,
  ingest_run_id     UUID        REFERENCES private.data_lineage(id)
);

CREATE INDEX IF NOT EXISTS idx_standard_foods_name       ON public.standard_foods(name);
CREATE INDEX IF NOT EXISTS idx_standard_foods_food_group ON public.standard_foods(food_group);

COMMENT ON TABLE public.standard_foods IS
  'Standard food master (686 records). Source: food_master.csv. VS-1 confirmed.';
COMMENT ON COLUMN public.standard_foods.fat_g IS
  'Source column name has trailing space: "지방 " — handle with strip() in load script.';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
-- Defense-in-depth: explicitly revoke write operations in addition to RLS.
-- Supabase default setup may grant INSERT/UPDATE/DELETE to these roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.standard_foods
  FROM anon, authenticated;

GRANT SELECT ON public.standard_foods TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.standard_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.standard_foods
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.standard_foods (
  LIKE public.standard_foods INCLUDING ALL
);

-- Remove the FK constraint on staging (ingest may run before lineage row)
ALTER TABLE staging.standard_foods
  DROP CONSTRAINT IF EXISTS standard_foods_ingest_run_id_fkey;

COMMENT ON TABLE staging.standard_foods IS
  'Ingest staging. TRUNCATE and reload on each run. Not exposed via PostgREST.';

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT count(*) FROM staging.standard_foods;  -- should be 686 after load
-- SELECT count(DISTINCT standard_food_id) FROM staging.standard_foods;  -- 686
-- SELECT count(*) FROM staging.standard_foods WHERE standard_food_id IS NULL;  -- 0
-- SELECT count(*) FROM staging.standard_foods WHERE name IS NULL;  -- 0
