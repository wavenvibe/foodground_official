-- Supabase SQL Editor에 붙여넣고 실행하세요

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS facility (
  mgt_no          TEXT PRIMARY KEY,
  local_gov_code  TEXT,
  name            TEXT NOT NULL,
  biz_type        TEXT,
  status          TEXT NOT NULL,
  status_detail   TEXT,
  licensed_at     TEXT,
  closed_at       TEXT,
  tel             TEXT,
  road_addr       TEXT,
  lot_addr        TEXT,
  road_postal     TEXT,
  coord_x         DOUBLE PRECISION,
  coord_y         DOUBLE PRECISION,
  homepage        TEXT,
  updated_at      TEXT,
  ingest_gubun    TEXT,
  region_sido     TEXT,
  region_sigungu  TEXT,
  region_dong     TEXT,
  is_haccp        INTEGER DEFAULT 0,
  suspension_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_facility_status   ON facility(status);
CREATE INDEX IF NOT EXISTS idx_facility_region   ON facility(region_sido, region_sigungu);
CREATE INDEX IF NOT EXISTS idx_facility_biztype  ON facility(biz_type);
CREATE INDEX IF NOT EXISTS idx_facility_haccp    ON facility(is_haccp) WHERE is_haccp = 1;
CREATE INDEX IF NOT EXISTS idx_facility_name_trgm ON facility USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_facility_addr_trgm ON facility USING GIN (road_addr gin_trgm_ops);

CREATE TABLE IF NOT EXISTS production_log (
  report_no       TEXT PRIMARY KEY,
  facility_mgt_no TEXT REFERENCES facility(mgt_no) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,
  category        TEXT,
  maker_name      TEXT,
  maker_addr      TEXT,
  ingredients     TEXT,
  shelf_life_days INTEGER,
  reported_at     TEXT,
  updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_production_facility    ON production_log(facility_mgt_no);
CREATE INDEX IF NOT EXISTS idx_production_category    ON production_log(category);
CREATE INDEX IF NOT EXISTS idx_production_reported_at ON production_log(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_name_trgm   ON production_log USING GIN (product_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS haccp_cert (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_mgt_no TEXT REFERENCES facility(mgt_no) ON DELETE SET NULL,
  biz_name        TEXT NOT NULL,
  biz_addr        TEXT,
  cert_no         TEXT,
  cert_date       TEXT,
  ccp_list        TEXT,
  raw_payload     TEXT,
  updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_haccp_facility ON haccp_cert(facility_mgt_no);

CREATE TABLE IF NOT EXISTS sales_suspension (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  facility_mgt_no TEXT REFERENCES facility(mgt_no) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,
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
  created_at      TEXT DEFAULT NOW()::TEXT
);

CREATE INDEX IF NOT EXISTS idx_suspension_facility ON sales_suspension(facility_mgt_no);

CREATE TABLE IF NOT EXISTS ingest_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset       TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated  INTEGER DEFAULT 0,
  rows_deleted  INTEGER DEFAULT 0,
  status        TEXT,
  error_message TEXT,
  window_begin  TEXT,
  window_end    TEXT
);

-- 공개 데이터이므로 RLS 비활성화
ALTER TABLE facility         DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_log   DISABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_cert       DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_suspension DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_log       DISABLE ROW LEVEL SECURITY;
