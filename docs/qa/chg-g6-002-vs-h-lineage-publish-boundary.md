# CHG-G6-002 VS-H QA 증빙: PUBLIC-LINEAGE-001 경계 수정

## 결함 ID

PUBLIC-LINEAGE-001

## 결함 설명

Migration 0020이 `public.data_lineage_public` VIEW를 `WHERE publish_version IS NOT NULL` 필터 없이 생성하여, staging 적재 시 생성된 lineage 행 5건(publish_version IS NULL)이 anon 사용자에게 즉시 노출됨.

## 근본 원인

```sql
-- Migration 0020 (defective)
CREATE OR REPLACE VIEW public.data_lineage_public AS
  SELECT id, dataset_name, basis_date, publish_version, ingest_run_at
  FROM private.data_lineage;
-- Missing: WHERE publish_version IS NOT NULL
```

## 수정 사항

### Migration 0035 (스키마)

```sql
CREATE OR REPLACE VIEW public.data_lineage_public AS
  SELECT id, dataset_name, basis_date, publish_version, ingest_run_at
  FROM private.data_lineage
  WHERE publish_version IS NOT NULL;

REVOKE ALL ON public.data_lineage_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.data_lineage_public TO anon, authenticated;
```

- definer semantics 유지 (security_invoker 미사용 — private 스키마 읽기 필요)
- VIEW owner(service_role 아님) 주석 — 정확한 용어 사용
- 명시적 REVOKE ALL (PUBLIC 포함) + GRANT SELECT 패턴
- 실행 가능 SQL에서 security_invoker 미출현 (주석 제외 검사)

### Publish SQL (원자 lineage marker — 강화된 bounded contract)

- 섹션 5: 5개 target table에서 `ingest_run_id` 파생 → checkpoint 교차검증 → bounded UPDATE `publish_version = 'chg-g6-002-v1'`
- target table 실제 행 수와 expected count 대조
- checkpoint 대조: dataset + run_id + status='completed' + loaded_rows 일치
- 기존 data publish와 동일 BEGIN/COMMIT 트랜잭션 내

### Publish Rollback SQL (marker 해제 — 강화된 bounded contract)

- 섹션 2: target table에서 run ID 파생 → expected row count 대조 → checkpoint 교차검증 → data_lineage 이중 키(id + dataset_name) 교차검증 → distinct run ID 5건 확인 → publish_version NULL 설정
- VIEW 비가시성 검증 포함

### Verify SQL (post-publish 검증 — 강화된 bounded contract)

- 섹션 8: lineage publish boundary 검증
  - 8a: 5개 target table에서 run ID 파생 + expected row count 대조 + checkpoint 교차검증 + data_lineage 이중 키(id + dataset_name) 교차검증 + distinct run ID 5건 확인
  - 8b: 5개 lineage 행 publish_version = 'chg-g6-002-v1'
  - 8c: VIEW에서 5건 가시, NULL publish_version 0건
  - 8d: VIEW 정의에 WHERE publish_version IS NOT NULL 필터 확인 (lower() case-robust)

## 수정 계약 검증 매트릭스

| 계약 | 검증 방법 | 로컬 PASS |
|---|---|---|
| 미게시 행 비노출 | 0035 VIEW 필터 + verify 8c | 정적 확인 PASS |
| 5건 원자 가시화 | publish 섹션 5 target-table 파생 + checkpoint + data_lineage(id+dataset_name) 교차검증 + same txn | 정적 확인 PASS |
| rollback 원자 해제 | publish_rollback 섹션 2 target-table 파생 + expected row count + checkpoint + data_lineage(id+dataset_name) + distinct run 교차검증 | 정적 확인 PASS |
| VS-2 lineage 불변 | bounded UPDATE (target-table-derived ID 한정) | 정적 확인 PASS |
| bounded five-run contract | publish/rollback/verify 모두 target table에서 run ID 파생 + dataset_name 이중 키 | 구조 테스트 14건 |
| distinct run-ID 검증 | publish/rollback/verify에 COUNT(DISTINCT run_id) = 5 | 구조 테스트 3건 |
| expected row count guards | rollback/verify에 1047894/308/355 고정 상수 | 구조 테스트 2건 |
| security_invoker 미사용 | 0035 실행 SQL에서 미출현 (주석 제외 검사) | 구조 테스트 PASS |
| 명시적 REVOKE+GRANT (PUBLIC 포함) | 0035에 REVOKE ALL FROM PUBLIC + GRANT SELECT | 구조 테스트 PASS |
| VIEW 필터 case-robust | verify 8d에 lower(definition) 사용 | 정적 확인 PASS |

## 정적 검증 결과

### py_compile

| 파일 | 결과 |
|---|---|
| `chg_g6_002_dryrun_validator.py` | PASS (Codex request 021 실행) |
| `test_chg_g6_002_load_package.py` | PASS (Codex request 021 실행) |

### dryrun_validator 체크 (corrective review 반영)

| 체크 | 설명 |
|---|---|
| 6. keyword check | lineage_publish_boundary를 VIEW 경계 마이그레이션으로 분류 — RLS/POLICY 미요구, VIEW/필터/REVOKE/GRANT SELECT/5개 컬럼 검증 |
| 8b. 0035 migration | VIEW 교체, 필터, GRANT, 5개 컬럼, security_invoker 미사용, REVOKE |
| 9b. 0035 rollback | BEGIN/COMMIT, 필터 없는 VIEW 복원, PUBLIC-LINEAGE-001 경고 |
| 12. publish lineage | publish_version, chg-g6-002-v1, target-table-derived bounded UPDATE |
| 12. verify lineage | data_lineage_public, VIEW 필터, chg-g6-002-v1, target-table 파생 |
| 12. rollback lineage | publish_version 해제, VIEW 비가시성, target-table 파생 |

### 최종 test suite

| 테스트 클래스 | 테스트 수 | 설명 |
|---|---|---|
| TestLineagePublishBoundary | 10 | 0035 migration/rollback 존재·내용, publish/rollback/verify lineage 참조 |
| TestBoundedFiveRunContract | 14 | publish/rollback/verify target-table 파생 + actual_rows + dataset_name 이중 키 + expected row guards + distinct run IDs |
| TestMigration0035Revoke | 2 | PUBLIC pseudo-role REVOKE 포함 + service_role 부정확 용어 미사용 |

Codex 최종 로컬 검증 결과 (Request 025 기준): py_compile PASS, unittest **105 tests PASS**, dryrun validator PASS (0 errors), git diff --check 오류 0건. 단위 테스트가 출력한 일부 오류 문구는 거부 경로를 검증하는 의도된 fixture이며 전체 명령은 exit 0이다.
Request 022 누적: 추가분 10건(TestBoundedFiveRunContract 8건 + TestMigration0035Revoke 2건), 당시 93건 통과. Request 025(TestMigration0036AclHardening 13건 추가) 이후 최종 105건 확정.

### corrective review 변경 요약

#### Request 021 (CHG-G6-002-G4-PUBLIC-LINEAGE-BOUNDARY-REVIEW-021)

| 항목 | 변경 내용 |
|---|---|
| migration 0035 | security_invoker 제거, definer semantics 주석, 명시적 REVOKE ALL + GRANT SELECT |
| dryrun validator | 0035를 VIEW 경계 마이그레이션으로 분류 (ROW LEVEL SECURITY/POLICY 미요구) |
| test_no_security_invoker | 실행 SQL만 검사 (주석 제외) — false positive 방지 |
| publish/rollback/verify SQL | 5개 target table에서 ingest_run_id 파생 → checkpoint 교차검증 (기존: checkpoint-only) |
| 구조 테스트 6건 추가 | TestBoundedFiveRunContract: bounded contract 위반 시 실패 |

#### Request 022 (CHG-G6-002-G4-PUBLIC-LINEAGE-BOUNDARY-FINAL-022)

| 항목 | 변경 내용 |
|---|---|
| publish.sql | data_lineage 교차검증에 `dl.dataset_name = r.dataset` 이중 키 추가 |
| rollback.sql | expected row count guards (1047894/308/355/308/308) + data_lineage 이중 키 + `COUNT(DISTINCT run_id) = 5` 추가 |
| verify.sql | expected row count guards + data_lineage 이중 키 + `COUNT(DISTINCT run_id) = 5` + `lower(definition)` case-robust VIEW 필터 |
| migration 0035 | "service_role" → "view owner" 용어 정정, `REVOKE ... FROM PUBLIC` 추가 |
| 구조 테스트 10건 추가 | dataset_name 3건 + expected row guards 2건 + distinct run IDs 3건 + PUBLIC revoke 1건 + 부정확한 definer 용어 금지 1건 |

## 원격 적용·검증 결과

| 항목 | 상태 |
|---|---|
| 대상 프로젝트 | 공식 신규 Supabase `glczrbadvfgmblmkpgfj` 일치 (키·자격증명 미출력) |
| 원격 migration 사전 이력 | 0028~0034 적용 완료, pending은 0035 한 건만 확인 |
| `db push --dry-run` | `20260831000000_0035_g6_002_lineage_publish_boundary.sql` 한 건만 대상 PASS |
| `supabase db push` | migration 0035 적용 PASS |
| 원격 migration 사후 이력 | local/remote `20260831000000` 일치 PASS |
| anon Data API | HTTP 200 PASS |
| anon 미게시 lineage | `publish_version IS NULL` 0건 PASS |
| anon 공개 lineage | 7건, 모두 publish_version 존재 PASS |
| 기존 VS-2 public 회귀 | standard_foods 686, substitute_pairs 234,955, ingredient_name_match 23,806, recipes 70,165, ingredients 18,932, recipe_ingredients 679,457, facilities 94,723 유지 PASS |
| G6 public 미게시 경계 | products_public, facility_products_public, haccp_certifications_public, facility_safety_public, manufacturing_profiles_public 각 0건 PASS |
| Approval C 1차 시도 | ACL 경비 트리거: anon의 `public.products_public` 쓰기(write-class) 권한 감지 — COMMIT 전 트랜잭션 자동 롤백. G6 public 5종 0건·미게시 lineage 0건 독립 확인 PASS |
| migration 0036 dry-run | pending은 `20260831001000_0036_g6_002_public_acl_hardening.sql` 한 건만 확인 PASS |
| migration 0036 원격 적용 | 공식 신규 Supabase에 단독 적용 PASS, local/remote migration 이력 일치 |
| 0036 적용 후 게시 전 경계 | anon Data API에서 G6 public 5종 0건·미게시 lineage 0건 PASS |
| Approval C 2차 시도 | `pg_policies.roles` name[]/text[] 타입 불일치와 `cmd` 값 오해로 COMMIT 전 자동 롤백, G6 public 5종·미게시 lineage 0건 재확인 PASS |
| 정책 카탈로그 로컬 교정 | publish·verify에서 `SELECT/ALL`, `roles::text[]`, anon+authenticated 또는 public 역할 검증으로 교정 |
| 교정 후 로컬 검증 | py_compile PASS, 단위 테스트 109건 PASS, dry-run 0오류 PASS, git diff --check PASS |
| Approval C 3차 게시 | lineage marker 5건 원자 설정, 건수·PK·FK·매핑·비공개 열·RLS/ACL 사전 경비 PASS 후 COMMIT |
| Approval C 게시 후 검증 | products 1,047,894; facility-products VIEW 815,989; HACCP 308; safety 103; manufacturing profiles 265; mapping 308 일치 |
| 무결성·권한·lineage | PK/FK/VIEW/RLS/ACL/pg_policies/private column exclusion/checkpoint 5 → lineage 5 전 항목 PASS |
| anon Data API 독립 재검증 | public 5종 exact count·lineage 5건 PASS, private mapping HTTP 404 차단 PASS |

`facilities`는 열 단위 ACL 계약에 따라 `select=*`가 거부되는 것을 확인했고, 승인된 공개 열 `mgt_no`를 사용한 exact count 검증은 94,723건으로 통과했다. 원격 migrations 0035·0036과 anon 읽기 검증만 완료됐으며 두 publish 시도는 모두 COMMIT 전 자동 롤백됐다. Vercel·Git 작업은 수행하지 않았다.

## Migration 0036 ACL Hardening 보완

### 배경

Approval C 1차 시도 시 ACL 경비가 anon의 `public.products_public`에 대한 쓰기(write-class) 권한을 감지하여 SQL 트랜잭션이 COMMIT 전 자동 롤백됨. 독립 확인 결과: G6 public 5종 0건, 미게시 lineage 0건 상태 유지. 근본 원인: migration 0028/0030/0031/0032가 INSERT/UPDATE/DELETE만 REVOKE하고 TRUNCATE/REFERENCES/TRIGGER에 대한 Supabase 기본 GRANT를 잔류.

### 원인

PostgreSQL에서 `REVOKE INSERT, UPDATE, DELETE`만으로는 `TRUNCATE`, `REFERENCES`, `TRIGGER` 권한이 제거되지 않음. Supabase가 public schema 테이블에 부여하는 기본 권한이 잔류.

### 0036 보완 내용

- Migration 0036: BEGIN/COMMIT 단일 트랜잭션으로 6개 관계(tables+views) REVOKE ALL FROM PUBLIC,anon,authenticated + GRANT SELECT TO anon,authenticated, 2개 sequence REVOKE ALL. 데이터 DML/TRUNCATE 없음.
- Rollback 0036: **fail-closed 보안 rollback** — pre-0036 insecure 기본값 복원 대신 동일한 REVOKE ALL + GRANT SELECT 유지. "pre-0036 정확 복원" 거짓 주장 제거. insecure 권한 추측 GRANT 금지.

### 검증

- dryrun validator: 0036 migration/rollback 존재, 6개 관계 REVOKE ALL + GRANT SELECT, 2개 sequence REVOKE ALL, DML 없음, fail-closed 경고, 거짓 복원 주장 없음 확인
- unittest TestMigration0036AclHardening: 13건 — 존재/BEGIN·COMMIT/6관계 REVOKE·GRANT/2 sequence REVOKE/DML 미포함/rollback fail-closed·거짓 주장 금지/rollback ACL 보존

### 정책 카탈로그 호환성 교정

- `pg_policies.roles`는 `name[]`이므로 `roles::text[]`로 명시 변환 후 역할 배열을 비교한다.
- `pg_policies.cmd`는 `SELECT`·`ALL`을 반환하므로 ACL 축약값 `r`·`*`를 사용하지 않는다.
- 빈 역할 배열을 PUBLIC으로 간주하지 않고 `anon`+`authenticated` 모두 또는 `public` 역할을 명시적으로 요구한다.
- publish와 verify 양쪽에 동일 계약을 적용하고 회귀테스트 4건을 추가해 전체 109건을 통과했다.

## Approval C 완료 판정

- Migration 0035·0036은 공식 신규 Supabase에 적용됐고 local/remote 이력이 일치한다.
- Approval C 3차 게시는 단일 트랜잭션으로 COMMIT됐으며 lineage marker 5건을 `chg-g6-002-v1`로 설정했다.
- 게시 후 검증에서 G6 도메인 기준 건수, PK/FK/VIEW, mapping, private column exclusion, RLS/ACL/`pg_policies`, lineage 5건 경계가 모두 PASS했다.
- anon Data API에서 public 5종과 `chg-g6-002-v1` lineage 5건의 exact count를 독립 재확인했고, private mapping은 HTTP 404로 차단됨을 확인했다.
- Vercel·Git·기존 Foodground·레거시 Supabase는 변경하지 않았다.

**최종 판정: APPROVAL_C_PUBLISH_PASS / APPROVAL_C_VERIFY_PASS.**

## 영향 받는 파일

| 파일 | 변경 유형 |
|---|---|
| `supabase/migrations/20260831000000_0035_g6_002_lineage_publish_boundary.sql` | 신규 |
| `supabase/rollback/20260831_0035_g6_002_lineage_publish_boundary_rollback.sql` | 신규 |
| `supabase/migrations/20260831001000_0036_g6_002_public_acl_hardening.sql` | 신규 (교정) |
| `supabase/rollback/20260831_0036_g6_002_public_acl_hardening_rollback.sql` | 신규 (교정: fail-closed) |
| `scripts/chg_g6_002_publish.sql` | 수정 (섹션 5, 7 ACL) |
| `scripts/chg_g6_002_publish_rollback.sql` | 수정 (섹션 2) |
| `scripts/chg_g6_002_verify.sql` | 수정 (섹션 8, 7b ACL) |
| `scripts/chg_g6_002_dryrun_validator.py` | 수정 (0035+0036 검증) |
| `scripts/test_chg_g6_002_load_package.py` | 수정 (0035 26건 + 0036 13건 = 39건 추가, 전체 105건) |
