# CHG-G6-002 G5 복구 증거 커밋 전 감사

- 감사일: 2026-09-02
- 브랜치: `codex/chg-g6-002-vs-i-preview`
- 기준 HEAD: `de2e6a87f380fa241c05b8c4fd0f77c0dd18e44d`
- 범위: 격리 논리 복구 runner, 사용자 승인기록, 후속 QA·복구 증거, 현재 화면 시험계약
- 금지 범위: `git add/commit/push`, PR 변경, Vercel, Supabase 쓰기, `main`, Production

## 1. 판정

복구 관련 로컬 변경과 후속 증거의 커밋 전 감사를 통과했다. 후보는 정확히 11개이며 개인 설정·혼합 상태문서·Git 제외 output은 포함하지 않는다.

`PRECOMMIT_AUDIT_PASS / 11_CANDIDATES / SECRET_SCAN_PASS / STATIC_AND_BROWSER_QA_PASS / PUSH_APPROVAL_REQUIRED`

## 2. 커밋 후보 11개

| # | 파일 | 목적 |
|---:|---|---|
| 1 | `.moai/project/approvals/CHG-G6-002-G5-RC-PREVIEW-APPROVAL.md` | 단일 RC 후속 검증 승인 경계 |
| 2 | `.moai/project/approvals/CHG-G6-002-VS-I-PREVIEW-UAT-APPROVAL.md` | 선행 VS-I Preview UAT 승인 이력 |
| 3 | `docs/qa/chg-g6-002-g5-rc-approval-followup.md` | 자동 QA·사용자 QA·복구 후속 판정 |
| 4 | `docs/qa/chg-g6-002-g5-recovery-precommit-audit.md` | 본 감사 매니페스트 |
| 5 | `docs/qa/evidence/chg-g6-002-logical-recovery-20260901T134117Z.md` | Git 추적 가능한 비식별 복구 증거 |
| 6 | `scripts/chg_g6_002_recovery_rehearsal.ps1` | 승인 대상·비밀값·WSL staging 제어 |
| 7 | `scripts/chg_g6_002_recovery_rehearsal.sh` | 읽기 전용 dump·로컬 복원·검증·정리 |
| 8 | `scripts/chg_g6_002_wsl_secret_runner.py` | 비밀번호 console 입력·메모리 pipe |
| 9 | `e2e/chg-g6-002-vs-i.spec.ts` | 실행환경 base URL 계약 |
| 10 | `e2e/vs4-live.spec.ts` | 현재 제품화 내비게이션 계약 |
| 11 | `e2e/vs6-integration.spec.ts` | 현재 통합 내비게이션 계약 |

## 3. 명시적 제외

| 파일/범위 | 제외 이유 |
|---|---|
| `.claude/settings.local.json` | 개인 로컬 설정이며 기능·증거 범위가 아님 |
| `.moai/project/current-slice.md` | 여러 선행 상태를 함께 담은 혼합 수정으로 별도 정리 필요 |
| `output/` | `.gitignore` 대상; 스크린샷·임시 실행 산출물 포함 |
| 루트 `02_문서/` | 공식 문서관리 경로이며 앱 Git 저장소 바깥에서 별도 관리 |
| `.next/`, `node_modules/`, `.env.local` | 생성물·의존성·비밀환경 제외 |

## 4. 검증 결과

| 검증 | 결과 |
|---|---|
| recovery runner `-SelfTest` | PASS — WSL staging SHA-256, secret pipe, Bash syntax, 로컬 PG17 dump/restore |
| Python 단위시험 | PASS — 109/109 |
| G6 dry-run validator | PASS — 0 errors |
| PowerShell AST | PASS — 0 errors |
| ESLint | PASS — 0 errors, 6 warnings |
| TypeScript `--noEmit` | PASS |
| Next.js production build | PASS |
| 변경 3개 Playwright 스펙 | PASS — 139 passed, 23 conditional skips, 0 failed |
| `git diff --check` | PASS — 오류 0, 줄바꿈 경고만 존재 |
| 후보 비밀값 패턴 | PASS — 실제 키·DB URI·비밀번호 0건 |

첫 Playwright 시도에서 `127.0.0.1` origin이 Next.js 개발 리소스 정책에 의해 403 처리된 환경 오류를 확인했다. 프로젝트 개발서버를 깨끗하게 재시작하고 `localhost` origin으로 실행해 관련 8건과 전체 162건을 재검증했다. 최종 결과만 PASS 근거로 사용한다.

## 5. 복구 결과 경계

- 원본·복원본 17개 객체 건수와 Approval C가 일치했다.
- 논리 백업 146초, 복원 13초, 검증 2초, 복원 후 검증 15초다.
- 이는 Supabase 예약 물리 백업·PITR·Storage 객체 또는 Production 장애복구 RTO 검증이 아니다.
- 공식 신규 Supabase는 읽기 전용으로만 접근했고 원격 쓰기는 없었다.

## 6. 다음 승인 작업

별도 사용자 승인 후 위 11개만 stage·commit하고 현재 RC 브랜치에 force 없이 push한다. PR #3과 Vercel Preview를 갱신·재검증하되 `main`·Production·Supabase는 변경하지 않는다. 사용자 QA 54건은 별도로 0/54 상태를 유지한다.
