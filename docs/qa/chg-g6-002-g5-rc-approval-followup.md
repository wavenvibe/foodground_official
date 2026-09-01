# CHG-G6-002 G5 단일 RC 승인 후속 검증

- 검증일: 2026-09-01
- 대상 브랜치: `codex/chg-g6-002-vs-i-preview`
- RC SHA: `de2e6a87f380fa241c05b8c4fd0f77c0dd18e44d`
- PR: `#3` — `main` ← `codex/chg-g6-002-vs-i-preview`
- 검증 범위: RC Preview 방향 승인 후 자동 QA, 사용자 QA 재분류, 복구 준비도 점검
- 금지 범위: PR merge, `main`, Vercel Production, Supabase DDL·DML, 기존 Foodground 변경

## 1. 결론

단일 RC의 로컬 정적·빌드·브라우저 자동회귀는 통과했다. PR #3의 원격 base/head와 SHA도 읽기 전용으로 재확인했다. 그러나 발주자 사용자 QA 54건은 아직 0/54이며, 실제 격리 PostgreSQL 복구시험도 수행하지 못했다.

따라서 현재 판정은 다음과 같다.

`RC_PREVIEW_DIRECTION_APPROVED / AUTOMATED_QA_PASS / USER_QA_0_OF_54 / ACTUAL_RESTORE_PENDING / MERGE_AND_PRODUCTION_NOT_AUTHORIZED`

## 2. 원격 RC 불변성 확인

| 항목 | 확인 결과 |
|---|---|
| 원격 `main` | `68963ef82798aa3219ddf8e2344f0a4eab73c63f` |
| 원격 RC head | `de2e6a87f380fa241c05b8c4fd0f77c0dd18e44d` |
| PR #3 | open, draft false, merged false, base `main`, mergeable clean |
| PR 누적 범위 | 9 commits, 175 files |
| RC Preview | 기존 `dpl_BTyvPTfhrz9Lu7kWWRKUq7ZbUfcX` / Preview 보호 유지 |
| Production | 변경 미실행 |

PR·브랜치 조회만 수행했으며 merge, base 재변경, 새 배포, 환경변수 변경은 하지 않았다. 보호된 Preview에 대한 비인증 단순 HTTP 요청은 인증 리다이렉트가 발생하므로 이번 후속 검증의 기능 PASS 근거로 사용하지 않았다. 기존 인증 환경에서 완료한 healthz 5/5와 데이터 스모크는 이전 RC 증거로 보존했다.

## 3. 자동 QA 결과

| 검증 | 결과 |
|---|---|
| ESLint | PASS — 오류 0, 경고 6 |
| TypeScript `--noEmit` | PASS |
| Next.js production build | PASS |
| 데이터 패키지 단위시험 | PASS — 109/109 |
| dry-run validator | PASS — 오류 0 |
| 통합 Playwright 7개 스펙 | PASS — 230 passed, 32 conditional skips, 0 failed |

Playwright는 VS-4·VS-5·VS-6 회귀, VS-I 공식 데이터 기능, G5 요구사항 대조, 제품화 흐름·검토함, RC healthz를 포함한다. 32개 skip은 반대 뷰포트 또는 환경 조건에 따른 의도된 제외이며 실패에 포함하지 않는다.

### 시험계약 교정

자동회귀를 현재 승인 화면과 실행환경에 맞추기 위해 다음 로컬 시험파일을 교정했다.

- `e2e/chg-g6-002-vs-i.spec.ts`: 하드코딩된 3013 포트 대신 `VSD_BASE_URL`·`PLAYWRIGHT_BASE_URL`을 우선 사용
- `e2e/vs4-live.spec.ts`: 폐기된 식재료 단독 메뉴 대신 제품·레시피·대체 식재료·공동제조·제조시설·검토함 확인
- `e2e/vs6-integration.spec.ts`: 동일한 현재 내비게이션 계약으로 정렬

이 3개 파일은 로컬 수정 상태이며 이번 작업에서 commit·push하지 않았다.

## 4. DOC-13 사용자 QA 상태

`DOC-13_시험계획_QA_UAT목록_v0.6.xlsx`로 현재 화면 범위를 반영했다.

| 구분 | 건수 | 상태 |
|---|---:|---|
| 개발자 자동증빙이 있는 항목 | 50 | 자동시험 PASS, 발주자 결과는 `미시험` |
| 사람·OS·외부앱 확인이 필요한 항목 | 4 | `미시험` |
| 발주자 사용자 QA 전체 | 54 | **0/54 승인** |

수동 4건은 클립보드 거부 처리, 전화 연결 핸들러, 외부 홈페이지 연결, 레거시 운영 사이트 보존 확인이다. 자동증빙 PASS를 사용자 승인으로 대체하지 않는다.

## 5. 복구 준비도 점검

### 수행 완료

- migration·publish·rollback SQL의 정적 계약과 보안 경계를 109개 단위시험에서 확인
- dry-run validator로 mapping·migration·ACL·lineage·rollback 구조를 확인
- 로컬 원본 및 원격 데이터에 쓰기 없이 복구 패키지의 실행 전 준비도를 확인

### 수행하지 못한 항목

실제 백업을 별도 PostgreSQL에 복원하고 서비스 검증·RPO·RTO를 측정하는 격리 복구시험은 수행하지 않았다.

- 로컬 Docker CLI는 있으나 daemon이 실행 중이 아니다.
- 로컬 `postgres`·`initdb`·`psql` 런타임을 확인하지 못했다.
- Supabase의 `Restore to new project`는 원격 프로젝트·compute를 생성할 수 있는 별도 비용·변경 작업이므로 이번 승인 범위를 벗어난다.

따라서 TEC-09의 물리 백업 7건 존재 기록은 기존 증거로 유지하되, `실제 복구 성공` 또는 RPO·RTO 달성으로 판정하지 않는다.

## 6. 다음 게이트

G5 RELEASE-GATE 전에 다음 두 항목이 남는다.

1. DOC-13 v0.6의 사용자 QA 54건 실행 및 발주자 판정
2. 별도 격리 PostgreSQL 실행환경 또는 Supabase 신규 복구 프로젝트에 대한 명시적 승인 후 실제 복구·RPO·RTO 측정

두 항목이 끝나기 전에는 PR #3 merge와 Production 배포를 승인된 것으로 간주하지 않는다.

## 7. 변경 금지 확인

- PR merge·`main`: 미실행
- Vercel Preview 재배포·Production: 미실행
- Supabase DDL·DML·migration·복원: 미실행
- 기존 `wavenvibe/foodground`·`foodground.vercel.app`: 무변경
- 테스트 교정 및 문서 갱신: 로컬 전용

## 8. 후속 격리 논리 복구훈련 결과

기존 `ACTUAL_RESTORE_PENDING` 차단사항은 2026-09-01 읽기 전용 논리 복구훈련으로 해소됐다.

| 항목 | 결과 |
|---|---|
| 원격 원본 | 승인된 공식 신규 Supabase, 읽기 전용 |
| 로컬 복원 | PostgreSQL 17 임시 데이터베이스 |
| 객체 비교 | 원본·복원본 17개 객체 건수 일치 |
| 게시 데이터 | products 1,047,894 / facility-products VIEW 815,989 / HACCP 308 / safety 103 / manufacturing 265 / mapping 308 |
| 무결성·보안 | PK·FK·VIEW·mapping·비공개 컬럼·RLS·ACL·pg_policies·lineage PASS |
| 시간 | 백업 146초 / 복원 13초 / 검증 2초 / 로컬 복원→검증 15초 |
| 정리 | 임시 아카이브·복원 DB·비밀번호 버퍼 제거 |

원본 실행 보고서는 `output/recovery-rehearsal/chg-g6-002-recovery-20260901T134117Z.md`이며 Git 제외 대상이다. 동일 결과를 비밀값 없이 보존한 추적 증거는 `docs/qa/evidence/chg-g6-002-logical-recovery-20260901T134117Z.md`다. 이 결과는 최신 공식 DB의 논리 현재상태 복원이며, Supabase 물리 백업 시점 복원·PITR·Storage 객체 복원 또는 Production RTO 보장을 의미하지 않는다.

현재 판정은 다음으로 갱신한다.

`RC_PREVIEW_DIRECTION_APPROVED / AUTOMATED_QA_PASS / LOGICAL_RECOVERY_REHEARSAL_PASS / USER_QA_0_OF_54 / RC_EVIDENCE_COMMIT_PENDING / MERGE_AND_PRODUCTION_NOT_AUTHORIZED`
