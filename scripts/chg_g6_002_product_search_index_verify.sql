-- Migration 0037 read-only verification.
-- Confirms the two contains-search indexes without changing data or ACLs.

DO $$
DECLARE
  product_count BIGINT;
  index_count INTEGER;
  invalid_count INTEGER;
  wrong_opclass_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_count FROM public.products_public;
  IF product_count <> 1047894 THEN
    RAISE EXCEPTION 'products_public count changed: % (expected 1047894)', product_count;
  END IF;

  SELECT COUNT(*) INTO index_count
  FROM pg_class idx
  JOIN pg_namespace ns ON ns.oid = idx.relnamespace
  WHERE ns.nspname = 'public'
    AND idx.relkind = 'i'
    AND idx.relname IN (
      'idx_products_public_product_name_trgm',
      'idx_products_public_maker_name_trgm'
    );
  IF index_count <> 2 THEN
    RAISE EXCEPTION 'Migration 0037 index count: % (expected 2)', index_count;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = idx.relnamespace
  WHERE ns.nspname = 'public'
    AND idx.relname IN (
      'idx_products_public_product_name_trgm',
      'idx_products_public_maker_name_trgm'
    )
    AND (NOT i.indisvalid OR NOT i.indisready);
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'Migration 0037 has % invalid or unready indexes', invalid_count;
  END IF;

  SELECT COUNT(*) INTO wrong_opclass_count
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = idx.relnamespace
  JOIN LATERAL unnest(i.indclass) AS opclass_oid ON TRUE
  JOIN pg_opclass opc ON opc.oid = opclass_oid
  WHERE ns.nspname = 'public'
    AND idx.relname IN (
      'idx_products_public_product_name_trgm',
      'idx_products_public_maker_name_trgm'
    )
    AND opc.opcname <> 'gin_trgm_ops';
  IF wrong_opclass_count <> 0 THEN
    RAISE EXCEPTION 'Migration 0037 index opclass mismatch count: %', wrong_opclass_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'products_public'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.products_public';
  END IF;

  IF has_table_privilege('anon', 'public.products_public', 'INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated', 'public.products_public', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Public write privilege detected after migration 0037';
  END IF;

  RAISE NOTICE 'PASS migration 0037 indexes: 2 valid/ready gin_trgm_ops indexes';
  RAISE NOTICE 'PASS products_public count unchanged: %', product_count;
  RAISE NOTICE 'PASS RLS/ACL unchanged: SELECT-only public access';
END $$;
