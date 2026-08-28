# 03. Data contract and lineage

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002

## 1. 목적

원본 → 승인 스냅샷 → staging → publish → 공개 API → 화면까지 데이터 계보를 끊김 없이 설계한다. 기존 분석 폴더를 런타임에서 직접 읽거나 공개하지 않는다.

## 2. 데이터셋 카탈로그

| 데이터셋 | 기준 건수 | 원본 소스 | 안정 키 | 공개 필드 범위 | 민감·제외 필드 | 기준일 |
|---|---:|---|---|---|---|---|
| 레시피 | **70,165** | 런타임 마스터 | recipe_id (VS-1 확정) | 이름, 재료명 목록, 카테고리, 간략 설명 | 원본 내부 ID, 운영 로그, ingest 오류 | 2026-08-18 기준 (신규 Supabase 적재 시 확정) |
| 식재료 | **18,933** | 런타임 마스터 | ingredient_id (VS-1 확정) | 이름, 카테고리, 단위 | 원본 내부 ID, 운영 로그 | 동일 |
| 제조시설 | **94,723** | 런타임 마스터 SQLite | **mgt_no** (관리번호 문자열 — 감사 확인) | 시설명, 지역, 업종, HACCP 여부, 영업상태, 제품유형, tel, homepage | 대표자 개인정보, 내부 운영기록, **email(원본 컬럼 없음)** | 동일 |
| 대체 식재료 사전계산 쌍 | **234,955** | final_output/analysis_outputs/ | (**기준식품ID**, **후보식품ID**) 복합키 — 문자열 | 6개 유사도 지표, 종합유사도, 최종유사도, 영양 비교값, 5가지 매칭방법, 계보 정보, 한계 고지 | 내부 분석 파이프라인 변수, 중간 계산값 | 2026-08-18 생성 |
| 표준 식재료 (기준 식품) | **686** | final_output/reference_data/ | standard_food_id (VS-1 확정) | 표준명, 카테고리, 영양소 기준값 | 내부 코드 | 동일 |

## 3. 원본-표준-공개 필드 매핑

### 3.1 제조시설 필드 매핑

| 원본 필드 | 공개 필드명 | 타입 | Null | 설명 | 공개 여부 |
|---|---|---|---|---|---|
| 관리번호 | mgt_no | text | NOT NULL | **안정 기본키** — 감사 확인된 관리번호 | 공개 |
| 시설명 | name | text | NOT NULL | 제조시설 공식 명칭 | 공개 |
| 소재지 (시도) | region_sido | text | NULL | 시·도 | 공개 |
| 소재지 (시군구) | region_sigungu | text | NULL | 시·군·구 | 공개 |
| 업종분류 | business_type | text | NULL | 식품 업종 대분류 | 공개 |
| HACCP 인증 | is_haccp | boolean | NULL | HACCP 인증 여부 | 공개 |
| 영업상태 | status | text | NULL | 영업/폐업/정지 | 공개 |
| 제품유형 | product_types | text[] | NULL | 생산 가능 제품 종류 목록 | **Q-06 미결정 — VS-1 확정 후 조건부 공개** (Q-06 미해소 시 API·UI 필수 계약에 포함하지 않음) |
| tel | tel | text | NULL | 공개 전화번호 (원본 존재 확인) | 공개 |
| homepage | homepage | text | NULL | 공식 홈페이지 URL (원본 존재 확인) | 공개 |
| email | — | — | — | **원본 테이블에 컬럼 없음** — 별도 승인 이메일 소스 확보 전 제외 | **비공개 (미존재)** |
| 대표자명 | — | — | — | 개인정보 — 공개 제외 | **비공개** |
| 내부 운영 기록 | — | — | — | 비공개 | **비공개** |

> **확인**: 기존 facility 원본에 email 컬럼 없음 (VS-1 감사 결과). 별도 승인된 이메일 소스(이용권한·공개범위·시설키 연결 확인)가 확보될 때만 email 필드를 추가한다. 기본 문의 방법은 문의문안 복사 + tel/homepage 표시다.

### 3.2 레시피 필드 매핑

| 원본 필드 추정 | 공개 필드명 | 타입 | 설명 |
|---|---|---|---|
| 레시피명 | name | text | 공개 |
| 주재료 목록 | ingredients | text[] | 공개 |
| 카테고리 | category | text | 공개 |
| 간략 설명 | description | text | 공개 (NULL 가능) |

### 3.3 식재료 필드 매핑

| 원본 필드 추정 | 공개 필드명 | 타입 | 설명 |
|---|---|---|---|
| 식재료명 | name | text | 공개 |
| 카테고리 | category | text | 공개 |
| 단위 | unit | text | NULL 가능 |

> **주의**: 실제 컬럼명은 VS-1 감사 단계에서 analysis_outputs/ 파일을 직접 확인하여 확정한다. 위 매핑은 런타임 마스터 및 DOC-07 기반 설계 가설이다.

## 4. 대체 식재료 계약

### 4.1 6개 유사도 지표 정의 (food_pair_similarities.csv 실제 필드)

`food_pair_similarities.csv`의 실제 6개 지표 (G3-07 Codex 검토 B-02 기준):

| 지표 (원본 필드명) | 공개 필드명 | 방향 | 범위 | Null 규칙 | 단위 |
|---|---|---|---|---|---|
| 영양성분_유사도 | sim_nutrition | 높을수록 유사 | 0.0~1.0 | NULL = 측정불가 | 무차원 비율 |
| 재료구분_유사도 | sim_ingredient_category | 높을수록 유사 | 0.0~1.0 | NULL = 데이터 없음 | 무차원 비율 |
| 식품군_유사도 | sim_food_group | 높을수록 유사 | 0.0~1.0 | NULL = 데이터 없음 | 무차원 비율 |
| 조리상태_유사도 | sim_cooking_state | 높을수록 유사 | 0.0~1.0 | NULL = 데이터 없음 | 무차원 비율 |
| 요리종류_유사도 | sim_dish_type | 높을수록 유사 | 0.0~1.0 | NULL = 데이터 없음 | 무차원 비율 |
| 동반재료_유사도 | sim_companion | 높을수록 유사 | 0.0~1.0 | NULL = 데이터 없음 | 무차원 비율 |

**2단계 가중 계산 로직** (사용자 조정 가능):

1단계 — 종합유사도 = 영양성분_유사도×0.60 + 재료구분_유사도×0.15 + 식품군_유사도×0.15 + 조리상태_유사도×0.10
2단계 — 최종유사도 = 종합유사도 × 0.70 + 요리종류_유사도 × 0.20 + 동반재료_유사도 × 0.10

| 파생 필드 | 공개 필드명 | 설명 |
|---|---|---|
| 종합유사도 | score_composite | 4개 지표 가중평균 |
| 최종유사도 | score_final | 종합+요리종류+동반재료 가중평균 (주 정렬 기준) |

> **주의**: 1단계 가중치(영양성분 0.60·재료구분 0.15·식품군 0.15·조리상태 0.10) 및 2단계 비율(0.70/0.20/0.10)은 파이프라인에서 확인된 기본값이며 사용자 조정 가능하다. 지표 NULL 시 유효 지표의 가중치 합으로 재정규화한다 (예: sim_ingredient_category NULL → 나머지 0.85 합산 기준으로 재정규화).

### 4.2 영양 비교값

| 필드 | 단위 | 설명 |
|---|---|---|
| energy_kcal | kcal/100g | 에너지 |
| protein_g | g/100g | 단백질 |
| fat_g | g/100g | 지방 |
| carbohydrate_g | g/100g | 탄수화물 |
| sodium_mg | mg/100g | 나트륨 |

단위는 공개 필드에 명시한다. 단위가 다른 영양값은 공개 전 정규화한다.

### 4.3 5가지 매칭방법 계보 (ingredient_matching.csv 실제 분포)

고유 입력명 23,806건의 매칭방법별 분포 (B-03):

| 매칭방법 | 건수 | 비율 | 공개 표시 | 계보 필드 |
|---|---:|---:|---|---|
| 완전일치 | 488 | 2.05% | "정확 일치" 배지 | match_method = 'exact' |
| 포함일치 | 11,764 | 49.42% | "포함 일치" 배지 + 고지 | match_method = 'substring' |
| 철자유사 | 295 | 1.24% | "유사 철자" 배지 + 고지 | match_method = 'fuzzy' |
| 동의어 | 35 | 0.15% | "동의어" 배지 + 고지 | match_method = 'synonym' |
| 미매칭 | 11,224 | 47.15% | no-candidate 상태 | match_method = 'none' |
| **합계** | **23,806** | **100%** | | |

- **52.85% = 전체 매칭 성공률** (12,582 / 23,806): 완전일치+포함일치+철자유사+동의어 합산
- 52.85%를 "완전일치율"로 표현하지 않는다. 완전일치는 2.05%이다.
- 미매칭을 부분일치로 표시하지 않는다. 미매칭은 no-candidate 상태로 별도 처리한다.
- 포함일치/철자유사/동의어 결과에는 "입력명과 표준 식품명이 완전히 일치하지 않을 수 있습니다" 고지를 항상 표시한다.

### 4.4 한계 고지 (항상 표시)

```
본 대체 식재료 후보는 사전 분석된 데이터 기반의 참고 정보입니다.
실제 원료 대체 결정은 식품 전문가의 검토와 법적 요건 확인이 필요합니다.
원가절감·관능 동등·법적 적합성은 보장하지 않습니다.
```

### 4.5 소스 파일 조인 키 계약

세 소스 파일의 조인 관계와 match_type 귀속 계층을 명확히 한다.

| 계층 | 파일 | 키 | 역할 |
|---|---|---|---|
| 입력명 해석 | ingredient_matching.csv | input_name → standard_food_id | match_type 보유 (exact·substring·fuzzy·synonym·none) |
| 식품쌍 유사도 | food_pair_similarities.csv | (기준식품ID, 후보식품ID) = (standard_food_id, standard_food_id) | 6개 유사도 지표·score_final 보유 |
| 기준 마스터·영양 | food_master.csv | 식품ID = standard_food_id | 표준명·영양값 보유 |

**조인 키 계약**:
- `ingredient_matching.csv` ↔ `food_pair_similarities.csv`: `standard_food_id` 로 연결 (입력명 → 기준식품ID)
- `food_master.csv` ↔ `food_pair_similarities.csv`: `식품ID = standard_food_id` 로 연결 (기준·후보 마스터명·영양 조회)

**match_type 귀속 원칙**: match_type은 `ingredient_matching.csv` (입력명 해석 계층)에 속한다. `food_pair_similarities.csv` 및 `public.substitute_pairs` 테이블에 match_type 컬럼을 두지 않는다. 공개 API 응답 시 ingredient_matching 레이어에서 조인 후 배지 렌더링에 사용한다.

**재정규화 정책**: `food_pair_similarities.csv`의 6개 지표 중 NULL이 있을 경우, 유효 지표의 가중치 합계를 분모로 재정규화하여 score_composite를 계산한다 (예: sim_ingredient_category NULL → 나머지 0.85 합 기준 재정규화). 재정규화 적용 여부는 API 응답 메타에 표기한다.

## 5. 공동제조 계약

### 5.1 공동제조 매칭 필드

| 조건 유형 | 필드 | 설명 |
|---|---|---|
| 필수 조건 | business_type | 업종 일치 필수 |
| 필수 조건 | region_sido | 지역 일치 (Q-06 미해소 시 공동제조 기본 필터) |
| 필수 조건 | is_haccp | HACCP 인증 여부 (Q-06 미해소 시 공동제조 기본 필터) |
| 필수 조건 | status | 영업 중 여부 (Q-06 미해소 시 공동제조 기본 필터) |
| **조건부 필수** | **product_types** | **Q-06 미결정 — VS-1에서 mgt_no 참조율·중복·결측 확인 후 활성화. Q-06 미해소 시 API·UI 필수 계약에 포함하지 않음. 파생 불가 확정 시 위 4개 필드(업종·지역·HACCP·영업상태)로 대체.** |

### 5.2 매칭 결과 표시

- 필터 결과: 업종·지역·HACCP·영업상태 일치 시설 목록 (FG-FUN-032~035); 제품유형 필터는 Q-06 해소 후 조건부 추가
- FG-FUN-044(기존 배치 알림)·FG-FUN-060(게시물·문의 처리현황)는 보류 (DOC-07 v0.7 정식명) — 현재 범위 제외
- 문의: 문의문안 복사 기본 제공. tel 있으면 전화번호 표시. homepage 있으면 링크 표시.
- 이메일 기반 mailto: 별도 승인 이메일 소스 확보 후 활성화 (원본에 email 컬럼 없음)

## 6. API DTO와 페이지네이션

### 6.1 공통 성공 응답

```typescript
{
  data: T[],
  meta: {
    total: number,
    page: number,
    pageSize: number,  // 최대 50
    hasMore: boolean
  },
  traceId: string  // public-safe UUID
}
```

### 6.2 공통 오류 응답

```typescript
{
  error: {
    code: "FG_DATA_UNAVAILABLE" | "FG_NOT_FOUND" | "FG_INVALID_INPUT" | "FG_RATE_LIMITED",
    message: string,  // 한국어 사용자 메시지
    retryable: boolean,
    fallback: "retry" | "adjust-filter" | null
  },
  traceId: string
}
```

공개 오류에는 SQL 쿼리, 테이블명, provider URL, 내부 stack trace를 포함하지 않는다.

### 6.3 검색 입력 제한

| 파라미터 | 제한 | 처리 |
|---|---|---|
| q (검색어) | 최대 100자 | 초과 시 FG_INVALID_INPUT |
| page | 1~1000 | 범위 초과 시 FG_INVALID_INPUT |
| pageSize | 1~50 | 기본 20, 최대 50 |
| filter 파라미터 | allowlist 검증 | 허용 값 외 무시 |

### 6.4 안정 정렬

모든 목록 API는 유일한 tie-breaker(id ASC)를 마지막 정렬 키로 포함한다.

```sql
ORDER BY score_final DESC, 후보식품ID ASC
```

## 7. 계보·버전·품질

| 항목 | 설계 |
|---|---|
| source_snapshot_id | VS-2 적재 시 UUID 생성, private.data_lineage에 기록 |
| ingest_run_at | 적재 실행 타임스탬프 |
| rule_version | 분석 파이프라인 버전 (pipeline_config.py에서 추출) |
| publish_version | Supabase publish 시 버전 태그 |
| basis_date | 2026-08-18 (final_output 생성일) |
| reject_count | staging 단계 거부 행 수 기록 |
| duplicate_count | 중복 식별 및 처리 수 |
| sample_verification | 표본 100건 수동 대조 (VS-2 완료 조건) |

## 8. 데이터 이용권한과 보존

| 데이터셋 | 이용 근거 | 공개 가능 필드 | 보존·삭제 | 재배포 제한 | 상태 |
|---|---|---|---|---|---|
| 런타임 마스터 (레시피·식재료·시설) | 빅데이터 분석 지원사업 계약 | 비개인정보 공개 필드 | 프로젝트 완료 후 계약 기간까지 | 계약 범위 내 | 확인 필요 (사용자 승인사항) |
| 대체 식재료 사전계산 결과 | 동일 사업 계약 내 R&D 산출물 | 6지표·영양·매칭타입 | 동일 | 계약 범위 내 | 확인 필요 |
| 시설 이메일 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | **사용자 확인 필요** |

## 완료 확인

- [x] 실제 파일 및 DOC-07 기반 계약 설계 (VS-1에서 컬럼 확정 예정)
- [x] 6개 지표 설계 기준 정의 (exact/substring 구분 포함)
- [x] exact/substring 계보 구분 (match_type 필드, 배지 표시)
- [x] 안정 키·정렬·페이지네이션 (tie-breaker 포함)
- [x] 공개/비공개 필드 구분, 버전·기준일 계획
- [x] UNKNOWN 항목 명시 (시설 이메일 공개 가능성, 데이터 이용 계약 상세)
