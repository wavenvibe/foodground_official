-- CHG-G6-002 VS-A Migration 0033: private.company_profile_mapping
-- Source: data/derived/chg-g6-002/company_profile_facility_mapping.csv (308 rows)
-- REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL
--
-- Purpose:
--   Full mapping registry including ambiguous and unlinked profiles.
--   Private: no anon or authenticated access.
--   service-role only (ingest + internal admin).
--
-- Security invariant:
--   This table MUST NOT be granted to anon or authenticated roles.
--   Public surface is manufacturing_profiles_public (linked rows only).

-- ============================================================
-- 0. Schema guard (private schema created in earlier migration)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'private'
  ) THEN
    CREATE SCHEMA private;
  END IF;
END $$;

-- ============================================================
-- 1. private.company_profile_mapping (full 308 rows)
-- ============================================================
CREATE TABLE IF NOT EXISTS private.company_profile_mapping (
  company_id      TEXT        PRIMARY KEY,
  status          TEXT        NOT NULL CHECK (status IN ('linked', 'ambiguous', 'unlinked')),
  facility_mgt_no TEXT,                   -- NULL or '|'-delimited for ambiguous
  match_basis     TEXT        NOT NULL,   -- 'name+sido', 'name-only', 'none'
  candidate_count INT         NOT NULL DEFAULT 0,
  needs_review    BOOLEAN     NOT NULL DEFAULT false,
  mapping_rule    TEXT        NOT NULL
                  DEFAULT 'v0.2-norm-name-sido-in-addr-no-bidirectional',
  reviewed_at     TIMESTAMPTZ,            -- populated by manual review workflow
  review_outcome  TEXT,                   -- 'approved', 'rejected', 'deferred'
  created_at      TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID        REFERENCES private.data_lineage(id)
);

CREATE INDEX IF NOT EXISTS idx_priv_mapping_status
  ON private.company_profile_mapping (status);

-- ============================================================
-- 2. Access control — NO public access
-- ============================================================
REVOKE ALL ON private.company_profile_mapping FROM anon, authenticated, PUBLIC;

-- service_role access is implicit (bypasses RLS by default)
-- No RLS needed; schema-level restriction is sufficient.

COMMENT ON TABLE private.company_profile_mapping IS
  'CHG-G6-002 VS-A: Full 308-row mapping registry. '
  'linked=265 (in public.manufacturing_profiles_public), '
  'ambiguous=4 + unlinked=39 (needs_review=true, excluded from public). '
  'Access: service_role only.';

-- ============================================================
-- 3. staging schema tables (source load targets)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'staging'
  ) THEN
    CREATE SCHEMA staging;
  END IF;
END $$;

-- staging.haccp_cert_raw: ingest target before validation + public promotion
CREATE TABLE IF NOT EXISTS staging.haccp_cert_raw (
  id              BIGINT      PRIMARY KEY,
  facility_mgt_no TEXT,
  biz_name        TEXT,
  biz_addr        TEXT,
  cert_no         TEXT,
  cert_date       TEXT,
  ccp_list        TEXT,
  -- raw_payload excluded from staging (never persisted)
  updated_at      TEXT,
  load_timestamp  TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID
);

-- staging.sales_suspension_raw: ingest target
CREATE TABLE IF NOT EXISTS staging.sales_suspension_raw (
  id              BIGINT      PRIMARY KEY,
  facility_mgt_no TEXT,
  product_name    TEXT,
  maker_name      TEXT,
  maker_addr      TEXT,
  reason          TEXT,
  method          TEXT,
  batch_mfg_date  TEXT,
  batch_exp_date  TEXT,
  barcode         TEXT,
  product_code    TEXT,
  image_url       TEXT,
  published_at    TEXT,
  created_at      TEXT,
  load_timestamp  TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID
);

-- staging.production_log_raw: lightweight header only (no row-level ingest in this slice)
-- NOTE: 1,047,894 rows are NOT loaded in VS-A. This table is created for VS-B+ use.
CREATE TABLE IF NOT EXISTS staging.production_log_raw (
  report_no       TEXT        PRIMARY KEY,
  facility_mgt_no TEXT,
  product_name    TEXT,
  category        TEXT,
  maker_name      TEXT,
  maker_addr      TEXT,
  ingredients     TEXT,
  shelf_life_days INTEGER,
  reported_at     TEXT,
  updated_at      TEXT,
  load_timestamp  TIMESTAMPTZ DEFAULT now(),
  ingest_run_id   UUID
);

-- staging.company_profiles_raw: 공동제조 프로필 원본 계약.
-- ccp_vector는 설명가능한 공개필드가 아니므로 staging에서만 보존한다.
CREATE TABLE IF NOT EXISTS staging.company_profiles_raw (
  company_id        TEXT        PRIMARY KEY,
  company_name      TEXT        NOT NULL,
  item_set          TEXT        NOT NULL,
  ccp_set_std       TEXT,
  ccp_vector        TEXT,
  has_cooking_ccp   BOOLEAN     NOT NULL,
  has_sterilize_ccp BOOLEAN     NOT NULL,
  sido              TEXT,
  load_timestamp    TIMESTAMPTZ DEFAULT now(),
  ingest_run_id     UUID
);

-- No public access to staging schema
REVOKE ALL ON ALL TABLES IN SCHEMA staging FROM anon, authenticated, PUBLIC;

COMMENT ON SCHEMA staging IS
  'CHG-G6-002 VS-A: Staging tables for source load validation before public promotion. '
  'No public access. service_role only.';
