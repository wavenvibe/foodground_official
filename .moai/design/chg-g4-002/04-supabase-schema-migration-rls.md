# 04. Supabase schema, migration and RLS design

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002
- Remote execution: PROHIBITED UNTIL USER APPROVAL

## 1. 대상과 안전 경계

- **설계 대상**: 신규 공식 Supabase 프로젝트 `glczrbadvfgmblmkpgfj` 전용
- **원격 실행**: 본 문서는 SQL 실행물이 아닌 승인 전 설계서이다. G3 승인 후 로컬 migration 파일 작성은 가능하다. 단, 원격 실행·데이터 적재·권한 변경은 사용자 명시적 승인 없이 수행하지 않는다.
- **기존 Supabase**: 레거시 유료 프로젝트는 조회 외 작업 금지 (TIPS 재현 환경 — 불변 참조).
- **현재 상태**: 신규 Supabase 프로젝트 `glczrbadvfgmblmkpgfj` 상태가 Codex 독립검토(G3-07-CODEX-REVIEW-v0.1.md B-05)에서 확인됐다.

## 2. 실제 현황 확인

| 확인 항목 | 현황 | 상태 |
|---|---|---|
| 신규 프로젝트 ID | glczrbadvfgmblmkpgfj | 확인됨 |
| 신규 프로젝트 지역 | Mumbai (ap-south-1) | 확인됨 — 추가비용 없이 사용 (서울 이전은 G5 실측 후 결정) |
| 컴퓨트 | nano | 확인됨 |
| 프로젝트 상태 | Healthy | 확인됨 |
| public 테이블/뷰 | 0개 | 확인됨 — 신규 적재 필요 |
| Auth 사용자 | 0명 | 확인됨 |
| Data API (PostgREST) | 활성 | 확인됨 |
| 기존 migration 파일 | supabase/ 폴더 존재 (미커밋) | 감사 완료 — Codex 프로토타입 가설, G3 승인 후 재작성 |

## 3. 논리 스키마 설계

### 3.1 public 스키마 테이블 목록

| 테이블/뷰 | 스키마 | 용도 | 예상 건수 | 갱신 방식 |
|---|---|---|---|---|
| facilities | public | 제조시설 마스터 | 94,723 | VS-2 1회 적재, 주기적 갱신 |
| recipes | public | 레시피 마스터 | 70,165 | VS-2 1회 적재 |
| ingredients | public | 식재료 마스터 | 18,933 | VS-2 1회 적재 |
| substitute_pairs | public | 대체 식재료 사전계산 쌍 | 234,955 | VS-2 1회 적재 |
| standard_foods | public | 표준 식재료 기준 686건 | 686 | VS-2 1회 적재 |
| ingredient_name_match | public | 입력명→기준식품 매칭 계보 (ingredient_matching.csv 파생, 미매칭 포함) | 23,806 | VS-2 1회 적재 |
| data_lineage | **private** | 적재 계보·버전 기록 (내부 전용, anon 비노출) | 소수 | VS-2 적재 시 삽입 |

**후속 범위 객체(Auth·저장·프로젝트·게시판·비밀문의·OCR·제품 1,047,894건)는 현재 설계에 포함하지 않는다.**

### 3.2 private 스키마 생성 DDL

```sql
-- private 스키마: 내부 운영 정보 보관 (PostgREST Data API에 자동 노출되지 않음)
CREATE SCHEMA IF NOT EXISTS private;
-- Supabase service-role만 접근 허용; anon·authenticated 역할에 GRANT 금지
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
```

### 3.3 data_lineage 테이블

```sql
-- data_lineage: 내부 계보 정보는 private 스키마에 보관 (B-06, B-08)
-- source_path (내부 파일 경로) 등 운영 내부 정보는 public 객체에 두지 않는다.
-- public 화면에는 승인된 basis_date와 publish_version만 노출한다.
CREATE TABLE private.data_lineage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name    TEXT NOT NULL,     -- 'facilities', 'substitute_pairs' 등
  source_path     TEXT,              -- final_output/ 하위 경로 (내부 전용)
  row_count       INTEGER,
  reject_count    INTEGER,
  basis_date      DATE,
  rule_version    TEXT,
  ingest_run_at   TIMESTAMPTZ DEFAULT now(),
  publish_version TEXT
);

-- public 화면용 최소 노출 뷰 (basis_date, publish_version만 공개)
CREATE VIEW public.data_lineage_public AS
  SELECT id, dataset_name, basis_date, publish_version
  FROM private.data_lineage;
```

### 3.4 facilities 테이블 DDL 의사코드

```sql
-- mgt_no: 원본 SQLite facility 테이블의 관리번호 (감사 확인됨, UUID 교체 금지)
-- email 컬럼: 원본 테이블에 없음 — public 객체에 포함하지 않음 (B-06)
CREATE TABLE public.facilities (
  mgt_no         TEXT PRIMARY KEY,   -- 원본 관리번호 (안정 식별자)
  name           TEXT NOT NULL,
  region_sido    TEXT,
  region_sigungu TEXT,
  business_type  TEXT,
  is_haccp       BOOLEAN,
  status         TEXT,               -- '영업', '폐업', '정지'
  -- product_types: Q-06 미결정 — 파생 원천 확정 후 컬럼 추가 예정 (현재 미구현, 07-risks §4 Q-06 참조)
  tel            TEXT,               -- 공개 전화번호 (있는 경우)
  homepage       TEXT,               -- 공개 홈페이지 URL (있는 경우)
  created_at     TIMESTAMPTZ DEFAULT now(),
  ingest_run_id  UUID REFERENCES private.data_lineage(id)
);

CREATE INDEX idx_facilities_name       ON public.facilities USING gin(to_tsvector('simple', name));
CREATE INDEX idx_facilities_region     ON public.facilities(region_sido, region_sigungu);
CREATE INDEX idx_facilities_business   ON public.facilities(business_type);
CREATE INDEX idx_facilities_status     ON public.facilities(status);
```

### 3.5 ingredient_name_match 테이블 DDL 의사코드

> **원천**: `ingredient_matching.csv` (23,806행) — match_type은 이 테이블이 소유. substitute_pairs에 두지 않음 (B-20).
> **선행 배치 이유**: ingredient_name_match는 대체 식재료 검색의 입력명 변환 계층이다. substitute_pairs 조회 전에 입력명 → 기준식품ID 변환을 처리하므로 substitute_pairs 앞에 배치한다.

```sql
-- ingredient_name_match: 입력명→기준식품 매칭 계보 (23,806건)
-- input_name: 사용자 입력명 또는 원본 레시피 식재료명 (유일 키)
-- standard_food_id: 매핑된 기준식품 ID (미매칭 행에서는 NULL)
-- match_type: exact | substring | fuzzy | synonym | unmatched
--   'unmatched' = ingredient_matching.csv에서 매칭 실패한 입력명 (11,224건 포함)
CREATE TABLE public.ingredient_name_match (
  input_name       TEXT PRIMARY KEY,  -- 입력 식재료명 (고유 검색 키)
  standard_food_id TEXT,              -- 매핑된 기준식품 ID (미매칭 시 NULL)
  match_type       TEXT NOT NULL      -- exact | substring | fuzzy | synonym | unmatched
    CHECK (match_type IN ('exact','substring','fuzzy','synonym','unmatched')),
  basis_date       DATE,
  ingest_run_id    UUID REFERENCES private.data_lineage(id)
);

-- 기준식품ID 역방향 조회 인덱스 (매칭 성공 행만 — NULL 제외)
CREATE INDEX idx_ingr_match_sfid ON public.ingredient_name_match(standard_food_id)
  WHERE standard_food_id IS NOT NULL;
```

### 3.6 substitute_pairs 테이블 DDL 의사코드

```sql
-- 기준식품ID / 후보식품ID: 원본 CSV의 실제 문자열 키 (UUID 교체 금지)
-- 6개 유사도 필드: food_pair_similarities.csv 실제 컬럼명 (B-02)
-- 2단계 가중계산: score_composite (Step1) + score_final (Step2)
-- B-20: 매칭방법(match_type)은 ingredient_matching 계층에 속함 — 이 테이블에 두지 않음
CREATE TABLE public.substitute_pairs (
  기준식품ID           TEXT NOT NULL,
  후보식품ID           TEXT NOT NULL,
  -- Step 1: 종합유사도 (영양성분·재료구분·식품군·조리상태 가중평균)
  sim_nutrition        NUMERIC(6,4),   -- 영양성분_유사도
  sim_ingredient_category NUMERIC(6,4), -- 재료구분_유사도
  sim_food_group       NUMERIC(6,4),   -- 식품군_유사도
  sim_cooking_state    NUMERIC(6,4),   -- 조리상태_유사도
  score_composite      NUMERIC(6,4),   -- 종합유사도 (Step 1 결과)
  -- Step 2: 최종유사도 = score_composite×0.70 + sim_dish_type×0.20 + sim_companion×0.10
  sim_dish_type        NUMERIC(6,4),   -- 요리종류_유사도
  sim_companion        NUMERIC(6,4),   -- 동반재료_유사도
  score_final          NUMERIC(6,4),   -- 최종유사도 (Step 2 결과)
  basis_date           DATE NOT NULL,  -- 2026-08-18
  ingest_run_id        UUID REFERENCES private.data_lineage(id),
  PRIMARY KEY (기준식품ID, 후보식품ID)
);

CREATE INDEX idx_sub_source ON public.substitute_pairs(기준식품ID, score_final DESC);
```

### 3.7 recipes 테이블 DDL 의사코드

> **VS-1 확정 조건**: 아래 UNKNOWN 항목은 VS-1 감사 완료 후 채워진다. UNKNOWN 상태에서는 recipes를 필수 API·UI 계약으로 요구하지 않는다.

```sql
-- recipes: 레시피 마스터 (70,165건)
-- 안정 식별자: UNKNOWN — VS-1에서 원본 파일 키 컬럼명 확인 필요 (recipe_id, id, 또는 기타)
-- 재료 연결 방식: UNKNOWN — ingredients 직접 참조 vs ingredient_name_match 경유 확인 필요
-- 공개 필드: name, category(UNKNOWN 컬럼명), ingredients_text(UNKNOWN 존재여부) 최소한 포함 예상
-- 검색키: 명칭 전문검색 (tsvector), 분류 필터
CREATE TABLE public.recipes (
  recipe_id      TEXT PRIMARY KEY,   -- UNKNOWN: VS-1에서 원본 키 컬럼명 확인
  name           TEXT NOT NULL,      -- 레시피명 (검색·정렬 기준)
  category       TEXT,               -- UNKNOWN: 분류 컬럼 존재여부·명칭 VS-1 확인
  -- ingredients_ref: UNKNOWN — 식재료 연결 방식 VS-1 확인 (배열? 조인 테이블? 텍스트?)
  basis_date     DATE,               -- 원본 데이터 기준일
  ingest_run_id  UUID REFERENCES private.data_lineage(id)
);

-- 검색 인덱스 (전문검색·분류 필터)
CREATE INDEX idx_recipes_name     ON public.recipes USING gin(to_tsvector('simple', name));
CREATE INDEX idx_recipes_category ON public.recipes(category);
-- 추가 인덱스: VS-1 확정 후 실제 컬럼명으로 조정
```

RLS: `CREATE POLICY "anon_read" ON public.recipes FOR SELECT TO anon USING (true);`
Staging: `staging_recipes` → UPSERT ON CONFLICT(recipe_id). 거부 건수 = 0 목표; 있으면 승인 사유 기록.
Rollback: `TRUNCATE staging_recipes;` (단계 2) / `REVOKE SELECT ON public.recipes FROM anon;` (단계 3)

### 3.8 ingredients 테이블 DDL 의사코드

> **VS-1 확정 조건**: 아래 UNKNOWN 항목은 VS-1 감사 완료 후 채워진다.

```sql
-- ingredients: 식재료 마스터 (18,933건)
-- 안정 식별자: UNKNOWN — VS-1에서 원본 키 컬럼명 확인 필요 (ingredient_id, id, 또는 기타)
-- 영양·단위 연결키: UNKNOWN — standard_foods 와의 조인 컬럼 VS-1 확인 필요
-- 검색키: 명칭 전문검색, 분류 필터
CREATE TABLE public.ingredients (
  ingredient_id  TEXT PRIMARY KEY,   -- UNKNOWN: VS-1에서 원본 키 컬럼명 확인
  name           TEXT NOT NULL,      -- 식재료명 (검색·정렬 기준)
  category       TEXT,               -- UNKNOWN: 분류 컬럼 존재여부·명칭 VS-1 확인
  -- standard_food_ref: UNKNOWN — standard_foods 연결 방식 VS-1 확인 (FK? 매핑 테이블?)
  -- nutrition_ref: UNKNOWN — 영양 정보 포함 여부·단위 컬럼 VS-1 확인
  basis_date     DATE,
  ingest_run_id  UUID REFERENCES private.data_lineage(id)
);

CREATE INDEX idx_ingredients_name     ON public.ingredients USING gin(to_tsvector('simple', name));
CREATE INDEX idx_ingredients_category ON public.ingredients(category);
-- 추가 인덱스: VS-1 확정 후 실제 컬럼명으로 조정
```

RLS: `CREATE POLICY "anon_read" ON public.ingredients FOR SELECT TO anon USING (true);`
Staging: `staging_ingredients` → UPSERT ON CONFLICT(ingredient_id). 거부 건수 = 0 목표.
Rollback: `TRUNCATE staging_ingredients;` / `REVOKE SELECT ON public.ingredients FROM anon;`

### 3.9 standard_foods 테이블 DDL 의사코드

> **원천 파일**: `final_output/reference_data/food_master.csv` (686건, VS-1에서 컬럼명 확인)

```sql
-- standard_foods: 표준 식품 기준 (686건)
-- 원천: food_master.csv — VS-1에서 실제 컬럼명·키 확인 필요
-- 영양 필드: UNKNOWN — VS-1에서 포함 영양소 종류·단위 확인 필요
CREATE TABLE public.standard_foods (
  standard_food_id  TEXT PRIMARY KEY,  -- UNKNOWN: VS-1에서 원본 키 컬럼명 확인 (food_id, id 등)
  name              TEXT NOT NULL,     -- 표준 식품명
  food_group        TEXT,              -- UNKNOWN: 식품군 분류 컬럼 VS-1 확인
  -- nutrition_*: UNKNOWN — 단위·필드명·포함 여부 VS-1에서 확인
  basis_date        DATE,
  ingest_run_id     UUID REFERENCES private.data_lineage(id)
);

CREATE INDEX idx_standard_foods_name ON public.standard_foods(name);
-- 추가 인덱스: VS-1 확정 후 식품군·영양 필드 인덱스 추가
```

RLS: `CREATE POLICY "anon_read" ON public.standard_foods FOR SELECT TO anon USING (true);`
Staging: `staging_standard_foods` → UPSERT ON CONFLICT(standard_food_id). 686건 정확 일치 확인.
Rollback: `TRUNCATE staging_standard_foods;` / `REVOKE SELECT ON public.standard_foods FROM anon;`

### 3.10 ingredient_name_match 조회 계약

> **원천**: `ingredient_matching.csv` (23,806행) — match_type은 이 테이블이 소유; DDL은 §3.5 참조. substitute_pairs에 두지 않음 (B-20).
> **용도**: 사용자 입력 식재료명 → 기준식품ID 변환 계층. 대체 후보 검색 진입점.

**조회 계약** (대체 후보 검색 진입 예시):
```sql
-- 1단계: 입력명 → standard_food_id 변환 (exact 우선, 없으면 substring)
-- match_type = 'unmatched'인 경우 standard_food_id는 NULL → 대체 후보 없음으로 처리
SELECT standard_food_id, match_type
FROM public.ingredient_name_match
WHERE input_name = :user_input
ORDER BY CASE match_type
  WHEN 'exact' THEN 1 WHEN 'synonym' THEN 2
  WHEN 'substring' THEN 3 WHEN 'fuzzy' THEN 4 ELSE 5
END
LIMIT 1;

-- 2단계: 변환된 기준식품ID로 substitute_pairs 조회 (standard_food_id가 NULL이 아닌 경우만)
SELECT * FROM public.substitute_pairs WHERE 기준식품ID = :standard_food_id
ORDER BY score_final DESC LIMIT 20;
```

- **provenance 표시 의무**: UI에서 match_type이 exact가 아닌 경우 출처 표시 필요 (52.85% 고유명 매칭 위험 — B-21)
- **미매칭 처리**: match_type = 'unmatched'이면 standard_food_id = NULL. UI에서 "대체 후보를 찾을 수 없습니다" 상태 표시.
- RLS: `CREATE POLICY "anon_read" ON public.ingredient_name_match FOR SELECT TO anon USING (true);`
- Staging: `staging_ingredient_name_match` → UPSERT ON CONFLICT(input_name). 23,806건 정확 일치 (미매칭 11,224건 포함).
- Rollback: `TRUNCATE staging_ingredient_name_match;` / `REVOKE SELECT ON public.ingredient_name_match FROM anon;`

## 4. 공개 조회와 RLS

### 4.1 RLS 기본 정책

```sql
-- 모든 테이블: anon 읽기 허용, 쓰기 금지
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON public.facilities
  FOR SELECT TO anon USING (true);

-- 동일 정책을 recipes, ingredients, substitute_pairs, standard_foods, ingredient_name_match에 적용 (§3.6~§3.9 참조)
```

### 4.2 공개 조회 런타임 보안 원칙 (B-06)

- **서버 사이드 anon 클라이언트**: Next.js Route Handler에서 `createServerSupabaseClient(anonKey)` 사용. service-role 키는 공개 런타임에서 사용 금지.
- **RLS가 행 접근 제어**: anon SELECT → RLS 정책 통과 후 허용. RLS는 컬럼 allowlist를 대신하지 않음.
- **컬럼 최소화**: public 객체에 tel, homepage만 포함. email 컬럼은 원본에 없으며 추가하지 않음.
- **내부 계보 정보 비공개**: source_path 등은 private.data_lineage에만 보관.
- **service-role 제한 범위**: VS-2 migration·적재·관리 작업 전용. 브라우저 번들·공개 Route Handler에 절대 포함 금지.
- **핵심 금지 원칙**: 공개 조회에 service-role 사용 금지 — anon 키 + RLS가 유일한 공개 접근 경로.

### 4.3 공개 뷰 vs 직접 테이블 노출 비교

| 방식 | 장점 | 단점 | 선택 |
|---|---|---|---|
| 직접 테이블 + RLS | 단순, PostgREST 자동 지원 | 컬럼 제어가 RLS로 불가 (행 제어만) | 기본 |
| 공개 뷰 | 필드 최소화 확실, 내부 컬럼 은닉 | 추가 DDL 관리 필요 | 민감 컬럼 제어 필요 시 사용 |

**결정**: 직접 테이블 + RLS. email이 원본에 없으므로 공개 뷰 필요성이 낮음. ingest_run_id는 공개 목록에서 불필요 시 뷰로 제어.

### 4.4 비공개 처리 필드

- 대표자 개인정보 (이름, 주민번호 등)
- 내부 운영 로그 (source_path, 분석 파이프라인 중간 변수) → private.data_lineage
- SQL 오류 상세, stack trace (공개 에러에 절대 노출 금지)

## 5. Migration 순서

| 단계 | 목적 | 입력 | 검증 | rollback | 사용자 승인점 |
|---:|---|---|---|---|---|
| 1 | 스키마 생성 및 staging 테이블 | DDL 의사코드 → 실제 migration 파일 | 테이블 존재 확인, 컬럼 타입 검증 | DROP TABLE IF EXISTS (staging 전용) | **사용자 원격 실행 승인** |
| 2 | 데이터 적재 및 검증 | analysis_outputs/ CSV/JSON → staging 테이블 | 건수·키·중복·결측·표본 대조 | TRUNCATE staging 후 재적재 | **건수 대조 후 사용자 확인** |
| 3 | 공개 권한·인덱스·RLS 활성화 | RLS 정책, 인덱스 DDL | anon 쿼리 응답 테스트, 속도 측정 | REVOKE SELECT ON ... FROM anon (권한 회수) | **사용자 최종 공개 승인** |

## 6. 적재·대조·백업·복구 설계

### 6.1 적재 전 사전 백업

- 신규 Supabase 프로젝트이므로 기존 데이터 없음 — 백업 대상 없음
- 단, 적재 전 빈 스키마 dump를 증빙으로 보존한다

### 6.2 Staging 적재 절차

1. analysis_outputs/ 파일에서 CSV/JSON 추출
2. staging_* 임시 테이블에 COPY/INSERT
3. 건수 검증: staging 건수 = 예상 기준선 정확 일치 (허용 편차 없음; 거부 건수가 있으면 승인된 사유와 건수 기록)
4. 키 중복 검증: UNIQUE constraint 위반 건수 = 0
5. 결측 검증: NOT NULL 컬럼 결측 건수 = 0
6. 표본 100건 수동 대조
7. SHA-256 파일 해시 기록 (계보 추적)

### 6.3 Publish (staging → public)

```sql
-- 멱등성 보장: INSERT ... ON CONFLICT DO UPDATE
INSERT INTO public.facilities SELECT * FROM staging_facilities
ON CONFLICT (mgt_no) DO UPDATE SET
  name = EXCLUDED.name,
  region_sido = EXCLUDED.region_sido,
  region_sigungu = EXCLUDED.region_sigungu,
  business_type = EXCLUDED.business_type,
  is_haccp = EXCLUDED.is_haccp,
  status = EXCLUDED.status,
  -- product_types = EXCLUDED.product_types,  -- Q-06 미결정: 파생 원천 확정 후 추가
  tel = EXCLUDED.tel,
  homepage = EXCLUDED.homepage,
  ingest_run_id = EXCLUDED.ingest_run_id;
```

### 6.4 Rollback 절차

```sql
-- 단계 1 rollback: staging 테이블만 제거 (운영 테이블 무조건 TRUNCATE 금지 — B-08)
DROP TABLE IF EXISTS staging_facilities, staging_recipes, staging_ingredients,
  staging_substitute_pairs, staging_standard_foods;

-- 단계 2 rollback: staging 재적재 (공개 테이블 미변경 시점에 적용)
TRUNCATE staging_facilities, staging_recipes, staging_ingredients,
  staging_substitute_pairs, staging_standard_foods;

-- 단계 3 rollback: 공개 권한 회수 (REVOKE SELECT 방식 사용 — RLS 끄기 금지, B-08)
REVOKE SELECT ON public.facilities FROM anon;
REVOKE SELECT ON public.recipes FROM anon;
REVOKE SELECT ON public.ingredients FROM anon;
REVOKE SELECT ON public.substitute_pairs FROM anon;
REVOKE SELECT ON public.standard_foods FROM anon;
-- 또는 공개 뷰 버전 전환으로 rollback (공개 뷰 사용 시)
```

재실행 시 모든 INSERT/UPSERT는 멱등성을 보장한다.

## 7. 용량·성능·비용

| 테이블 | 예상 행수 | 예상 크기 | 인덱스 수 |
|---|---:|---|---:|
| facilities | 94,723 | ~50 MB | 4 |
| recipes | 70,165 | ~30 MB | 2 |
| ingredients | 18,933 | ~10 MB | 2 |
| substitute_pairs | 234,955 | ~120 MB | 2 |
| standard_foods | 686 | ~1 MB | 1 |
| ingredient_name_match | 23,806 | ~5 MB | 2 |
| **합계** | **443,268** | **~216 MB** | |

- Supabase Pro 플랜 기준 Database 용량 8GB 이내 → 추가 비용 0원 예상
- 불확실: 인덱스 크기, PostgREST 캐시 설정 → VS-2 후 실측

## 8. SQL 설계 부록

본 섹션의 DDL은 의사코드(pseudo-code)이다. 실제 migration 파일은 사용자 VS-2 원격 실행 승인 후 생성한다.

- migration 파일 위치 (승인 후): `supabase/migrations/YYYYMMDD_chg_g4_002_init.sql`
- RLS 정책 파일: `supabase/migrations/YYYYMMDD_chg_g4_002_rls.sql`
- 시드 데이터: Supabase Dashboard 또는 psql COPY 명령 사용

## 완료 확인

- [x] 신규(glczrbadvfgmblmkpgfj)/원본 프로젝트 경계 명확
- [x] 신규 Supabase 상태 확인 반영: Healthy / Mumbai / nano / public 0개 / Auth 0명 / Data API 활성 (B-05)
- [x] 후속 객체 생성 금지 (Auth·저장·OCR·1,047,894건 등 제외)
- [x] facilities DDL: mgt_no TEXT PK, email 컬럼 없음, tel/homepage 포함 (B-06, B-07)
- [x] substitute_pairs DDL: 기준식품ID/후보식품ID TEXT PK, 실제 6개 유사도 필드, 2단계 점수 컬럼 (B-02, B-07)
- [x] data_lineage: source_path 등 내부 정보 private 스키마로 이동 (B-06, B-08)
- [x] service-role: VS-2 migration 전용 — 공개 런타임 사용 금지 명시 (B-06)
- [x] rollback: RLS 끄기 제거 → REVOKE SELECT 방식으로 교체 (B-08)
- [x] 건수 대조: ±1% 허용 제거 → 정확 건수 또는 승인된 거부 사유·건수 (B-08)
- [x] publish·RLS·인덱스·rollback 설계 완료
- [x] 적재 대조 및 멱등성 설계
- [x] 원격 실행 사용자 승인점 3개 명시
- [x] B-26: recipes·ingredients·standard_foods DDL 의사코드 추가 (§3.6~§3.8), UNKNOWN 항목 VS-1 확정조건 명시 (B-26)
- [x] B-26: ingredient_name_match 조회 계약 추가 (§3.9), match_type 소유권·provenance 표시 의무 명시 (B-26)
- [x] B-26: §3.1 테이블 목록에 ingredient_name_match 23,806건 추가 (B-26)
