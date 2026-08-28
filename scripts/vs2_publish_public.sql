-- VS-2 Approval C: staging -> public single-transaction publish
-- EXECUTION PROHIBITED until user explicitly approves Approval C
-- Runner  : scripts/vs2_publish_public_secure.ps1
-- Rollback: scripts/vs2_rollback_public.sql  (TRUNCATE public 7 tables only)
-- Preflight must pass before running this script.
--
-- Publish order (FK-dependency safe):
--   1. standard_foods        (no FK deps within public)
--   2. recipes               (no FK deps within public)
--   3. ingredients           (no FK deps within public)
--   4. facilities            (no FK deps within public)
--   5. substitute_pairs      (no FK to above public tables; FK to private.data_lineage exists)
--   6. ingredient_name_match (no FK to above public tables)
--   7. recipe_ingredients    (FK -> public.recipes + public.ingredients -- must be last)
--
-- On any RAISE EXCEPTION inside a DO block, the transaction is automatically rolled back.
-- No partial publish is possible within a single transaction.

BEGIN;

-- ── 1. standard_foods (686 rows) ─────────────────────────────────────────
INSERT INTO public.standard_foods (
    standard_food_id,
    name,
    food_group,
    representative_ingredient,
    usage_row_count,
    recipe_count,
    energy_kcal,
    water_g,
    protein_g,
    fat_g,
    ash_g,
    carbohydrate_g,
    basis_date,
    ingest_run_id
)
SELECT
    standard_food_id,
    name,
    food_group,
    representative_ingredient,
    usage_row_count,
    recipe_count,
    energy_kcal,
    water_g,
    protein_g,
    fat_g,
    ash_g,
    carbohydrate_g,
    basis_date,
    ingest_run_id
FROM staging.standard_foods;

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.standard_foods;
    IF n <> 686 THEN
        RAISE EXCEPTION 'standard_foods count mismatch: got %, expected 686', n;
    END IF;
    RAISE NOTICE 'standard_foods: % rows published', n;
END $$;

-- ── 2. recipes (70,165 rows) ─────────────────────────────────────────────
INSERT INTO public.recipes (
    recipe_id,
    title,
    category_large,
    category_mid,
    category_small,
    servings,
    basis_date,
    ingest_run_id
)
SELECT
    recipe_id,
    title,
    category_large,
    category_mid,
    category_small,
    servings,
    basis_date,
    ingest_run_id
FROM staging.recipes;

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.recipes;
    IF n <> 70165 THEN
        RAISE EXCEPTION 'recipes count mismatch: got %, expected 70165', n;
    END IF;
    RAISE NOTICE 'recipes: % rows published', n;
END $$;

-- ── 3. ingredients (18,932 rows) ─────────────────────────────────────────
INSERT INTO public.ingredients (
    ingredient_id,
    ingredient_name,
    basis_date,
    ingest_run_id
)
SELECT
    ingredient_id,
    ingredient_name,
    basis_date,
    ingest_run_id
FROM staging.ingredients;

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.ingredients;
    IF n <> 18932 THEN
        RAISE EXCEPTION 'ingredients count mismatch: got %, expected 18932', n;
    END IF;
    RAISE NOTICE 'ingredients: % rows published', n;
END $$;

-- ── 4. facilities (94,723 rows) ──────────────────────────────────────────
-- created_at is preserved from staging (original ingest timestamp).
-- Non-approved columns (road_addr etc.) exist in staging but are not inserted
-- because column-level ACL (migration 0025b) already restricts anon SELECT.
-- Note: staging.facilities was created via LIKE public.facilities INCLUDING ALL,
-- so it has the same columns as public.facilities -- no road_addr present
-- in the new isolated project's staging table (0025 did not add road_addr).
INSERT INTO public.facilities (
    mgt_no,
    name,
    region_sido,
    region_sigungu,
    business_type,
    is_haccp,
    status,
    tel,
    homepage,
    created_at,
    ingest_run_id
)
SELECT
    mgt_no,
    name,
    region_sido,
    region_sigungu,
    business_type,
    is_haccp,
    status,
    tel,
    homepage,
    created_at,
    ingest_run_id
FROM staging.facilities;

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.facilities;
    IF n <> 94723 THEN
        RAISE EXCEPTION 'facilities count mismatch: got %, expected 94723', n;
    END IF;
    RAISE NOTICE 'facilities: % rows published', n;
END $$;

-- ── 5. substitute_pairs (234,955 rows) ───────────────────────────────────
-- Korean PK column names must be double-quoted.
INSERT INTO public.substitute_pairs (
    "기준식품ID",
    "후보식품ID",
    sim_nutrition,
    sim_ingredient_category,
    sim_food_group,
    sim_cooking_state,
    sim_dish_type,
    sim_companion,
    score_composite,
    score_final,
    available_sim_count,
    basis_date,
    ingest_run_id
)
SELECT
    "기준식품ID",
    "후보식품ID",
    sim_nutrition,
    sim_ingredient_category,
    sim_food_group,
    sim_cooking_state,
    sim_dish_type,
    sim_companion,
    score_composite,
    score_final,
    available_sim_count,
    basis_date,
    ingest_run_id
FROM staging.substitute_pairs;

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.substitute_pairs;
    IF n <> 234955 THEN
        RAISE EXCEPTION 'substitute_pairs count mismatch: got %, expected 234955', n;
    END IF;
    RAISE NOTICE 'substitute_pairs: % rows published', n;
END $$;

-- ── 6. ingredient_name_match (23,806 rows) ───────────────────────────────
INSERT INTO public.ingredient_name_match (
    input_name,
    standard_food_id,
    match_type,
    match_confidence,
    basis_date,
    ingest_run_id
)
SELECT
    input_name,
    standard_food_id,
    match_type,
    match_confidence,
    basis_date,
    ingest_run_id
FROM staging.ingredient_name_match;

DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.ingredient_name_match;
    IF n <> 23806 THEN
        RAISE EXCEPTION 'ingredient_name_match count mismatch: got %, expected 23806', n;
    END IF;
    RAISE NOTICE 'ingredient_name_match: % rows published', n;
END $$;

-- ── 7. recipe_ingredients (679,457 rows) ─────────────────────────────────
-- id column (BIGSERIAL) is omitted: public table generates new sequence values.
-- staging.recipe_ingredients.id values are staging-internal and not carried over.
-- amount_gram NULL = 1 is expected (recipe_id=6936777 confirmed anomaly).
INSERT INTO public.recipe_ingredients (
    recipe_id,
    ingredient_id,
    amount_raw,
    unit_raw,
    amount_gram,
    sort_order,
    is_seasoning
)
SELECT
    recipe_id,
    ingredient_id,
    amount_raw,
    unit_raw,
    amount_gram,
    sort_order,
    is_seasoning
FROM staging.recipe_ingredients;

DO $$
DECLARE n INTEGER;
DECLARE null_gram INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.recipe_ingredients;
    IF n <> 679457 THEN
        RAISE EXCEPTION 'recipe_ingredients count mismatch: got %, expected 679457', n;
    END IF;
    SELECT COUNT(*) INTO null_gram
    FROM public.recipe_ingredients WHERE amount_gram IS NULL;
    IF null_gram <> 1 THEN
        RAISE EXCEPTION 'recipe_ingredients amount_gram NULL mismatch: got %, expected 1',
                        null_gram;
    END IF;
    RAISE NOTICE 'recipe_ingredients: % rows published (amount_gram NULL: %)', n, null_gram;
END $$;

-- ── Final summary ─────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'PUBLISH COMPLETE: standard_foods=686, recipes=70165, ingredients=18932, facilities=94723, substitute_pairs=234955, ingredient_name_match=23806, recipe_ingredients=679457';
END $$;

COMMIT;
