-- VS-2 Approval C: rollback -- TRUNCATE public 7 tables only
-- Rollback scope (ONLY):
--   - public.recipe_ingredients, public.ingredient_name_match, public.substitute_pairs,
--     public.facilities, public.ingredients, public.recipes, public.standard_foods
-- NOT affected:
--   - Schema definitions (no DROP TABLE, no ALTER TABLE)
--   - staging.* tables (untouched)
--   - private.* tables including data_lineage (untouched)
--   - supabase_migrations (untouched)
--   - Any other public table not in the list above
-- No CASCADE DROP. No schema-level changes.

BEGIN;

-- Truncate in FK-dependency order (no CASCADE keyword needed):
-- recipe_ingredients references public.recipes + public.ingredients via FK.
-- TRUNCATE of the referencing table (recipe_ingredients) must precede
-- TRUNCATE of the referenced tables (recipes, ingredients).
-- All other tables have no FK dependencies to each other within this set.

TRUNCATE TABLE
    public.recipe_ingredients,
    public.ingredient_name_match,
    public.substitute_pairs,
    public.facilities,
    public.ingredients,
    public.recipes,
    public.standard_foods;

-- Verify all 7 tables are empty after rollback
DO $$
DECLARE n INTEGER;
BEGIN
    SELECT COUNT(*) INTO n FROM public.recipe_ingredients;
    IF n <> 0 THEN
        RAISE EXCEPTION 'recipe_ingredients not empty after rollback: %', n;
    END IF;

    SELECT COUNT(*) INTO n FROM public.ingredient_name_match;
    IF n <> 0 THEN
        RAISE EXCEPTION 'ingredient_name_match not empty after rollback: %', n;
    END IF;

    SELECT COUNT(*) INTO n FROM public.substitute_pairs;
    IF n <> 0 THEN
        RAISE EXCEPTION 'substitute_pairs not empty after rollback: %', n;
    END IF;

    SELECT COUNT(*) INTO n FROM public.facilities;
    IF n <> 0 THEN
        RAISE EXCEPTION 'facilities not empty after rollback: %', n;
    END IF;

    SELECT COUNT(*) INTO n FROM public.ingredients;
    IF n <> 0 THEN
        RAISE EXCEPTION 'ingredients not empty after rollback: %', n;
    END IF;

    SELECT COUNT(*) INTO n FROM public.recipes;
    IF n <> 0 THEN
        RAISE EXCEPTION 'recipes not empty after rollback: %', n;
    END IF;

    SELECT COUNT(*) INTO n FROM public.standard_foods;
    IF n <> 0 THEN
        RAISE EXCEPTION 'standard_foods not empty after rollback: %', n;
    END IF;

    RAISE NOTICE 'ROLLBACK COMPLETE: all 7 public tables are empty. staging/private/migrations unchanged.';
END $$;

COMMIT;
