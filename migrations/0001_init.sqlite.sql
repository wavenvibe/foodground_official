-- ============================================================
--  푸드그라운드 · 0001_init (SQLite)
--  Phase 1~2 로컬 개발용. Phase 3 배포 시 migrations/0001_init.sql(PG)로 전환.
--  실행: sqlite3 data/foodground.db < migrations/0001_init.sqlite.sql
--
--  PG 버전과의 차이 요약:
--   - SERIAL           → INTEGER PRIMARY KEY AUTOINCREMENT
--   - TIMESTAMP        → TEXT (ISO 8601 문자열)
--   - NUMERIC/DATE     → TEXT (애플리케이션에서 파싱)
--   - JSONB            → TEXT (json.loads로 처리)
--   - pg_trgm 인덱스   → FTS5 가상테이블로 대체
--   - ON DELETE SET NULL 지원 (SQLite 3.6.19+)
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
--  facility : 식품제조시설 마스터 (data.go.kr 15044976)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS facility;
CREATE TABLE facility (
  mgt_no          TEXT PRIMARY KEY,
  local_gov_code  TEXT,
  name            TEXT NOT NULL,
  biz_type        TEXT,
  status          TEXT NOT NULL,            -- '영업/정상' | '폐업'
  status_detail   TEXT,
  licensed_at     TEXT,                     -- YYYY-MM-DD
  closed_at       TEXT,
  tel             TEXT,
  road_addr       TEXT,
  lot_addr        TEXT,
  road_postal     TEXT,
  coord_x         REAL,
  coord_y         REAL,
  homepage        TEXT,
  updated_at      TEXT,                     -- 최종수정시점 (증분 기준)
  ingest_gubun    TEXT,
  region_sido     TEXT,
  region_sigungu  TEXT,
  region_dong     TEXT,
  is_haccp        INTEGER DEFAULT 0,        -- boolean 대용
  suspension_count INTEGER DEFAULT 0
);
CREATE INDEX idx_facility_active  ON facility(status);
CREATE INDEX idx_facility_region  ON facility(region_sido, region_sigungu);
CREATE INDEX idx_facility_biztype ON facility(biz_type);
CREATE INDEX idx_facility_updated ON facility(updated_at);
CREATE INDEX idx_facility_haccp   ON facility(is_haccp) WHERE is_haccp = 1;

-- 업체명 한글 부분매칭용 FTS5 (pg_trgm 대체)
DROP TABLE IF EXISTS facility_fts;
CREATE VIRTUAL TABLE facility_fts USING fts5(
  mgt_no UNINDEXED,
  name,
  road_addr,
  tokenize='unicode61 remove_diacritics 2'
);

-- ------------------------------------------------------------
--  production_log : 품목제조보고 (data.go.kr 15062098)
-- ------------------------------------------------------------
CREATE TABLE production_log (
  report_no         TEXT PRIMARY KEY,
  facility_mgt_no   TEXT REFERENCES facility(mgt_no) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  category          TEXT,
  maker_name        TEXT,
  maker_addr        TEXT,
  ingredients       TEXT,
  shelf_life_days   INTEGER,
  reported_at       TEXT,
  updated_at        TEXT
);
CREATE INDEX idx_production_facility ON production_log(facility_mgt_no);

-- ------------------------------------------------------------
--  haccp_cert : 스마트HACCP 인증 (getFoodList)
-- ------------------------------------------------------------
CREATE TABLE haccp_cert (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_mgt_no   TEXT REFERENCES facility(mgt_no) ON DELETE SET NULL,
  biz_name          TEXT NOT NULL,
  biz_addr          TEXT,
  cert_no           TEXT,
  cert_date         TEXT,
  ccp_list          TEXT,                   -- JSON string
  raw_payload       TEXT,                   -- JSON string
  updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_haccp_facility ON haccp_cert(facility_mgt_no);

-- ------------------------------------------------------------
--  sales_suspension : 회수·판매중지 (data.go.kr 15074318)
-- ------------------------------------------------------------
CREATE TABLE sales_suspension (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_mgt_no   TEXT REFERENCES facility(mgt_no) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  maker_name        TEXT,
  maker_addr        TEXT,
  reason            TEXT,
  method            TEXT,
  batch_mfg_date    TEXT,
  batch_exp_date    TEXT,
  barcode           TEXT,
  product_code      TEXT,
  image_url         TEXT,
  published_at      TEXT,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_suspension_facility ON sales_suspension(facility_mgt_no);
CREATE INDEX idx_suspension_published ON sales_suspension(published_at DESC);

-- ------------------------------------------------------------
--  watchlist : 관심업체
-- ------------------------------------------------------------
CREATE TABLE watchlist (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  facility_mgt_no   TEXT NOT NULL REFERENCES facility(mgt_no) ON DELETE CASCADE,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, facility_mgt_no)
);
CREATE INDEX idx_watchlist_user ON watchlist(user_id);

-- ------------------------------------------------------------
--  alerts : 관심업체 변동 알림
-- ------------------------------------------------------------
CREATE TABLE alerts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  facility_mgt_no   TEXT NOT NULL REFERENCES facility(mgt_no) ON DELETE CASCADE,
  alert_type        TEXT NOT NULL,          -- 'status_change' | 'suspension' | 'new_product'
  title             TEXT NOT NULL,
  detail            TEXT,
  ref_id            INTEGER,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  read_at           TEXT
);
CREATE INDEX idx_alerts_user_unread ON alerts(user_id, read_at) WHERE read_at IS NULL;

-- ------------------------------------------------------------
--  ingest_log : 배치 실행 이력
-- ------------------------------------------------------------
CREATE TABLE ingest_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset           TEXT NOT NULL,
  started_at        TEXT NOT NULL,
  finished_at       TEXT,
  rows_inserted     INTEGER DEFAULT 0,
  rows_updated      INTEGER DEFAULT 0,
  rows_deleted      INTEGER DEFAULT 0,
  status            TEXT,
  error_message     TEXT,
  window_begin      TEXT,
  window_end        TEXT
);
CREATE INDEX idx_ingest_dataset_date ON ingest_log(dataset, started_at DESC);
