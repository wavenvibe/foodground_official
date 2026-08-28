-- VS-2 Rollback SQL
-- Target: glczrbadvfgmblmkpgfj
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Use the appropriate section depending on which migration stage to roll back.
-- Rule B-08: NEVER TRUNCATE public tables. NEVER disable RLS.
-- Rollback uses REVOKE SELECT (Stage 3) or TRUNCATE staging (Stage 2) or DROP staging (Stage 1).

-- ============================================================
-- STAGE 3 ROLLBACK: Revoke public read access
-- Use when: public access has been activated (Stage 3) and needs to be recalled.
-- Effect: anonymous users lose SELECT access; tables and data remain intact.
-- Uncomment the block below to execute.
-- ============================================================
/*
REVOKE SELECT ON public.recipe_ingredients  FROM anon, authenticated;
REVOKE SELECT ON public.ingredients         FROM anon, authenticated;
REVOKE SELECT ON public.recipes             FROM anon, authenticated;
REVOKE SELECT ON public.facilities          FROM anon, authenticated;
REVOKE SELECT ON public.substitute_pairs    FROM anon, authenticated;
REVOKE SELECT ON public.standard_foods      FROM anon, authenticated;
REVOKE SELECT ON public.ingredient_name_match FROM anon, authenticated;
-- Note: does NOT truncate or drop tables; data is preserved.
*/

-- ============================================================
-- STAGE 2 ROLLBACK: Truncate staging tables for re-load
-- Use when: staging data is wrong and needs to be reloaded.
-- Effect: staging tables emptied; public tables unchanged.
-- Uncomment the block below to execute.
-- ============================================================
/*
TRUNCATE staging.recipe_ingredients;
TRUNCATE staging.ingredients;
TRUNCATE staging.recipes;
TRUNCATE staging.facilities;
TRUNCATE staging.substitute_pairs;
TRUNCATE staging.standard_foods;
TRUNCATE staging.ingredient_name_match;
*/

-- ============================================================
-- STAGE 1 ROLLBACK: Drop staging tables and public objects
-- Use when: full schema reset is needed (e.g., DDL error in Stage 1).
-- WARNING: drops public tables too -- only use before any real data is loaded.
-- Uncomment the block below to execute.
-- ============================================================
/*
-- Drop staging tables first (dependency order: relationships before masters)
DROP TABLE IF EXISTS staging.recipe_ingredients;
DROP TABLE IF EXISTS staging.ingredient_name_match;
DROP TABLE IF EXISTS staging.substitute_pairs;
DROP TABLE IF EXISTS staging.standard_foods;
DROP TABLE IF EXISTS staging.ingredients;
DROP TABLE IF EXISTS staging.recipes;
DROP TABLE IF EXISTS staging.facilities;
DROP SCHEMA IF EXISTS staging;

-- Drop public tables (CASCADE removes RLS policies + indexes + FK constraints)
DROP TABLE IF EXISTS public.recipe_ingredients    CASCADE;
DROP TABLE IF EXISTS public.ingredient_name_match CASCADE;
DROP TABLE IF EXISTS public.substitute_pairs      CASCADE;
DROP TABLE IF EXISTS public.standard_foods        CASCADE;
DROP TABLE IF EXISTS public.ingredients           CASCADE;
DROP TABLE IF EXISTS public.recipes               CASCADE;
DROP TABLE IF EXISTS public.facilities            CASCADE;

-- Drop private schema objects
DROP TABLE IF EXISTS private.data_lineage CASCADE;
DROP SCHEMA IF EXISTS private;
*/

-- ============================================================
-- FULL RESET (nuclear option -- use only when starting from scratch)
-- Combines Stage 1 rollback + schema cleanup.
-- Requires the Stage 1 block above to be uncommented.
-- ============================================================
