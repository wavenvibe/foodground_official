# CHG-G6-002 G4 VS-G 원격 읽기전용 준비 감사 v0.1

## 1. 목표

VS-F 로컬 패키지 완성 후, 실제 공식 Supabase 프로젝트에 대한 읽기전용 메타데이터 수집과 로컬 재검증을 수행하여 승인 A/B/C 진입 준비 상태를 감사한다. 원격 상태 변경은 0건이다.

## 2. 권위 기준

1. 대상 프로젝트 ref: linked project ref (CLI 검증 완료, `supabase/.temp/project-ref`)
2. VS-E/VS-F PASS 상태
3. 원격 실행 금지 원칙: 이 슬라이스에서 승인 A/B/C를 실행하지 않는다

## 3. 검증된 사실 (CLI 메타데이터 + 읽기전용 통계)

| 항목 | 값 | 출처 |
|---|---|---|
| 프로젝트 상태 | ACTIVE_HEALTHY | projects list |
| 리전 | ap-south-1 | projects list |
| PostgreSQL | 17.6.1.105 (PG 17 GA) | postgres-version |
| 풀러 | pooler.supabase.com:5432 (ap-south-1) | pooler-url |
| 로컬 링크 | linked=true | linked-project.json |
| CLI 버전 | 2.116.0 | --version |
| 레거시 프로젝트 | linked=false, 별도 리전, 격리 확인 | projects list |
| 데이터베이스 크기 | 561 MB | db-stats |
| 총 테이블 크기 | 227 MB | db-stats |
| 총 인덱스 크기 | 322 MB | db-stats |
| 감사시점 WAL 크기 | 672 MB | db-stats |
| 테이블/인덱스 히트율 | 1.00 / 1.00 | db-stats |
| 일일 물리 백업 | 7건 COMPLETED, PITR=false, walg=true | backups list |
| DB 역할 연결 한도 | 60 (감사시점 저사용량) | role-connections |
| Supavisor 풀 크기 | **대시보드 미확인** (역할 연결 한도와 별개) | — |
| 실제원본 dry-run | PASS (건수 일치, FK orphan 0, mode=ro) | Python 3.11 |

## 4. 공식 정책 교차검증 (Official Policy Cross-Check, 2026-08-31)

### 4.1 플랜 티어 (D-1 해소)

**Pro (사용자 제공 대시보드 UI 증거)**. 사용자가 대시보드 UI에서 직접 확인한 정보이며, CLI 증거가 아님.

### 4.2 디스크 용량 정책 (D-2 해소, D-3 해소)

**공식 정책 기준선**:
- Supabase Pro 플랜은 프로젝트당 최소 **8 GB 범용(gp3) 디스크**를 포함한다.
- 초과분은 프로비저닝된 디스크에 대해 **USD 0.125/GB/월**로 과금된다.
- 유료 플랜 디스크는 사용률 90% 도달 시 50%씩 자동 확장되며, 24시간 내 최대 4회 수정으로 제한된다.
- 1.5배 이상의 대량 임포트 시 자동 확장에 의존하지 말고 수동 디스크 크기 검토/확장을 선행해야 한다.
- 데이터베이스 크기와 디스크 사용량은 별개 개념이다. 디스크 사용량에는 WAL, 시스템 파일이 포함되므로 검증된 561 MB 데이터베이스 + 672 MB WAL을 데이터베이스 크기 수치만으로 비교할 수 없다.
- Pro 일일 물리 백업은 최근 7일 보존. PITR은 유료 애드온이며 현재 비활성. 복원 테스트는 수행되지 않았다.

**공식 문서 출처**:
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/manage-your-usage/disk-size
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/pricing

**대시보드 확인 완료 (018 사용자 제공 증거)**:
- 리사이즈 전 실제 디스크: **4 GB** provisioned, **1.65 GB** used (기존 "8 GB" 정책 기준선은 포함 할당 상한이며, 실제 할당은 4 GB였음)
- 사용자가 대시보드에서 **4 GB → 8 GB** 리사이즈 실행 (Pro 포함 할당 이내, 디스크 초과 과금 없음)
- **Spend Cap**: 활성화 (초과 과금 차단)
- 리사이즈 후 예상 여유: ~6.35 GB (>= 2.5 GB 안전 임계값 충족)
- 롤링 디스크 수정 한도: 약 4시간 잔여 시점에서 도달. Approval A/B에 추가 디스크 변경 불필요
- 컴퓨트: **Nano**, 낮은 CPU, 보통 메모리, 낮은 연결. 변경 없음 (Micro 적용 주장하지 않음)
- 백업: **7개** 복원 가능한 일일 물리 백업. PITR 비활성. 복원 테스트 미수행

### 4.3 >=2.5 GB 잔여 여유 pre-B 규칙 (PASS)

보수적 **>=2.5 GB 잔여 디스크 여유** 규칙을 유지한다. 리사이즈 후 8 GB 중 ~1.65 GB 사용, 예상 여유 ~6.35 GB로 **2.5 GB 임계값 충족**. Spend Cap 활성으로 디스크 초과 과금도 차단됨.

## 5. 사용자 복귀 체크리스트 (018 갱신: Approval A 완료)

Approval A 실행 전 사용자 대시보드 확인 결과 (사용자 제공 증거):

| # | 항목 | 결과 |
|---|---|---|
| RC-1 | 실제 프로비저닝된 디스크 / 현재 사용률 / 디스크 유형 | 4 GB → **8 GB 리사이즈** (1.65 GB used, gp3), 여유 ~6.35 GB |
| RC-2 | Spend Cap 상태 및 초과 과금 허용 여부 | **Spend Cap 활성** (초과 과금 차단) |
| RC-3 | 컴퓨트 크기 | **Nano**, 낮은 CPU, 보통 메모리, 낮은 연결. 변경 없음 |
| RC-4 | COMPLETED 물리 백업 확인 | **7건** 복원 가능 일일 물리 백업, PITR 비활성 |

> 018 갱신: 4개 항목 모두 사용자 대시보드 UI 증거로 확인 완료. Approval A 실행 및 PASS.

## 6. 저장 용량 시나리오

### 6.1 현재 검증된 데이터베이스 풋프린트

| 항목 | 값 |
|---|---|
| 데이터베이스 크기 | 561 MB |
| 총 테이블 크기 | 227 MB |
| 총 인덱스 크기 | 322 MB |
| 감사시점 WAL 크기 | 672 MB |

### 6.2 예상 영구 증분 풋프린트 (선택지 C/VIEW 기준)

| 시나리오 | 증분 추정 | 가정 |
|---|---|---|
| Low (staging TRUNCATE) | ~0.55 GB | products_public + 인덱스 + 소형 + WAL |
| Base (staging 보존) | ~0.88 GB | Low + staging 320 MB |
| High (인덱스 상한) | ~1.08 GB | Base + GIN 200 MB |

### 6.3 적재 후 예상 데이터베이스 크기

| 시나리오 | 적재 후 예상 크기 |
|---|---|
| Low | ~1.11 GB |
| Base | ~1.44 GB |
| High | ~1.64 GB |

> 위 수치는 일시적 load/publish WAL 및 vacuum 오버헤드를 **제외**한다.

### 6.4 최소 잔여 디스크 여유 권고

필수 pre-B 권고: 최소 **2.5 GB 잔여 디스크 여유**. 이는 안전 임계값이며 Supabase 플랜 한도를 주장하는 것이 아니다.

근거: 현재 WAL이 이미 672 MB이고 두 차례 벌크 쓰기 단계(staging load + publish)가 계획되어 있어 이전 1.5 GB 권고는 충분히 보수적이지 않다. Supabase 플랜 한도 미확인이므로 PASS/FAIL 불가

## 7. 승인 A/B/C 게이트

### 승인 A: DDL Migration (0028-0034)

**진입 조건**:
- [ ] 대시보드 D-1~D-4 확인 완료
- [ ] 잔여 용량 >= 2.5 GB (§6.4)
- [ ] VS-2 7개 테이블 존재 확인
- [ ] 프로젝트 ref 일치 확인
- [ ] `-Approved` 플래그로 명시적 승인

**실행**: `npx supabase db push` (linked ref 대상, 7개 migration 순차 적용)

**중단 조건**:
- 전제조건 guard 실패 (0020/0025 부재)
- `db push` 비영 종료코드
- ref 불일치

**실패 시 rollback**: `supabase/rollback/20260830_0028_0033_vs-a_g6_002_rollback.sql`

### 승인 B: Staging Load

**진입 조건**:
- [ ] 승인 A 성공
- [ ] 연결 풀 한도 확인 (D-5)
- [ ] FOODGROUND_SOURCE_DB 설정 + source 파일 존재
- [ ] SUPABASE_DB_URL SecureString 입력

**실행**: `chg_g6_002_staging_loader.py` (5 datasets, 청크 커밋, TLS 강제)

**기대 건수**:
| Dataset | 건수 |
|---|---|
| production_log_raw | 1,047,894 |
| haccp_cert_raw | 308 |
| sales_suspension_raw | 355 |
| company_profiles_raw | 308 |
| company_profile_mapping | 308 |

**중단 조건**: DSN 실패, fingerprint 불일치, lock 충돌, 건수 불일치, source 변경

**실패 시**: checkpoint 'failed' → `--resume` 재개 또는 staging TRUNCATE

### 승인 C: Publish + Verify

**진입 조건**:
- [ ] 승인 B 성공 (5 datasets 건수 대조 완료)

**실행**:
1. `chg_g6_002_publish.sql` — atomic TRUNCATE+INSERT
2. `chg_g6_002_verify.sql` — 건수/PK/FK/VIEW/RLS/ACL/pg_policies
3. Data API smoke test — anon SELECT 성공 + 쓰기 차단

**기대 결과**:
| 테이블 | 기대 건수 |
|---|---|
| products_public | 1,047,894 |
| facility_products_public (VIEW) | 815,989 |
| haccp_certifications_public | 308 |
| facility_safety_public | 103 |
| manufacturing_profiles_public | 265 |

**중단 조건**: publish 트랜잭션 실패, verify RAISE EXCEPTION, 보안 위반

**실패 시**: `chg_g6_002_publish_rollback.sql` (data TRUNCATE) 또는 전체 rollback

## 8. Rollback 결정표

| 실패 지점 | rollback 범위 | 명령 |
|---|---|---|
| 승인 A 중 migration 실패 | 전체 schema rollback | rollback SQL |
| 승인 B 중 load 실패 | checkpoint → resume/TRUNCATE | loader --resume 또는 수동 |
| 승인 B 후 건수 불일치 | staging TRUNCATE + 재적재 | 수동 |
| 승인 C 중 publish 실패 | publish_rollback (TRUNCATE) | publish_rollback SQL |
| 승인 C 후 verify 실패 | publish_rollback → 원인분석 | publish_rollback SQL |
| RLS/ACL 보안 위반 | 즉시 전체 rollback | 전체 rollback SQL |
| 전체 철회 | 전체 schema + data rollback | 전체 rollback SQL |

## 9. 로컬 재검증 결과 (2026-08-31, Python 3.11.7)

| # | 검증 | 결과 |
|---|---|---|
| 1 | py_compile (7 scripts) | PASS |
| 2 | unittest (67 tests) | PASS |
| 3 | Staging loader --dry-run | PASS (fail-closed) |
| 4 | Preflight --dry-run | PASS (0 errors) |
| 5 | Comprehensive validator (13 sections) | PASS (0 errors) |
| 6 | PowerShell AST parse | PASS |
| 7 | git diff --check | PASS |
| 8 | Document register | PASS |
| 9 | Secret/path scan | PASS (0 findings) |
| 10 | Legacy ref scan | PASS (0 matches) |
| 11 | 실제원본 읽기전용 dry-run (Python 3.11) | PASS (건수 일치, FK orphan 0, mode=ro) |

## 10. 레거시 프로젝트 격리

- 레거시 ref가 migration/script에 없음: PASS
- 레거시 ref가 이 저장소에 미연결: PASS
- validate_dsn()이 레거시 호스트 거부: PASS
- Supabase CLI가 linked ref만 대상: PASS

## 11. 게이트 상태 구분

| 게이트 | 현재 상태 | 의미 |
|---|---|---|
| `READONLY_AUDIT_COMPLETE` | **달성** | 모든 읽기전용/로컬 감사 완료. CLI 메타데이터·db-stats·백업·연결·실제원본 dry-run 검증됨. |
| `CAPACITY_POLICY_READY` | **달성** | 공식 Pro 정책 기준선(8 GB gp3, USD 0.125/GB/월 초과) 교차검증 완료. |
| `READY_FOR_APPROVAL_A` | **달성** | 대시보드 디스크(4→8 GB 리사이즈)·Spend Cap(활성)·백업(7건)·컴퓨트(Nano) 확인 + 사용자 승인 완료. |
| `APPROVAL_A_PASS` | **달성** (018) | DDL migration 0028-0034 원격 적용 완료. 7개 migration 성공, 테이블 0행, Data API 읽기 성공, private/staging 미노출. 스키마 덤프 SKIPPED (Docker 미사용). |
| `APPROVAL_B_DATA_PASS` | **달성** | staging 5종 적재, exact count, checkpoint/lineage, 원본 불변성 검증 PASS. |
| `APPROVAL_C` | **BLOCKED** | `PUBLIC-LINEAGE-001` 보완 migration과 별도 DDL 승인 필요. |

## 12. 원격 변경 기록 (018 갱신)

- G6 migrations 0028-0034: **Approval A에서 원격 적용 완료** (DDL/RLS/ACL only, 데이터 0행)
- Approval A 실행 범위: `db push` 7개 migration, 데이터 적재/publish/Vercel/Git 없음
- 스키마 덤프: **SKIPPED** (Docker 미사용, migration 실패 아님)
- Approval B (staging load): **DATA PASS** — 5종 적재 및 checkpoint/lineage 검증 완료
- G6 public 도메인 객체: 0행 유지, 기존 VS-2 public 행수 불변
- `PUBLIC-LINEAGE-001`: 기존 public lineage view에서 미게시 staging lineage 메타데이터 5건 anon 조회 확인
- Approval C: **BLOCKED**, 별도 DDL 보완 승인 전 publish 금지
- app/component/library/migration/script 파일: **이 마감에서 변경 없음** (거버넌스·QA 문서만 갱신)

## 13. 절대 금지

- Approval C 실행
- 추가 Supabase DDL·데이터 수정·publish
- 레거시 Supabase 접근
- Vercel 변경
- Git commit/push/PR/merge
- 원본 데이터 수정
- 설정·자격증명·스크립트·migration 변경

## 14. Approval B 실행 결과

| 대상 | exact count | 판정 |
|---|---:|---|
| staging.production_log_raw | 1,047,894 | PASS |
| staging.haccp_cert_raw | 308 | PASS |
| staging.sales_suspension_raw | 355 | PASS |
| staging.company_profiles_raw | 308 | PASS |
| private.company_profile_mapping | 308 | PASS |

- checkpoint 5개 `completed`, expected loaded_rows 일치: PASS
- checkpoint/lineage dataset·fingerprint·row_count 일치: PASS
- 적재 후 원본 불변성: PASS
- G6 public 도메인 객체 5종 0행: PASS
- 기존 VS-2 public 7개 테이블 행수 불변: PASS
- 미게시 lineage 5건의 anon 메타데이터 노출: FAIL (`PUBLIC-LINEAGE-001`)

따라서 Approval B 데이터 적재는 완료됐으나 Approval C는 차단한다.

## 15. VS-H 로컬 보완 준비 상태

- `PUBLIC-LINEAGE-001` 보완 migration 0035와 스키마 rollback을 로컬 작성했다.
- 게시·데이터 rollback·사후검증 SQL은 현재 staging 5종에서 run ID를 파생하고 고정 기대 건수, completed checkpoint, lineage `(id, dataset_name)`, 서로 다른 run ID 5개를 교차검증한다.
- py_compile PASS, 단위 테스트 93건 PASS, dry-run validator 0 오류, git diff 오류 0건이다.
- 원격 migration 0035, anon 재검증, Approval C publish는 실행하지 않았다.
- 게이트는 `LOCAL_LINEAGE_FIX_READY / APPROVAL_C_BLOCKED`이며 다음 원격 단계는 별도 사용자 승인 대상이다.
