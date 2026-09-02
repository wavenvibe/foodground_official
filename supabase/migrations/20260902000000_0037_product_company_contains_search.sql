-- CHG-G6-002 follow-up Migration 0037: indexed contains search
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Enables case-insensitive substring search across both product_name and
-- maker_name without sequentially scanning the 1,047,894-row public table.
-- Data, RLS policies and grants are unchanged.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_trgm'
  ) THEN
    RAISE EXCEPTION 'pg_trgm extension must exist before migration 0037';
  END IF;

  IF to_regclass('public.products_public') IS NULL THEN
    RAISE EXCEPTION 'public.products_public must exist before migration 0037';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_public_product_name_trgm
  ON public.products_public
  USING gin (product_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_public_maker_name_trgm
  ON public.products_public
  USING gin (maker_name extensions.gin_trgm_ops)
  WHERE maker_name IS NOT NULL;

ANALYZE public.products_public;

COMMENT ON INDEX public.idx_products_public_product_name_trgm IS
  'CHG-G6-002 follow-up: indexed case-insensitive contains search for product names.';

COMMENT ON INDEX public.idx_products_public_maker_name_trgm IS
  'CHG-G6-002 follow-up: indexed case-insensitive contains search for manufacturer names.';
