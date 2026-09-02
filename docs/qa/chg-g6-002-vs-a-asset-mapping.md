# CHG-G6-002 VS-A 자산·매핑 QA 증빙

작성일: 2026-08-30
요청 ID: CHG-G6-002-G4-VS-A-ASSET-MAPPING-002
담당: Claude Code (MoAI)

---

## 1. 원본 경로와 read-only 증거

| 원본 | 경로 | 접근 방식 |
|---|---|---|
| SQLite DB | `D:\0. 업무\foodground\data\foodground.db` | `sqlite3.connect(uri, uri=True)` + `PRAGMA query_only = ON` |
| Company profiles CSV | `[repo]/03_공동제조 매칭 정확도(F1 SCORE)/03_테스트데이터셋/company_profiles.csv` | 읽기 전용 (`open(..., 'r')`) |
| 참조 감사 스크립트 | 로컬 임시 감사 스크립트(작업 후 제거) | 읽기 전용 |

원본 파일을 수정하거나 복사한 기록 없음. 대용량 DB 및 CSV를 커밋 후보로 만들지 않음.

---

## 2. 실제 건수·키·고아·예외

### 2.1 SQLite 테이블 건수 (감사 스크립트 실측값)

| 테이블 | 기준값 | 실측값 | 판정 |
|---|---:|---:|---|
| facility | 94,723 | 94,723 | ✅ PASS |
| production_log | 1,047,894 | 1,047,894 | ✅ PASS |
| haccp_cert | 308 | 308 | ✅ PASS |
| sales_suspension | 355 | 355 | ✅ PASS |

### 2.2 고유키·FK 고아

| 항목 | 기준값 | 실측값 | 판정 |
|---|---:|---:|---|
| production_log 고유 report_no | 1,047,894 | 1,047,894 | ✅ PASS |
| production_log facility 연결 | 815,989 | 815,989 | ✅ PASS |
| production_log facility 미연결 | 231,905 | 231,905 | ✅ PASS |
| production_log FK 고아 | 0 | 0 | ✅ PASS |
| haccp_cert facility 연결 행 | 269 | 269 | ✅ PASS |
| haccp_cert 고유 시설 | 261 | 261 | ✅ PASS |
| haccp_cert FK 고아 | 0 | 0 | ✅ PASS |
| haccp_cert facility NULL (미연결) | 39 | 39 | ✅ INFO |
| sales_suspension facility 연결 | 103 | 103 | ✅ PASS |
| sales_suspension FK 고아 | 0 | 0 | ✅ PASS |

### 2.3 haccp_cert 중복 facility_mgt_no (INFO)

동일 facility_mgt_no에 2개 이상 HACCP 인증이 등록된 시설 6건 확인 (다중인증 또는 갱신):
- 4행 1건, 2행 5건 — 이는 이상값이 아닌 데이터 특성

---

## 3. Mapping 규칙과 265/4/39 분포

### 3.1 정규화 함수

```python
def norm(value: str | None) -> str:
    return re.sub(r"[^0-9a-z가-힣]", "", (value or "").lower())
```

`.tmp/audit_g6_002_assets.py`의 `norm()` 함수와 동일.

### 3.2 매핑 알고리즘

1. **이름 후보**: `haccp_by_name[norm(company_name)]` → 이름이 일치하는 haccp_cert 행 목록
2. **지역 필터**: `region = norm(sido)` → `region in norm(biz_addr)`이면 지역후보로 분류
3. **후보 선택**: 지역후보가 있으면 지역후보, 없으면 이름후보 전체
4. **시설 집합**: 최종 후보의 비어 있지 않은 `facility_mgt_no` 고유집합
5. **분류**:
   - 고유집합 크기 = 1 → `linked`
   - 고유집합 크기 ≥ 2 → `ambiguous`
   - 고유집합 크기 = 0 → `unlinked`

**제거된 규칙**: 서로 다른 profile이 같은 시설을 가리키는 경우를 ambiguous로 강등하는 양방향 유일성 검사 — 작업지시서에 없는 규칙으로 이전 실행에서 잘못 추가된 것을 정정.

### 3.3 분포 실측값

| 구분 | 기준값 | 실측값 | 판정 |
|---|---:|---:|---|
| 전체 | 308 | 308 | ✅ PASS |
| linked | 265 | 265 | ✅ PASS |
| ambiguous | 4 | 4 | ✅ PASS |
| unlinked | 39 | 39 | ✅ PASS |
| 중복 company_id | 0 | 0 | ✅ PASS |

### 3.4 Mapping FK 검증

linked 265행의 `facility_mgt_no` 전수 → SQLite `facility.mgt_no` 조회: **고아 0건** ✅

### 3.5 예외(exceptions.csv)

- ambiguous(4) + unlinked(39) = **43행**
- 전 행 `needs_review=true`
- 공개 후보 (`manufacturing_profiles_public`) 에서 제외됨

---

## 4. 공개 projection 필드·제외 필드

| 테이블 | 포함 필드 | 제외 필드 |
|---|---|---|
| `products_public` | report_no, product_name, category, maker_name, ingredients, shelf_life_days, facility_mgt_no (nullable), reported_at, updated_at | maker_addr, 내부 감사 정보 |
| `facility_products_public` | facility_mgt_no, report_no, product_name, category, maker_name, ingredients, shelf_life_days, reported_at, updated_at | maker_addr, 시설 미연결 행 |
| `haccp_certifications_public` | facility_mgt_no, biz_name, cert_no, cert_date, ccp_list, source_updated_at | **raw_payload**, biz_addr |
| `facility_safety_public` | facility_mgt_no, product_name, maker_name, reason, method, batch_mfg_date, batch_exp_date, barcode, product_code, image_url, published_at, source_created_at | maker_addr, 시설 미연결 252행 |
| `manufacturing_profiles_public` | company_id, company_name, facility_mgt_no, item_set, ccp_set_std, has_cooking_ccp, has_sterilize_ccp, sido, match_basis, mapping_rule | ccp_vector, candidate_count, needs_review, ambiguous/unlinked 행 |
| `private.company_profile_mapping` | 전 컬럼(308행) | — (private 스키마, 공개 불가) |

### 4.1 Codex 독립 원본 컬럼 대조 정정

최초 Claude Code 초안은 원본에 없는 `food_type`, `status`, `report_date`,
`suspension_date`를 사용하고 실제 원본 필드 일부를 누락했다. 원격 실행 전 Codex가
SQLite `PRAGMA table_info`로 대조하여 위 계약으로 교정했다. 날짜 원문에는 원천 오기가
존재하므로 `reported_at`, `cert_date`, `published_at`은 VS-A 계약에서 TEXT로 보존한다.
통합 검증기에 실제 원본 스키마와 필수·금지 projection 컬럼 검사를 추가했다.

---

## 5. Migration·rollback 파일 목록

| 파일 | 목적 |
|---|---|
| `supabase/migrations/20260830000000_0028_vs-a_g6_002_public_products.sql` | products_public (1,047,894행 경량 projection) |
| `supabase/migrations/20260830001000_0029_vs-a_g6_002_facility_products_public.sql` | facility_products_public (815,989행, facility 연결만) |
| `supabase/migrations/20260830002000_0030_vs-a_g6_002_haccp_certifications_public.sql` | haccp_certifications_public (308행, raw_payload 제외) |
| `supabase/migrations/20260830003000_0031_vs-a_g6_002_facility_safety_public.sql` | facility_safety_public (103행, facility 연결만) |
| `supabase/migrations/20260830004000_0032_vs-a_g6_002_manufacturing_profiles_public.sql` | manufacturing_profiles_public (265행, linked만) |
| `supabase/migrations/20260830005000_0033_vs-a_g6_002_private_mapping.sql` | private.company_profile_mapping (308행) + staging 테이블 |
| `supabase/rollback/20260830_0028_0033_vs-a_g6_002_rollback.sql` | BEGIN/COMMIT 트랜잭션, 신규 객체만 DROP |

모든 migration 파일에 `REMOTE EXECUTION PROHIBITED UNTIL USER APPROVAL` 주석 포함.

---

## 6. 검증 명령과 결과

```
# 감사 스크립트
python scripts/chg_g6_002_audit_assets.py
→ Audit verdict: PASS (0 errors)

# Mapping dry-run
python scripts/chg_g6_002_build_profile_mapping.py --dry-run
→ ✅ Distribution matches expected 265/4/39

# Mapping 실행 (파일 생성)
python scripts/chg_g6_002_build_profile_mapping.py
→ ✅ 308행, 43 exceptions, mapping_summary.json 생성

# 통합 dry-run 검증기
python scripts/chg_g6_002_dryrun_validator.py
→ Verdict: PASS (0 errors)
```

### 검증기 커버리지 요약

| 검증 항목 | 결과 |
|---|---|
| py_compile (3 스크립트) | ✅ PASS |
| SQLite 테이블 건수 4종 | ✅ PASS |
| production_log unique report_no | ✅ PASS |
| FK 고아 (production_log, haccp_cert, sales_suspension) | ✅ PASS 0건 |
| Mapping 308행 265/4/39 분포 | ✅ PASS |
| linked facility_mgt_no → SQLite facility FK | ✅ PASS 0고아 |
| exceptions.csv 43행 needs_review=true | ✅ PASS |
| Migration 6개 RLS·ACL·PROHIBITED 포함 | ✅ PASS |
| SQLite 원본 컬럼 ↔ projection 필수·금지 컬럼 계약 | ✅ PASS |
| Rollback BEGIN/COMMIT·명시적 DROP·CASCADE 없음 | ✅ PASS |
| 비밀정보 패턴 없음 | ✅ PASS |

---

## 7. VS-B 진입 조건

VS-B(제품·업체·HACCP 공개조회 수직슬라이스)는 다음 조건이 모두 충족되면 진입 가능하다.

| 조건 | 상태 |
|---|---|
| VS-A 감사 PASS (모든 기준값 일치) | ✅ 충족 |
| Mapping 308행·265/4/39 분포 확인 | ✅ 충족 |
| Mapping FK 고아 0건 | ✅ 충족 |
| ambiguous·unlinked 43행 공개에서 제외됨 확인 | ✅ 충족 |
| Migration 초안 정적검증 PASS | ✅ 충족 |
| 비밀정보·개인경로·대용량 원본 미포함 확인 | ✅ 충족 |
| Codex 독립 검토 및 분포·원본 컬럼 계약 검증 | ✅ 충족 |
| 원격 Supabase migration 실행 승인 | ⏸️ **사용자 승인 대기** |

VS-B 진입 전 반드시 사용자가 산출물을 검토하고 Codex 독립 검증을 수행해야 한다.

---

## 8. 원격 변경 없음 확인

본 VS-A 작업에서 수행한 원격 변경:

- Supabase (원격): **없음**
- Vercel: **없음**
- Git commit/push/PR/merge: **없음**
- 기존 `wavenvibe/foodground` 또는 기존 Supabase 쓰기: **없음**

모든 산출물은 로컬 파일 시스템에만 존재하며 사용자 승인 후 적재 예정이다.
