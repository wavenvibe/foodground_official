# CHG-G6-002 VS-E 공식 데이터·런타임 준비 감사

- 변경기준: CHG-G6-002 v0.1
- 감사일: 2026-08-30
- 정정일: 2026-08-30 (실제 전수 바이트 스캔으로 정정)
- 선행 상태: VS-A PASS / VS-B PASS / VS-C PASS / VS-D PASS
- 범위: 로컬 읽기전용 감사 — 원격 변경 없음

---

## 1. 데이터·용량 감사

### 1.1 원본 건수 재검증

건수는 SQLite 전수 집계 + `scripts/chg_g6_002_dryrun_validator.py` EXPECTED_COUNTS + migration 주석 기대값 대조.

| 원본 테이블 | 기대 건수 | 시설 연결 | 미연결 | 근거 |
|---|---:|---:|---:|---|
| production_log | 1,047,894 | 815,989 | 231,905 | SQLite COUNT + migration 0028 주석, validator line 81 |
| haccp_cert | 308 | 269 | 39 | SQLite COUNT + migration 0030 주석, validator line 153 |
| sales_suspension | 355 | 103 | 252 | SQLite COUNT + migration 0031 주석 (공개 103), validator line 169 |
| facility (기존) | 94,723 | — | — | validator line 81 |

공동제조 프로필은 CSV 기반:

| 파일 | 건수 | 바이트 | linked | ambiguous | unlinked | 근거 |
|---|---:|---:|---:|---:|---:|---|
| company_profiles.csv | 308 | 48,537 | — | — | — | stat + wc (309줄, 헤더 포함) |
| company_profile_facility_mapping.csv | 308 | 17,950 | 265 | 4 | 39 | stat + wc (309줄, 헤더 포함), grep count |

SQLite DB 파일 전체 크기: **484,986,880 바이트 (~462.6 MB)**

### 1.2 실제 텍스트 바이트 전수 측정

`length(CAST(COALESCE(column,'') AS BLOB))` 합계로 SQLite 원본 전수 측정. 아래는 **실측값**이다.

#### products_public 대상 컬럼 (전체 1,047,894행)

| 컬럼 | 실측 바이트 | 비고 |
|---|---:|---|
| report_no | 14,255,459 | PK |
| product_name | 24,198,873 | |
| category | 11,966,847 | |
| maker_name | 24,109,166 | |
| ingredients | 126,515,819 | 가변, TOAST 대상 |
| reported_at | 10,478,937 | TEXT 보존 |
| shelf_life_days | 0 | INTEGER, NULL 또는 0 |
| facility_mgt_no | 17,951,758 | FK nullable |
| updated_at | 19,909,986 | TEXT 보존 |
| **products_public 공개열 합계** | **249,386,845** | (~237.8 MB) |

미공개열:

| 컬럼 | 실측 바이트 | 비고 |
|---|---:|---|
| maker_addr | 0 | 원본에 데이터 없음 |

#### facility_products_public 중복 (시설 연결 815,989행)

| 항목 | 실측 바이트 | 비고 |
|---|---:|---|
| 연결행 공개열 합계 | 194,955,700 | (~185.9 MB) products_public과 동일 컬럼 이중 저장 |

#### haccp_certifications_public 대상 컬럼 (전체 308행)

| 컬럼 | 실측 바이트 | migration 공개열 |
|---|---:|---|
| facility_mgt_no | 5,918 | O |
| biz_name | 8,110 | O |
| cert_no | 3,388 | O |
| cert_date | 3,080 | O |
| ccp_list | 15,062 | O |
| updated_at (→source_updated_at) | 5,852 | O |
| **합계** | **41,410** | (~40.4 KB) |

#### facility_safety_public 대상 컬럼 (전체 355행, 공개 103행)

| 컬럼 | 실측 바이트 (전체 355행) | migration 공개열 |
|---|---:|---|
| facility_mgt_no | 2,266 | O (NOT NULL 조건으로 연결행만) |
| product_name | 7,889 | O |
| maker_name | 7,543 | O |
| reason | 15,025 | O |
| method | 12,002 | O |
| batch_mfg_date | 2,184 | O |
| batch_exp_date | 4,247 | O |
| barcode | 2,736 | O |
| product_code | 2,373 | O |
| image_url | 23,307 | O |
| published_at | 3,550 | O |
| created_at (→source_created_at) | 6,745 | O |
| **전체 합계** | **89,867** | (~87.8 KB) |
| **연결 103행 공개열 합계** | **28,034** | (~27.4 KB) |

### 1.3 PostgreSQL 적재 추정 — 실측값과 계산값 분리

아래에서 **실측**은 SQLite BLOB 바이트 전수 합계, **계산**은 PostgreSQL 행 오버헤드 공식 적용, **추정**은 인덱스 등 PG 적재 후에만 확정 가능한 값이다.

| 대상 테이블 | 행수 | 텍스트 (실측) | PG 행 오버헤드 (계산, ~40B/행) | 인덱스 (추정) | PG 적재 범위 (합산) |
|---|---:|---:|---:|---:|---:|
| products_public | 1,047,894 | 249.4 MB | ~42 MB | 160–260 MB ¹ | **450–550 MB** |
| facility_products_public | 815,989 | 195.0 MB (중복) | ~39 MB | ~80 MB | **300–380 MB** |
| haccp_certifications_public | 308 | 0.04 MB | <0.1 MB | <0.1 MB | <1 MB |
| facility_safety_public | 103 | 0.03 MB | <0.1 MB | <0.1 MB | <1 MB |
| manufacturing_profiles_public | 265 | <0.1 MB | <0.1 MB | <0.1 MB | <1 MB |
| private.company_profile_mapping | 308 | <0.1 MB | <0.1 MB | <0.1 MB | <1 MB |
| staging.production_log_raw | 1,047,894 | 249.4 MB ² | ~42 MB | ~30 MB | **300–350 MB** |
| staging (haccp+safety+profiles) | ~974 | <0.2 MB | <0.1 MB | <0.1 MB | <1 MB |
| **합계** | | | | | **1.05–1.28 GB** |

¹ gin 인덱스(product_name to_tsvector): 실측 불가, 100–200 MB 범위 추정. btree 3개 합계 ~60 MB.
² maker_addr=0, shelf_life_days=0이므로 products_public과 동일 텍스트량.

> **이전 보고 대비 변경**: 이전 보고서의 "1.5–2.1 GB"는 컬럼별 평균 바이트 가정(report_no ~20B, product_name ~30B 등)에 기반했다. 실측 결과 평균 바이트가 가정보다 작아(report_no 실측 avg 13.6B, product_name 실측 avg 23.1B 등) 총 추정이 **1.05–1.28 GB**로 감소했다.

### 1.4 products_public ↔ facility_products_public 중복 분석

**현황**: 815,989건이 products_public과 facility_products_public에 **동일 컬럼으로 이중 저장**되며 실측 중복 텍스트는 **194,955,700 바이트 (~185.9 MB)**, PG 적재 시 인덱스 포함 **300–380 MB**.

승인 설계를 임의 변경하지 않으며, 세 가지 선택지의 영향만 비교한다:

| 선택지 | 추가 용량 | 쿼리 | rollback | 비고 |
|---|---|---|---|---|
| **A. 현행 유지 (두 테이블)** | +300–380 MB | 시설 제품 조회 단순 WHERE | 현행 rollback 그대로 | 가장 단순, 적재 스크립트 두 번 실행 |
| **B. 경량 연결 테이블** (facility_mgt_no, report_no만) | +30–50 MB | JOIN 필요 — products_public과 결합 | 연결 테이블 DROP 후 products_public 보존 | 용량 절감 ~270–330 MB, 쿼리 1회 JOIN 추가 |
| **C. VIEW** (`SELECT * FROM products_public WHERE facility_mgt_no IS NOT NULL`) | 0 MB | 뷰 쿼리 — idx_products_public_facility 인덱스 활용 | DROP VIEW 한 줄 | 최소 용량, 뷰 성능은 인덱스 의존 |

> 참고: 0028의 `idx_products_public_facility` 부분 인덱스(`WHERE facility_mgt_no IS NOT NULL`)가 이미 존재하므로, 선택지 C의 VIEW 또는 직접 `products_public WHERE facility_mgt_no = ?` 쿼리는 이 인덱스를 활용할 수 있다. facility_products_public 없이도 동일 조회가 가능하다.

### 1.5 Supabase 잔여 용량

현재 신규 Supabase 프로젝트의 잔여 디스크 용량과 플랜 한도·초과단가는 **대시보드 확인 필요** — 자격증명 없이는 확인할 수 없다.

VS-F 적재 전 사용자가 확인해야 할 항목:

- Dashboard → Settings → Database → Disk usage
- 현재 플랜명, DB 총 용량 한도, 초과 시 과금 단가: **대시보드 확인 필요**
- 기존 VS-2 7개 테이블(facilities, recipes, ingredients 등) 기 적재분 차감 필요

---

## 2. Migration·보안·복구 감사

### 2.1 migration 0028–0033 컬럼·FK·RLS·ACL 대조

| # | 파일 | 대상 스키마 | FK | RLS | SELECT 부여 | INSERT/UPDATE/DELETE 차단 | PROHIBITED 주석 | 판정 |
|---|---|---|---|---|---|---|---|---|
| 0028 | public_products | public | facilities(mgt_no) DEFERRED, private.data_lineage(id) | O | anon, authenticated | anon, authenticated REVOKE | O | PASS |
| 0029 | facility_products_public | public | facilities(mgt_no), products_public(report_no), private.data_lineage(id) | O | anon, authenticated | anon, authenticated REVOKE | O | PASS |
| 0030 | haccp_certifications_public | public | facilities(mgt_no) DEFERRED, private.data_lineage(id) | O | anon, authenticated | anon, authenticated REVOKE | O | PASS |
| 0031 | facility_safety_public | public | facilities(mgt_no), private.data_lineage(id) | O | anon, authenticated | anon, authenticated REVOKE | O | PASS |
| 0032 | manufacturing_profiles_public | public | facilities(mgt_no), private.data_lineage(id) | O | anon, authenticated | anon, authenticated REVOKE | O | PASS |
| 0033 | company_profile_mapping + staging 4종 | private, staging | private.data_lineage(id) | 스키마 수준 차단 | REVOKE ALL | REVOKE ALL | O | PASS |

### 2.2 비공개 필드 차단 확인

| 비공개 필드 | 차단 위치 | 확인 |
|---|---|---|
| raw_payload | 0030 주석 "raw_payload EXCLUDED" — DDL에 미정의 | PASS |
| biz_addr | 0030 DDL 미정의, 0031 주석 "maker_addr excluded" | PASS |
| maker_addr | 0031 DDL 미정의, staging에만 존재 | PASS |
| ccp_vector | 0032 주석 "ccp_vector omitted" — staging.company_profiles_raw에만 보존 | PASS |
| candidate_count, needs_review | 0032 주석 "omitted from public" — private.company_profile_mapping에만 존재 | PASS |

### 2.3 실행순서·의존성

```
0020 (init_schemas: private, staging, data_lineage)
  └→ 0025 (facilities)
       ├→ 0028 (products_public) → 0029 (facility_products_public)
       ├→ 0030 (haccp_certifications_public)
       ├→ 0031 (facility_safety_public)
       └→ 0032 (manufacturing_profiles_public)
            └→ 0033 (private.company_profile_mapping + staging 4종)
```

0028은 0025(facilities)를 전제조건 guard에서 검증한다. 0029는 0028(products_public)을 전제조건으로 검증한다. 0033은 private/staging 스키마를 없으면 생성한다. 의존관계 순서 문제 없음.

### 2.4 rollback 감사

- 파일: `supabase/rollback/20260830_0028_0033_vs-a_g6_002_rollback.sql`
- BEGIN/COMMIT 트랜잭션 래핑: PASS
- 역순 DROP: 0032 → 0031 → 0030 → 0029 → 0028 → private.company_profile_mapping → staging 4종: PASS
- CASCADE 미사용: PASS (DROP TABLE IF EXISTS만 사용)
- 기존 VS-2 7개 테이블 보존: PASS (rollback에서 VS-A 테이블만 DROP)
- REMOTE EXECUTION PROHIBITED 주석: PASS
- 완료 검증 DO $$ 블록: PASS (information_schema 조회 후 RAISE NOTICE/WARNING)

### 2.5 migration 추가 감사 항목

#### 2.5.1 ILIKE 검색과 GIN to_tsvector 인덱스 불일치

현재 제품 검색 API(`app/api/products/route.ts`)는 `searchSourceProducts`를 통해 `product_name`, `category`, `maker_name`에 **ILIKE** 패턴 매칭을 사용한다. 0028의 `idx_products_public_name`은 `GIN to_tsvector('simple', product_name)` 인덱스다.

**판정**: GIN tsvector 인덱스는 `@@` 전문검색 연산자를 가속하며, ILIKE 패턴 매칭(`WHERE product_name ILIKE '%검색어%'`)을 **직접 가속하지 않는다**. VS-G에서 Supabase 런타임으로 전환할 때 ILIKE → `to_tsvector @@ to_tsquery` 변환이 필요하거나, ILIKE를 유지하려면 `pg_trgm` GIN 인덱스가 별도로 필요하다. 현 migration DDL 자체의 결함은 아니나, VS-G 쿼리 설계 시 인덱스 전략 결정 필요.

#### 2.5.2 facility_products_public 중복 테이블 대안

0028에 `idx_products_public_facility ON products_public(facility_mgt_no) WHERE facility_mgt_no IS NOT NULL` 부분 인덱스가 이미 존재한다. `SELECT * FROM products_public WHERE facility_mgt_no = ?` 쿼리는 이 인덱스를 사용하므로 **facility_products_public 없이도 동일 조회가 가능하다**.

**판정**: 기능적으로 중복 테이블이 불필요하다. §1.4 선택지 B(경량 연결)·C(VIEW)로 전환하면 ~300–380 MB 절감 가능. 이 결정은 VS-F 적재 전 사용자 승인 사항이다.

#### 2.5.3 staging → public 게시 SQL·실행기 부재

migration 0033에서 staging 스키마 4개 테이블(production_log_raw, haccp_cert_raw, sales_suspension_raw, company_profiles_raw)의 DDL만 존재한다. `INSERT INTO public.* SELECT FROM staging.*` 형태의 승격 SQL, 실행 스크립트, 또는 자동화 도구는 **미구현**이다.

**판정**: staging 테이블 구조는 정의되었으나 데이터 승격 경로가 없다. VS-F에서 설계·구현 필요.

### 2.6 결함 및 주의사항

| # | 항목 | 심각도 | 설명 |
|---|---|---|---|
| D-1 | 100만건 적재 중단·재개 메커니즘 미정의 | 중 | production_log 1,047,894건 적재 시 중간 실패 복구 절차가 migration/script에 없음. staging.production_log_raw에 ingest_run_id가 있으나 청크 단위 적재·재개 로직은 VS-F에서 설계 필요 |
| D-2 | 중복 실행 방지 | 중 | staging → public 승격 시 UPSERT/ON CONFLICT 절이 없으면 2회 실행으로 PK 중복 오류 발생. 적재 스크립트에서 처리 필요 |
| D-3 | facility_products_public FK 의존 순서 | 낮 | products_public(report_no) FK 때문에 products_public 적재 완료 후 facility_products_public 적재해야 함. 순서 위반 시 FK 제약 오류 |
| D-4 | ILIKE ↔ GIN tsvector 인덱스 불일치 | 낮 | §2.5.1 참조. VS-G 쿼리 설계에서 해결 필요 |
| D-5 | staging → public 승격 SQL 미구현 | 중 | §2.5.3 참조. VS-F에서 설계 필요 |

---

## 3. Vercel 런타임 감사

### 3.1 lib/source-db.ts 분석

| 항목 | 현황 | Vercel 영향 |
|---|---|---|
| 의존성 | `better-sqlite3` (native C++ addon) | Vercel Serverless/Edge에서 SQLite 네이티브 바인딩 사용 불가 |
| DB 연결 | `process.env.FOODGROUND_SOURCE_DB` → 로컬 파일 경로 | Vercel에 SQLite 파일 없음 — env var 미설정 시 null 반환 |
| fallback | `withSourceDb()` null 반환 → `sourceUnavailable()` 503 | Supabase fallback 코드 없음 |
| 함수 5개 | searchSourceProducts, getSourceProduct, getSourceFacilityEvidence, getSourceFacilitySummaries, listSourceProductCategories | 전부 `{ok:false}` FG_DATA_UNAVAILABLE 반환 |

### 3.2 lib/manufacturing-match.ts 분석

| 항목 | 현황 | Vercel 영향 |
|---|---|---|
| 의존성 | `node:fs` readFileSync | Vercel Serverless에서 파일 존재하지 않으면 ENOENT |
| 프로필 파일 | `03_공동제조 매칭 정확도(F1 SCORE)/03_테스트데이터셋/company_profiles.csv` | git 비추적 — Vercel 빌드에 포함 안 됨 |
| 매핑 파일 | `data/derived/chg-g6-002/company_profile_facility_mapping.csv` | git 비추적 — Vercel 빌드에 포함 안 됨 |
| `getManufacturingOptions()` | `readFileSync` 직접 호출, try/catch 없음 | CSV 없으면 **ENOENT throw** (catch 안 됨) |
| `matchManufacturingCandidates()` | try/catch 래핑 → `manufacturingUnavailable()` 503 | CSV 없으면 catch 후 503 반환 |

### 3.3 API/화면별 런타임 공백 매핑 (503 vs uncaught 구분)

| 화면/API | 파일 | 의존 | Vercel 결과 | 근거 | 필요한 Supabase 테이블 |
|---|---|---|---|---|---|
| GET /api/products | app/api/products/route.ts | source-db | **503 JSON** (제어됨) | outcome.ok 분기 → 503 응답 | products_public |
| GET /api/products/[reportNo] | app/api/products/[reportNo]/route.ts | source-db | **503 JSON** (제어됨) | outcome.ok 분기 → 503 응답 | products_public, haccp, safety |
| GET /api/facilities/[id]/products | app/api/facilities/[id]/products/route.ts | source-db | **503 JSON** (제어됨) | outcome.ok 분기 → 503 응답 | products_public |
| GET /api/facilities/[id]/haccp | app/api/facilities/[id]/haccp/route.ts | source-db | **503 JSON** (제어됨) | outcome.ok 분기 → 503 응답 | haccp_certifications_public |
| GET /api/facilities/[id]/safety | app/api/facilities/[id]/safety/route.ts | source-db | **503 JSON** (제어됨) | outcome.ok 분기 → 503 응답 | facility_safety_public |
| GET /api/manufacturing/candidates | app/api/manufacturing/candidates/route.ts | source-db + mfg-match | **503 JSON** (제어됨) | matchManufacturingCandidates try/catch | manufacturing_profiles_public + facilities |
| /products (페이지) | app/products/page.tsx | source-db | **StatePanel 경고** (제어됨) | outcome.ok 분기 + error.tsx 존재 | products_public |
| /products/[reportNo] (페이지) | app/products/[reportNo]/page.tsx | source-db | **StatePanel 경고** (제어됨) | outcome.ok 분기 + 상위 error.tsx | products_public + haccp + safety |
| /facilities/[id] (페이지) | app/facilities/[id]/page.tsx | source-db | **StatePanel 경고** (제어됨) | outcome.ok 분기 + error.tsx 존재 | facilities + products + haccp + safety |
| /manufacturing-brief (페이지) | app/manufacturing-brief/page.tsx | mfg-match | **uncaught ENOENT → 500** | getManufacturingOptions() throw, error.tsx 없음 | manufacturing_profiles_public |
| /manufacturing-candidates (페이지) | app/manufacturing-candidates/page.tsx | source-db + mfg-match | **StatePanel 경고** (제어됨) | matchManufacturingCandidates try/catch + outcome.ok 분기 | manufacturing_profiles_public + facilities |

**요약**:
- **제어된 503 JSON**: API 6개 — 모두 outcome.ok 분기로 FG_DATA_UNAVAILABLE 반환
- **제어된 StatePanel 경고**: 페이지 4개 (/products, /products/[reportNo], /facilities/[id], /manufacturing-candidates) — outcome.ok 분기 또는 try/catch
- **uncaught 500**: 페이지 1개 (/manufacturing-brief) — `getManufacturingOptions()`가 try/catch 없이 `readFileSync` 호출, CSV 부재 시 ENOENT throw, error.tsx 미정의

### 3.4 필요한 Supabase 런타임 쿼리 설계 (VS-G 구현 범위)

각 API가 source-db.ts/manufacturing-match.ts 대신 Supabase를 호출할 때 필요한 쿼리 계약:

| API | Supabase 쿼리 | 공개 컬럼 | 정렬 | 페이지네이션 |
|---|---|---|---|---|
| 제품 검색 | `products_public` WHERE product_name/category/maker_name ILIKE 또는 tsvector @@, facility_mgt_no =, is_haccp JOIN | report_no, product_name, category, maker_name, ingredients, shelf_life_days, facility_mgt_no, reported_at | reported_at DESC, report_no ASC | LIMIT/OFFSET max 50 |
| 제품 상세 | `products_public` WHERE report_no = ? + `haccp_certifications_public` WHERE facility_mgt_no + `facility_safety_public` WHERE facility_mgt_no | 위 + biz_name, cert_no, cert_date, ccp_list + safety 필드 | — | — |
| 시설 제품 | `products_public WHERE facility_mgt_no = ?` (idx_products_public_facility 인덱스 활용) 또는 `facility_products_public` | 제품 검색과 동일 | reported_at DESC, report_no ASC | LIMIT 12 (미리보기) |
| 시설 HACCP | `haccp_certifications_public` WHERE facility_mgt_no | biz_name, cert_no, cert_date, ccp_list | cert_date DESC | — |
| 시설 안전 | `facility_safety_public` WHERE facility_mgt_no | 전 공개 컬럼 (maker_name, source_created_at 포함) | published_at DESC | LIMIT 20 |
| 제조 후보 | `manufacturing_profiles_public` WHERE item_set 포함 + `facilities` JOIN | company_id, company_name, facility_mgt_no, item_set, ccp_set_std, has_cooking_ccp, has_sterilize_ccp, sido, match_basis | verdict 정렬 (앱 로직) | LIMIT 30–50 |
| 제조 옵션 | `manufacturing_profiles_public` GROUP BY item, region | item_set, sido | count DESC | — |

> **인덱스 전략 결정 필요** (§2.5.1): 현재 ILIKE 검색을 유지하려면 `pg_trgm` GIN 인덱스가 필요하고, tsvector 검색으로 전환하면 0028의 기존 GIN 인덱스를 활용할 수 있다. VS-G 설계 시 결정.

---

## 4. 후속 실행 분리

### VS-F: 데이터 migration·staging 적재·검증·게시·rollback 패키지

| 단계 | 내용 | 승인점 |
|---|---|---|
| F-1 | Supabase 대시보드 잔여 용량 확인 + 중복 저장 결정 (현행 A / 경량 B / VIEW C) | 사용자 승인 |
| F-2 | 적재 스크립트 작성 (청크 단위, idempotent UPSERT, ingest_run_id 추적) + staging→public 승격 SQL | 코드 리뷰 |
| F-3 | staging 적재: CSV/SQLite → staging 테이블 | 건수 대조 후 승인 |
| F-4 | staging → public 승격: 검증 쿼리 + 공개열 대조 + FK 정합성 | 검증 증빙 후 승인 |
| F-5 | rollback dry-run: 승격 결과를 rollback으로 되돌리고 VS-2 테이블 무영향 확인 | 확인 후 본 적재 승인 |

**선후관계**: F-1(용량 확인) → F-2(스크립트 + 승격 SQL) → F-3(staging) → F-4(승격) → F-5(rollback 검증)

### VS-G: 공식 Supabase 런타임 fallback

| 단계 | 내용 | 승인점 |
|---|---|---|
| G-1 | `lib/supabase-products.ts` 작성: Supabase JS로 products_public 조회 | 코드 리뷰 |
| G-2 | `lib/supabase-manufacturing.ts` 작성: manufacturing_profiles_public 조회 | 코드 리뷰 |
| G-3 | 각 API route에 source-db → supabase 라우팅 (env 기반 전환 또는 supabase 전용) + ILIKE/tsvector 인덱스 전략 결정 | 코드 리뷰 |
| G-4 | /manufacturing-brief error 처리 보완 + 검색·페이지네이션·정렬·오류 상태 통합 테스트 | QA 증빙 후 승인 |
| G-5 | Vercel Preview 배포 + 실데이터 검증 | 사용자 검토 후 승인 |

**선후관계**: VS-F 완료(데이터 존재) → G-1~G-2(쿼리 구현) → G-3(라우팅) → G-4(테스트) → G-5(배포)

### 전체 순서

```
VS-E (본 감사, 정정 완료)
  → VS-F (데이터 적재) — Supabase 자격증명 + 용량 확인 필요
    → VS-G (런타임 전환) — VS-F 완료 후
      → 원격 QA + 사용자 검토
```

---

## 5. 사용자 확인·결정 항목

| # | 항목 | 유형 | 시점 |
|---|---|---|---|
| U-1 | Supabase 대시보드에서 현재 DB 용량·플랜 한도·초과단가 확인 | 확인 | VS-F 시작 전 |
| U-2 | 중복 저장 결정: 선택지 A(현행) / B(경량 연결) / C(VIEW) | 결정 | VS-F F-1 |
| U-3 | 적재 스크립트 실행 환경 결정 (로컬 직접 / GitHub Actions / Supabase CLI) | 결정 | VS-F F-2 |
| U-4 | staging 적재 후 건수 대조 결과 승인 | 승인 | VS-F F-3 |
| U-5 | public 승격 후 검증 결과 승인 | 승인 | VS-F F-4 |
| U-6 | ILIKE 유지 vs tsvector 전환 결정 (인덱스 전략) | 결정 | VS-G G-3 |
| U-7 | Vercel 환경변수 설정 (SUPABASE_URL, SUPABASE_ANON_KEY) | 실행 | VS-G G-5 |
| U-8 | Vercel Preview 배포 및 실데이터 검증 | 승인 | VS-G G-5 |

---

## 6. 검증 방법 기록

- 건수: SQLite 전수 `COUNT(*)` + dryrun_validator EXPECTED_COUNTS + migration 주석 대조
- 텍스트 바이트: SQLite `SUM(length(CAST(COALESCE(column,'') AS BLOB)))` 전수 집계 (스크립트: `output/claude-bridge/_audit_scan.py`, 실행 후 삭제)
- 컬럼 계약: migration DDL 공개열과 스캔 스크립트 컬럼 목록 1:1 대조 (HACCP biz_name, Safety maker_name·source_created_at 포함)
- PG 적재 추정: 텍스트(실측) + 행 오버헤드(계산, tuple header ~23B + alignment ~8B + pointer ~4B ≈ ~40B/행) + 인덱스(추정) 분리 표기
- RLS/ACL: 각 migration 파일 ENABLE ROW LEVEL SECURITY + CREATE POLICY + GRANT/REVOKE 직접 확인
- FK 의존: migration 전제조건 guard DO $$ 블록 + 의존 테이블 존재 확인 (data_lineage → 0020)
- rollback: BEGIN/COMMIT + DROP TABLE IF EXISTS 역순 + CASCADE 미사용 + 검증 DO $$ 확인
- 런타임 공백: source-db.ts withSourceDb() null 반환 경로 + manufacturing-match.ts readFileSync 경로 추적 + try/catch 유무 코드 확인
- 매핑 분포: company_profile_facility_mapping.csv grep count (linked=265, ambiguous=4, unlinked=39)
- Vercel 구분: API route outcome.ok 분기(503 JSON), 페이지 outcome.ok 분기(StatePanel), getManufacturingOptions throw 경로(uncaught 500) 코드 확인
- Supabase 플랜·용량: 자격증명 없이 확인 불가 → "대시보드 확인 필요"로 정정, 검증되지 않은 수치 삭제

---

## 7. 정정 이력

| 항목 | 이전 값 | 정정 값 | 사유 |
|---|---|---|---|
| 텍스트 바이트 | 컬럼별 평균 바이트 가정 (~270B/행) | SQLite BLOB 전수 실측 (avg ~238B/행) | 가정 기반 → 실측 기반 |
| PG 적재 추정 | 1.5–2.1 GB (가정 일체) | 1.05–1.28 GB (실측+계산+추정 분리) | 실측값 반영 + 가정·추정 명시 분리 |
| 중복 추정 | +400–550 MB | +300–380 MB (실측 195 MB + PG 오버헤드) | 실측 텍스트 반영 |
| HACCP 공개열 | biz_name 누락 | biz_name 8,110B 포함 | migration 0030 DDL 대조 |
| Safety 공개열 | maker_name, created_at 누락 | maker_name 7,543B, created_at 6,745B 포함 | migration 0031 DDL 대조 |
| Supabase 플랜 | "Pro 8GB", "$0.125/GB/월" 단정 | "대시보드 확인 필요" | 검증되지 않은 수치 삭제 |
| Vercel 결과 | 11개 전부 503 | 503 JSON 6개 + StatePanel 4개 + uncaught 500 1개 구분 | 코드상 try/catch·error.tsx 유무 확인 |
| 인덱스 불일치 | 미기록 | ILIKE↔GIN tsvector 불일치 §2.5.1 | 0028 DDL과 현 검색 쿼리 대조 |
| 중복 테이블 대안 | 미기록 | idx_products_public_facility로 동일 조회 가능 §2.5.2 | 0028 DDL 인덱스 확인 |
| staging 승격 | 미기록 | SQL·실행기 미구현 §2.5.3 | 0033 DDL만 존재, 승격 경로 없음 |

---

## 판정

**VS-E 감사 PASS — actual scan corrected** — SQLite 전수 바이트 실측으로 용량 추정 정정. migration·보안·rollback 계약에 차단 결함 없음. Vercel 런타임 공백 11개 식별(503 6개 + StatePanel 4개 + uncaught 500 1개). ILIKE↔tsvector 인덱스 불일치·중복 테이블 대안·staging 승격 미구현 식별. 후속 VS-F(적재)·VS-G(런타임 전환)의 범위·순서·승인점 정의 완료. 원격 실행은 사용자 승인 전 금지.

---

## 8. VS-G Read-Only Readiness Supplement (CHG-G6-002-G4-VS-G-016)

- 추가일: 2026-08-31
- 정정일: 2026-08-31 (독립 재현된 공식프로젝트 읽기전용 통계 + 실제원본 dry-run 증거 반영)
- 범위: 원격 읽기전용 감사 — Supabase CLI 메타데이터·db-stats·백업·연결 수집 + 실제원본 dry-run + 로컬 재검증 + 승인 A/B/C 실행계획 감사
- 원격 변경: **0건** (조회 명령만 실행)

### 8.1 Supabase CLI 메타데이터 (검증된 사실)

| 항목 | 값 | 출처 |
|---|---|---|
| 프로젝트 상태 | ACTIVE_HEALTHY | `npx supabase projects list` JSON |
| 리전 | ap-south-1 | `npx supabase projects list` JSON |
| PostgreSQL 버전 | 17.6.1.105 (PG 17, GA) | `supabase/.temp/postgres-version` |
| 연결 풀러 호스트 | pooler.supabase.com:5432 (ap-south-1) | `supabase/.temp/pooler-url` |
| 로컬 링크 상태 | linked=true (이 저장소에 연결) | `supabase/.temp/linked-project.json` + projects list |
| Supabase CLI 버전 | 2.116.0 | `npx supabase --version` |
| 레거시 프로젝트 | linked=false, 별도 리전, 이 저장소에 연결되지 않음 | projects list에서 확인 |

### 8.1.1 데이터베이스 통계 (검증된 사실)

`supabase inspect db db-stats --linked` 결과:

| 항목 | 값 |
|---|---|
| 데이터베이스 크기 | 561 MB |
| 총 테이블 크기 | 227 MB |
| 총 인덱스 크기 | 322 MB |
| 감사시점 WAL 크기 | 672 MB |
| 테이블 히트율 | 1.00 |
| 인덱스 히트율 | 1.00 |

`supabase inspect db table-sizes --linked`: 기존 VS-2 public/staging 데이터셋이 현재 주요 relation을 차지하며 공존 중. 총 테이블 크기 227 MB.

### 8.1.2 백업 상태 (검증된 사실)

`supabase backups list --project-ref <linked-ref>` 결과:

| 항목 | 값 |
|---|---|
| 최근 물리 백업 수 | 7건 |
| 백업 상태 | 전부 COMPLETED |
| PITR 활성화 | **false** (비활성) |
| WAL-G 활성화 | true |

**판정**: 일일 물리 백업 가용성 **검증됨**. PITR은 **비활성**. 복원 테스트는 수행하지 않았으며 수행되었다고 주장하지 않는다. 승인 A/B 직전에 최근 COMPLETED 물리 백업이 존재하는지 재확인 **필수**.

### 8.1.3 연결 한도 (검증된 사실)

`supabase inspect db role-connections --linked` 결과:

| 항목 | 값 |
|---|---|
| 데이터베이스 역할 연결 한도 | 60 |
| 감사시점 활성 연결 | 저단위(low single-digit) 관리/로그인/풀 연결만 |

**판정**: 데이터베이스 역할 연결 한도 60과 감사시점 저사용량 **검증됨**. 단, 이는 Supavisor 클라이언트 풀 크기 설정의 증거가 **아니다**. Supavisor 풀 크기는 대시보드에서만 확인 가능하며, 아래 D-5로 유지한다. 적재기는 DB 세션 1개를 사용하므로 컴퓨트 크기를 이 결과에서 추론하지 않는다.

### 8.1.4 실제원본 읽기전용 Dry-Run (검증된 사실)

Python 3.11 실제원본 읽기전용 dry-run 결과:

| 원본 테이블 | 건수 |
|---|---|
| production_log | 1,047,894 |
| haccp | 308 |
| suspension | 355 |
| company profiles | 308 |
| mapping | 308 |
| facility | 94,723 |
| facility-products (expected) | 815,989 |

- FK orphans: **0**
- Source size/mtime: **invariant** (변경 없음 확인)
- 접근 모드: **mode=ro**, **query_only** confirmed
- 원본 경로, 핑거프린트, raw row는 보고서에 포함하지 않음

**판정**: 실제원본 dry-run **PASS** — 이전 건수 기대값과 정확히 일치하며 FK 정합성 0 orphan 확인.

### 8.2 공식 정책 교차검증 (Official Policy Cross-Check, 2026-08-31)

#### 8.2.1 플랜 티어 (D-1 해소)

**Pro (사용자 제공 대시보드 UI 증거)**. CLI 증거가 아닌, 사용자가 대시보드 UI에서 직접 확인한 정보.

#### 8.2.2 디스크 용량 정책 (D-2 재구성, D-3 일반 정책 해소)

공식 Supabase 문서(2026-08-31 확인)에 따른 Pro 플랜 정책 기준선:

| 항목 | 공식 정책 |
|---|---|
| 포함 디스크 | 프로젝트당 **8 GB 범용(gp3) 디스크** |
| 초과 과금 | 프로비저닝 디스크 **USD 0.125/GB/월** |
| 자동 확장 | 사용률 90% 시 50% 확장, 24시간 내 최대 4회 |
| 대량 임포트 주의 | 1.5배 이상 임포트 시 수동 디스크 검토 선행 권고 |
| DB 크기 vs 디스크 | 별개 개념 — 디스크에는 WAL, 시스템 파일 포함 |
| 일일 백업 | Pro: 최근 7일 보존. PITR은 유료 애드온 (현재 비활성) |

**공식 문서 출처**:
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/manage-your-usage/disk-size
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/pricing

**대시보드 확인 완료 (018 사용자 제공 증거)**:
- 리사이즈 전 실제 디스크: **4 GB** provisioned, **1.65 GB** used (정책 기준선 8 GB는 포함 할당 상한이며, 실제 할당은 4 GB였음)
- 사용자가 대시보드에서 **4 GB → 8 GB** 리사이즈 실행 (Pro 포함 할당 이내, 디스크 초과 과금 없음)
- **Spend Cap**: 활성화 (초과 과금 차단)
- 리사이즈 후 예상 여유: ~6.35 GB (>= 2.5 GB 안전 임계값 **PASS**)
- 롤링 디스크 수정 한도: 약 4시간 잔여 시점에서 도달. Approval A/B에 추가 디스크 변경 불필요
- 컴퓨트: **Nano**, 변경 없음 (Micro 적용 주장하지 않음)
- 백업: **7개** 복원 가능한 일일 물리 백업. PITR 비활성. 복원 테스트 미수행

> **>=2.5 GB 잔여 여유 pre-B 규칙 PASS**: 리사이즈 후 8 GB 중 ~1.65 GB 사용, 여유 ~6.35 GB.

### 8.3 사용자 복귀 체크리스트 (018 갱신: Approval A 완료)

Approval A 실행 전 사용자 대시보드 확인 결과 (사용자 제공 증거):

| # | 항목 | 결과 |
|---|---|---|
| RC-1 | 실제 프로비저닝된 디스크 / 현재 사용률 / 디스크 유형 | 4 GB → **8 GB 리사이즈** (1.65 GB used, gp3), 여유 ~6.35 GB |
| RC-2 | Spend Cap 상태 및 초과 과금 허용 여부 | **Spend Cap 활성** (초과 과금 차단) |
| RC-3 | 컴퓨트 크기 | **Nano**, 낮은 CPU, 보통 메모리, 낮은 연결. 변경 없음 |
| RC-4 | COMPLETED 물리 백업 확인 | **7건** 복원 가능 일일 물리 백업, PITR 비활성 |

> **018 갱신**: 4개 항목 모두 사용자 대시보드 UI 증거로 확인 완료. Approval A PASS.

### 8.4 저장 용량 시나리오 (보수적 재계산)

#### 8.4.1 현재 검증된 데이터베이스 풋프린트

| 항목 | 값 | 출처 |
|---|---|---|
| 데이터베이스 크기 | 561 MB | db-stats |
| 총 테이블 크기 | 227 MB | db-stats |
| 총 인덱스 크기 | 322 MB | db-stats |
| 감사시점 WAL 크기 | 672 MB | db-stats |

#### 8.4.2 예상 영구 증분 풋프린트

가정:
- 텍스트 바이트: VS-E §1.2 SQLite 전수 실측값 사용
- PG 행 오버헤드: ~40B/행 (tuple header 23B + alignment 8B + pointer 4B + null bitmap ~5B)
- 인덱스: btree ~60 MB (3 btree on products_public), GIN tsvector ~100-200 MB 범위 추정
- VIEW(선택지 C): facility_products_public는 VIEW이므로 별도 저장 0 MB
- staging: publish 후 TRUNCATE하면 0, 보존하면 ~320 MB

| 시나리오 | staging 보존 | 증분 추정 | 가정 |
|---|---|---|---|
| **Low** (staging TRUNCATE 후) | 아니오 | **~0.55 GB** | products_public 텍스트 249 MB + 오버헤드 42 MB + 인덱스 160 MB + 소형테이블 3 MB + WAL/headroom 100 MB |
| **Base** (staging 보존) | 예 | **~0.88 GB** | Low + staging.production_log_raw ~320 MB |
| **High** (staging + 인덱스 상한) | 예 | **~1.08 GB** | Base + GIN 상한 200 MB vs 100 MB 차이 |

#### 8.4.3 적재 후 예상 데이터베이스 크기

현재 561 MB + 증분:

| 시나리오 | 적재 후 예상 크기 | 비고 |
|---|---|---|
| **Low** | ~1.11 GB | 일시적 load/publish WAL 및 vacuum 오버헤드 제외 |
| **Base** | ~1.44 GB | 일시적 load/publish WAL 및 vacuum 오버헤드 제외 |
| **High** | ~1.64 GB | 일시적 load/publish WAL 및 vacuum 오버헤드 제외 |

#### 8.4.4 최소 잔여 디스크 여유 권고

> **정정**: 이전 권고는 1.5 GB 잔여 용량이었다. 현재 WAL이 이미 672 MB이고 두 차례 벌크 쓰기 단계(staging load + publish)가 계획되어 있으므로 이전 권고는 **충분히 보수적이지 않다**.

**필수 pre-B 권고: 최소 2.5 GB 잔여 디스크 여유** — 이는 안전 임계값이며, Supabase 플랜 한도를 주장하는 것이 아니다. 근거:
- High 시나리오 영구 증분: ~1.08 GB
- 일시적 WAL 급증 (staging load + publish 두 단계): WAL이 672 MB 수준에서 추가 급증 가능
- vacuum/autovacuum 오버헤드: dead tuple 처리 시 일시적 팽창
- 안전 마진: 예측 불확실성 (GIN 인덱스 크기, TOAST 압축률)

> **주의**: Supabase 플랜 한도를 알 수 없으므로 PASS/FAIL 판정은 불가. 사용자가 D-1~D-3을 확인한 후에만 용량 적합성을 확정할 수 있다. 대시보드 디스크 한도 확인은 승인 A 진입 전 필수.

### 8.5 승인 A/B/C 실행 시퀀스 감사

#### 승인 A: DDL Migration (0028-0034)

| 단계 | 명령 | 대상 | 검증 |
|---|---|---|---|
| A-1 | `npx supabase db push` | 공식 프로젝트 (linked ref) | 7개 migration 순차 적용 |
| A-2 | 전제조건 guard | 0020(init_schemas), 0025(facilities) | DO $$ 블록에서 존재 확인, 실패 시 RAISE EXCEPTION으로 중단 |
| A-3 | RLS/ACL 적용 | 0028-0032 | ENABLE RLS + CREATE POLICY + GRANT SELECT + REVOKE INSERT/UPDATE/DELETE |
| A-4 | VIEW 생성 | 0029 | CREATE OR REPLACE VIEW + security_invoker=true |
| A-5 | private/staging 스키마 | 0033-0034 | REVOKE ALL FROM anon, authenticated, PUBLIC |

**승인 A 중단 조건**:
- 전제조건 guard 실패 (0020/0025 부재)
- `db push` 비영 종료코드
- 대상 ref가 linked project ref와 불일치

**승인 A 실패 시 rollback**: `supabase/rollback/20260830_0028_0033_vs-a_g6_002_rollback.sql` — 역순 DROP VIEW/TABLE, CASCADE 미사용, VS-2 7개 테이블 보존

#### 승인 B: Staging Load

| 단계 | 명령 | 대상 | 기대 건수 |
|---|---|---|---|
| B-1 | `chg_g6_002_staging_loader.py` (live) | staging.production_log_raw | 1,047,894 |
| B-2 | (동일) | staging.haccp_cert_raw | 308 |
| B-3 | (동일) | staging.sales_suspension_raw | 355 |
| B-4 | (동일) | staging.company_profiles_raw | 308 |
| B-5 | (동일) | private.company_profile_mapping | 308 |

**승인 B 안전장치**:
- DSN validate_dsn(): pooler/direct 형식만 허용, 레거시 호스트 거부
- Source DB: `mode=ro` + `PRAGMA query_only=ON`
- Source fingerprint SHA-256 일관성 검증
- Advisory lock으로 동시 실행 방지
- 청크 단위 커밋 + checkpoint 재개
- `_assert_target_empty()` fresh load 전 빈 테이블 확인
- `_verify_target_count()` 완료 전 건수 대조
- TLS 강제

**승인 B 중단 조건**:
- DSN 검증 실패
- Source fingerprint 불일치 (재개 시)
- Advisory lock 충돌
- 건수 불일치
- Source 파일 mtime/size 변경

**승인 B 실패 시 rollback**: staging 테이블 TRUNCATE + checkpoint 'failed' 기록. 재실행은 `--resume`으로 checkpoint에서 재개.

#### 승인 C: Publish + Verify

| 단계 | 명령 | 대상 |
|---|---|---|
| C-1 | `chg_g6_002_publish.sql` | staging → public 4개 테이블 atomic TRUNCATE+INSERT |
| C-2 | `chg_g6_002_verify.sql` | 건수/PK/FK/VIEW/RLS/ACL/pg_policies 검증 |
| C-3 | Data API smoke test | anon SELECT 성공 + INSERT/UPDATE/DELETE 차단 |

**승인 C 중단 조건**:
- publish TRUNCATE+INSERT 트랜잭션 실패
- verify SQL RAISE EXCEPTION (건수, PK, FK, RLS, ACL 위반)
- anon 쓰기 시도 성공 (보안 위반)

**승인 C 실패 시 rollback**:
- 데이터만: `chg_g6_002_publish_rollback.sql` (TRUNCATE, DROP 아님)
- 스키마 포함: 전체 rollback SQL

### 8.6 Rollback 결정표

| 실패 지점 | 영향 | rollback 범위 | 명령 |
|---|---|---|---|
| 승인 A 중 migration 실패 | DDL 부분 적용 | 전체 schema rollback | `20260830_0028_0033_vs-a_g6_002_rollback.sql` |
| 승인 B 중 staging load 실패 | staging 부분 적재 | checkpoint 'failed' → `--resume` 재개 또는 staging TRUNCATE | loader `--resume` 또는 수동 TRUNCATE |
| 승인 B 후 건수 불일치 | staging 완료 but 불량 | staging TRUNCATE + 재적재 | 수동 TRUNCATE → loader 재실행 |
| 승인 C 중 publish 실패 | public 부분 갱신 | publish_rollback (data TRUNCATE) → B 재시도 | `chg_g6_002_publish_rollback.sql` |
| 승인 C 후 verify 실패 | public 데이터 불량 | publish_rollback → 원인 분석 → B/C 재시도 | `chg_g6_002_publish_rollback.sql` |
| 승인 C 후 보안(RLS/ACL) 위반 | 공개 데이터 노출 위험 | **즉시** 전체 rollback (schema + data) | 전체 rollback SQL |
| 전체 철회 | 모든 G6-002 객체 제거 | 전체 schema rollback, VS-2 보존 | 전체 rollback SQL |

### 8.7 레거시 프로젝트 격리 검증

| 검증 항목 | 결과 | 근거 |
|---|---|---|
| 레거시 ref가 migration/script에 없음 | PASS | Grep 전수 스캔: 0 matches |
| 레거시 ref가 이 저장소에 linked=false | PASS | `npx supabase projects list` JSON |
| validate_dsn()이 레거시 호스트 거부 | PASS | 레거시 호스트는 승인 패턴 불일치로 거부 |
| PowerShell URI template이 scheme 검증 | PASS | 테스트 67/67 PASS 중 DSN 관련 10개 포함 |
| Supabase CLI `db push`는 linked ref만 대상 | PASS | config에 공식 linked ref 연결, 레거시 미연결 |
| migration/script에 개인 경로·비밀 없음 | PASS | Grep 스캔: 0 matches |

### 8.8 Python 3.11 로컬 재검증 결과 (2026-08-31)

| # | 검증 | 결과 |
|---|---|---|
| 1 | py_compile (7 scripts) | PASS |
| 2 | unittest (67 tests) | PASS (Ran 67 tests in 0.054s) |
| 3 | Staging loader --dry-run | PASS (fail-closed: FOODGROUND_SOURCE_DB not set) |
| 4 | Preflight --dry-run | PASS (0 errors, linked ref confirmed) |
| 5 | Comprehensive validator (13 sections) | PASS (0 errors, SQLite checks skipped — source DB not in env) |
| 6 | PowerShell AST parse | PASS (0 parse errors) |
| 7 | git diff --check | PASS (CRLF warnings only) |
| 8 | Document register | PASS (QA doc exists) |
| 9 | Secret/personal-path scan | PASS (0 findings in 21+ files) |
| 10 | Legacy project ref scan | PASS (0 matches) |
| 11 | 실제원본 읽기전용 dry-run (Python 3.11) | PASS (건수 일치, FK orphan 0, mode=ro, query_only, source invariant) |

### 8.8.1 감사에 사용된 원격 읽기전용 명령 목록

| # | 명령 | 유형 |
|---|---|---|
| 1 | `npx supabase projects list` | 읽기전용 메타데이터 |
| 2 | `npx supabase --version` | 읽기전용 메타데이터 |
| 3 | `supabase inspect db db-stats --linked` | 읽기전용 통계 |
| 4 | `supabase inspect db table-sizes --linked` | 읽기전용 통계 |
| 5 | `supabase backups list --project-ref <linked-ref>` | 읽기전용 메타데이터 |
| 6 | `supabase inspect db role-connections --linked` | 읽기전용 통계 |

**원격 변경(mutation) 횟수: 0건**. 위 명령은 모두 읽기전용 CLI 조회이며 데이터베이스나 프로젝트 상태를 변경하지 않는다.

### 8.9 사용자 대시보드 체크리스트 (018 갱신: 전항목 확인 완료)

018 사용자 대시보드 UI 증거로 4개 항목 전부 확인 완료 (§8.3 참조). Approval A PASS.

> **정정 (018)**: 이전 4개 미확인 항목이 모두 사용자 대시보드 증거로 해소. 디스크 4→8 GB 리사이즈, Spend Cap 활성, Nano 컴퓨트, 7건 물리 백업.

### 8.10 VS-G 보충 판정 (018 갱신)

**VS-G: APPROVAL_A_PASS / APPROVAL_B_PENDING_USER**

| 게이트 | 상태 | 의미 |
|---|---|---|
| `READONLY_AUDIT_COMPLETE` | **달성** | CLI 메타데이터·db-stats·백업·연결·실제원본 dry-run 검증됨. 로컬 재검증 11개 항목 전부 PASS. |
| `CAPACITY_POLICY_READY` | **달성** | 공식 Pro 정책(8 GB gp3, USD 0.125/GB/월 초과, 자동 확장, 백업 7일) 교차검증 완료. |
| `READY_FOR_APPROVAL_A` | **달성** | 대시보드 4개 항목 확인 + 사용자 승인 완료. |
| `APPROVAL_A_PASS` | **달성** (018) | DDL migration 0028-0034 원격 적용 완료. 7개 migration 성공, 테이블 0행, Data API 읽기 성공, private/staging 미노출. 스키마 덤프 SKIPPED (Docker 미사용, migration 실패 아님). |
| `APPROVAL_B` | **미승인 / 미실행** | 별도 사용자 승인 + secure DB credential 입력 필요. |

**Approval A 실행 기록**: G6 migrations 0028-0034 `db push`로 원격 적용 완료. 데이터 적재/publish/Vercel/Git 없음. app/component/library/migration/script 파일 이 마감에서 변경 없음(거버넌스·QA 문서만 갱신).

Approval B/C는 별도 사용자 승인 전 실행하지 않는다.

### 8.11 정정 이력 (016 → 017)

| 항목 | 이전 값 (015) | 정정 값 (016) | 사유 |
|---|---|---|---|
| 데이터베이스 풋프린트 | CLI 메타데이터만 (용량 미확인) | 561 MB DB, 227 MB 테이블, 322 MB 인덱스, 672 MB WAL | db-stats 독립 재현 결과 반영 |
| 잔여 용량 권고 | 1.5 GB | **2.5 GB** | 현재 WAL 672 MB + 두 차례 벌크 쓰기 단계 감안, 보수적 상향 |
| 적재 후 DB 크기 | 미기록 | Low ~1.11 / Base ~1.44 / High ~1.64 GB | 현재 561 MB + 증분으로 정확히 계산 |
| 백업 상태 | 대시보드 확인 필요 (D-4) | 검증됨: 7건 COMPLETED, PITR=false, walg=true | backups list 독립 재현 |
| 복원 테스트 | 미기록 | 수행하지 않음, 주장하지 않음 | 정직한 상태 기록 |
| 연결 한도 | 미기록 | DB 역할 한도 60, 저사용량. Supavisor 풀 크기 미확인 | role-connections 독립 재현 |
| 실제원본 dry-run | 미기록/스킵 | PASS (건수 일치, FK orphan 0, mode=ro) | Python 3.11 실제원본 dry-run 증거 |
| 대시보드 미확인 항목 | 6개 (D-1~D-6) | 6개 재정리 (백업→승인직전확인, 플랜·용량·단가·풀·컴퓨트·최신백업) | CLI 검증 완료 항목 제거, 실질 미확인만 유지 |
| 원격 명령 목록 | 미기록 | 6개 읽기전용 명령 명시, mutation 0건 | 투명성 강화 |

#### 017 추가 정정 (공식 정책 교차검증)

| 항목 | 이전 값 (016) | 정정 값 (017) | 사유 |
|---|---|---|---|
| D-1 플랜 티어 | 대시보드 확인 필요 | **Pro** (사용자 제공 대시보드 UI 증거) | 사용자 직접 확인 정보 반영 |
| D-3 초과 단가 | 대시보드 확인 필요 | 일반 정책: gp3 포함 8 GB, **USD 0.125/GB/월** 초과. Spend Cap/실 초과 허용은 dashboard-unknown | 공식 pricing 문서 교차검증 |
| D-2 디스크 한도 | 대시보드 확인 필요 | 공식 기준선 최소 8 GB gp3. 실제 프로비저닝 디스크·사용률·유형은 dashboard-unknown | 공식 disk 문서 교차검증, DB 크기 vs 디스크 구분 명시 |
| 대시보드 체크리스트 | 8개 항목 (D-1~D-6 + VS-2 + 동명객체) | **4개** (RC-1~RC-4: 디스크/SpendCap/컴퓨트풀/백업) | D-1·D-3 해소, 나머지 통합·축소 |
| 게이트 구분 | READONLY_AUDIT_COMPLETE만 | READONLY_AUDIT_COMPLETE + **CAPACITY_POLICY_READY** 추가, READY_FOR_APPROVAL_A 미달성 명시 | 공식 정책 교차검증으로 별도 게이트 신설 |
| 무쓰기 확인 | 미기록 | G6 0028-0034 원격 미적용, mutation 0건, app/코드 변경 없음 | 명시적 확인 추가 |
| 공식 문서 출처 | 미기록 | 4개 URL (database-size, disk-size, backups, pricing) | 증거 추적성 강화 |

#### 018 추가 정정 (Approval A 실행 증거)

| 항목 | 이전 값 (017) | 정정 값 (018) | 사유 |
|---|---|---|---|
| 디스크 할당 | 일반 정책 8 GB 기준선, 실제 미확인 | 실제 **4 GB** → **8 GB 리사이즈** (1.65 GB used) | 사용자 대시보드 UI 증거 |
| Spend Cap | dashboard-unknown | **활성** (초과 과금 차단) | 사용자 대시보드 UI 증거 |
| 컴퓨트 | dashboard-unknown | **Nano**, 낮은 CPU, 보통 메모리, 낮은 연결 | 사용자 대시보드 UI 증거 |
| 백업 (대시보드) | CLI 7건 확인, 대시보드 미확인 | 대시보드 **7건** 복원 가능 물리 백업 확인, PITR 비활성 | 사용자 대시보드 UI 증거 |
| 디스크 여유 | 미확정 (실제 사용률 미확인) | ~6.35 GB 여유, >= 2.5 GB 임계값 **PASS** | 리사이즈 후 계산 |
| Approval A | 미실행 | **PASS** — 7개 migration 적용, 테이블 0행, Data API 읽기 성공 | 독립 검증 증거 |
| 스키마 덤프 | 미기록 | **SKIPPED** (Docker 미사용, migration 실패 아님) | 정직한 상태 기록 |
| Approval B | 미실행 | **미승인 / 미실행** (별도 사용자 승인 + credential 필요) | 경계 명시 |
| RC-1~RC-4 체크리스트 | 4개 미확인 | **4개 전부 확인 완료** | 사용자 대시보드 UI 증거 |
| 게이트 | READONLY_AUDIT_COMPLETE + CAPACITY_POLICY_READY | + **APPROVAL_A_PASS**, APPROVAL_B 미승인 | Approval A 실행 완료 |
