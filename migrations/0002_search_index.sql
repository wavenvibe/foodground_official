-- ============================================================================
--  0002_search_index.sql — ILIKE 검색 가속용 pg_trgm GIN 인덱스
--  대상 DB : Supabase PostgreSQL (ap-northeast-2)
--  작성일  : 2026-05-20
--
--  배경
--    104만 행 production_log에서 ILIKE '%키워드%' 검색이 시퀀셜 스캔으로
--    돌아 statement_timeout(~8s)을 넘기며 서버 컴포넌트가 throw 함.
--    → pg_trgm + GIN 인덱스로 1~10ms 수준까지 단축.
--
--  적용 방법
--    Supabase Dashboard > SQL Editor 에 본 파일을 통째로 붙여넣고 RUN.
--    인덱스 빌드는 production_log 기준 약 30~90초 소요 (104만 행).
--    빌드 중 SELECT는 정상 동작, INSERT/UPDATE는 큐잉됨.
--    측정 기간(.freeze 활성)에는 실행 금지.
--
--  영향
--    · ILIKE '%xxx%' 쿼리가 시퀀셜 스캔 → 비트맵 인덱스 스캔으로 전환
--    · 저장공간 증가량 약 250 MB (3개 컬럼 × 약 80 MB)
--    · INSERT 속도 약 1.5~2배 느려짐 (배치 cron이라 무관)
-- ============================================================================

-- 1. pg_trgm 확장 활성화 (Supabase에 사전 설치되어 있음, 멱등)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ----------------------------------------------------------------------------
-- 2. production_log — 제품 검색 (메인 핫스팟)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_production_product_name_trgm
  ON production_log USING gin (product_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_production_category_trgm
  ON production_log USING gin (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_production_maker_name_trgm
  ON production_log USING gin (maker_name gin_trgm_ops);


-- ----------------------------------------------------------------------------
-- 3. facility — 업체 검색 (보조 핫스팟, /search 페이지)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_facility_name_trgm
  ON facility USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_facility_road_addr_trgm
  ON facility USING gin (road_addr gin_trgm_ops);


-- ----------------------------------------------------------------------------
-- 4. 통계 갱신 — 인덱스 즉시 활용되도록
-- ----------------------------------------------------------------------------
ANALYZE production_log;
ANALYZE facility;


-- ============================================================================
--  검증 쿼리 (선택, 적용 후 따로 실행해서 확인)
-- ============================================================================
-- EXPLAIN ANALYZE
--   SELECT report_no, product_name
--   FROM production_log
--   WHERE product_name ILIKE '%돼지국밥%'
--   LIMIT 20;
--
--   기대 결과: "Bitmap Index Scan on idx_production_product_name_trgm"
--   기대 시간: < 50 ms (예상 1~10 ms)
--
-- ============================================================================
