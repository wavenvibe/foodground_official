-- VS-2 Migration 0025: facilities (v2 — idempotent replacement of Codex prototype 0010)
-- Source: facilities data from legacy production Supabase (read-only reference)
-- Expected rows: 94,723
-- Depends on: 0020 (private.data_lineage + staging schema)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL (승인점 A)
--
-- Replaces: supabase/migrations/20260810001000_0010_vs1_facilities.sql (Codex prototype — frozen)
-- Changes from Codex prototype (idempotent — no DROP TABLE):
--   - Added: homepage (confirmed present in legacy schema, D-03 RESOLVED)
--   - Added: ingest_run_id (lineage FK to private.data_lineage)
--   - business_type: new column (was biz_type in Codex prototype — see DO block below)
--   - Removed: suspension_count, coord_x, coord_y, source_snapshot_id
--     (not in approved public field list §3.4 + B-06)
--   - product_types: excluded per user decision (Q-06 disabled for now)
--   - email: excluded (not in legacy source, D-03 RESOLVED)
--
-- IDEMPOTENCY NOTE:
--   This migration does NOT drop existing facilities table.
--   If the Codex prototype table (0010) exists, new columns are added via ALTER TABLE.
--   Data is not deleted or modified by running this migration.
--
-- Filter columns for co-manufacturing search (confirmed by user):
--   업종 (business_type), 지역 (region_sido/region_sigungu), HACCP (is_haccp), 영업상태 (status)

-- ============================================================
-- 1. public.facilities (CREATE IF NOT EXISTS — idempotent)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facilities (
  mgt_no          TEXT        PRIMARY KEY,    -- 관리번호 (stable identifier from SQLite source)
  name            TEXT        NOT NULL,        -- 업소명
  region_sido     TEXT,                        -- 시/도
  region_sigungu  TEXT,                        -- 시/군/구
  business_type   TEXT,                        -- 업종 (co-manufacturing filter)
  is_haccp        BOOLEAN,                     -- HACCP 인증 여부
  status          TEXT,                        -- 영업상태: '영업', '폐업', '정지'
  -- product_types excluded: Q-06 deferred (no confirmed source column)
  tel             TEXT,                        -- 공개 전화번호
  homepage        TEXT,                        -- 공개 홈페이지 URL (detail view only, D-03)
  -- Lineage
  created_at      TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID        REFERENCES private.data_lineage(id)
);

-- Idempotent column additions for tables created by older migrations (Codex prototype).
-- These are no-ops if the column already exists (IF NOT EXISTS).
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS homepage TEXT;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS ingest_run_id UUID;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Add FK constraint on ingest_run_id idempotently (only if not yet present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.facilities'::regclass
      AND contype = 'f'
      AND conname = 'facilities_ingest_run_id_fkey'
  ) THEN
    ALTER TABLE public.facilities
      ADD CONSTRAINT facilities_ingest_run_id_fkey
      FOREIGN KEY (ingest_run_id) REFERENCES private.data_lineage(id);
  END IF;
END $$;

-- Rename biz_type → business_type if the Codex prototype column name exists.
-- Only runs when old column exists and new column does not (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'facilities' AND column_name = 'biz_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'facilities' AND column_name = 'business_type'
  ) THEN
    ALTER TABLE public.facilities RENAME COLUMN biz_type TO business_type;
  END IF;
END $$;

-- Full-text search on facility name
CREATE INDEX IF NOT EXISTS idx_facilities_name_fts
  ON public.facilities USING gin(to_tsvector('simple', name));

-- Co-manufacturing filter indexes
CREATE INDEX IF NOT EXISTS idx_facilities_region
  ON public.facilities(region_sido, region_sigungu);
CREATE INDEX IF NOT EXISTS idx_facilities_business_type
  ON public.facilities(business_type);
CREATE INDEX IF NOT EXISTS idx_facilities_status
  ON public.facilities(status);
CREATE INDEX IF NOT EXISTS idx_facilities_haccp
  ON public.facilities(is_haccp)
  WHERE is_haccp = true;

COMMENT ON TABLE public.facilities IS
  'Manufacturing facility master (94,723 rows expected). Replaces Codex prototype 0010. Source: legacy Supabase (read-only reference).';
COMMENT ON COLUMN public.facilities.homepage IS
  'Displayed in facility detail view only (not in list cards). D-03 RESOLVED.';
COMMENT ON COLUMN public.facilities.business_type IS
  'Filter key for co-manufacturing search (업종). Was biz_type in Codex prototype.';

-- ============================================================
-- 2. Access control: anon/authenticated — SELECT only
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.facilities
  FROM anon, authenticated;

GRANT SELECT ON public.facilities TO anon, authenticated;

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Policy may already exist from prototype; CREATE OR REPLACE not supported for policies.
-- Use DO block to avoid error on re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'facilities' AND policyname = 'anon_read'
  ) THEN
    EXECUTE 'CREATE POLICY "anon_read" ON public.facilities FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ============================================================
-- 4. Staging table (staging schema — NOT exposed via PostgREST)
-- ============================================================
CREATE TABLE IF NOT EXISTS staging.facilities (
  LIKE public.facilities INCLUDING ALL
);

ALTER TABLE staging.facilities
  DROP CONSTRAINT IF EXISTS facilities_ingest_run_id_fkey;
ALTER TABLE staging.facilities
  DROP CONSTRAINT IF EXISTS staging_facilities_ingest_run_id_fkey;

COMMENT ON TABLE staging.facilities IS
  'Ingest staging for facilities. Expected: 94,723 rows. Source: legacy Supabase (read-only).';

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT count(*) FROM staging.facilities;  -- 94,723 (after load)
-- SELECT count(*) FROM staging.facilities WHERE mgt_no IS NULL;  -- 0
-- SELECT count(*) FROM staging.facilities WHERE name IS NULL;  -- 0
-- SELECT status, count(*) FROM staging.facilities GROUP BY 1 ORDER BY 2 DESC;
-- SELECT count(*) FROM staging.facilities WHERE is_haccp = true;
