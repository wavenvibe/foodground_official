-- Migration 0037 rollback: indexes only; no application data is changed.
-- Execute only after explicit approval and before reverting the application
-- query to its pre-0037 full-text implementation.

DROP INDEX IF EXISTS public.idx_products_public_maker_name_trgm;
DROP INDEX IF EXISTS public.idx_products_public_product_name_trgm;
