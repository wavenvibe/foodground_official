# VS-6 커밋 후보 사전 감사 매니페스트

Date: 2026-08-28
Branch: codex/g1-baseline
Remote: https://github.com/wavenvibe/foodground_official.git ✅
`git diff --check`: 0 실제 오류 (LF→CRLF 경고 18개, 코드 무결성 영향 없음) ✅

---

## 1. 커밋 포함 — 앱 코드 (CHG-G4-002 승인 범위)

### 신규 (untracked)
| 경로 | VS | 설명 |
|------|-----|------|
| `app/api/facilities/` | VS-5 | 시설 목록·상세 API Route Handler |
| `app/api/ingredients/` | VS-3 | 식재료 API Route Handler |
| `app/api/recipes/` | VS-3 | 레시피 API Route Handler |
| `app/api/search/facilities/` | VS-3 | 시설 검색 API |
| `app/api/substitutes/` | VS-4 | 대체 식재료 API Route Handler |
| `app/facilities/` | VS-5 | 시설 목록·상세 페이지 (FG-FUN-034 포함) |
| `app/ingredients/` | VS-3 | 식재료 목록·상세 페이지 |
| `app/recipes/` | VS-3 | 레시피 목록·상세 페이지 |
| `app/substitutes/` | VS-4 | 대체 식재료 검색 페이지 |
| `components/CopyButton.tsx` | VS-5 | 문의문안 복사 버튼 |
| `components/StatePanel.tsx` | VS-3 | 상태 패널 (로딩·오류·빈 결과) |
| `components/facilities/` | VS-5 | 시설 관련 컴포넌트 |
| `components/substitutes/` | VS-4 | 대체 식재료 컴포넌트 |
| `lib/facilities.ts` | VS-5 | 시설 데이터 접근 레이어 |
| `lib/ingredients.ts` | VS-3 | 식재료 데이터 접근 레이어 |
| `lib/recipes.ts` | VS-3 | 레시피 데이터 접근 레이어 |
| `lib/substitutes.ts` | VS-4 | 대체 식재료 데이터 접근 레이어 |
| `lib/supabase-public-server.ts` | VS-3 | 서버 전용 Supabase 클라이언트 |
| `lib/fixtures/` | VS-3 | 테스트 픽스처 |
| `playwright.config.ts` | VS-4 | Playwright 설정 (desktop/mobile 2 프로젝트) |

### 수정 (modified — 앱 코드)
| 경로 | 변경 내용 |
|------|----------|
| `app/globals.css` | 필터 조건 패널 CSS (FG-FUN-034), 시설 상세 스타일 |
| `app/page.tsx` | 홈 페이지 업데이트 |
| `app/components/SearchForm.tsx` | 검색 폼 컴포넌트 |
| `app/search/page.tsx` | 검색 페이지 |
| `components/Header.tsx` | 헤더 내비게이션 |
| `components/FacilityCardItem.tsx` | 시설 카드 아이템 |
| `lib/supabase.ts` | Supabase 클라이언트 설정 |
| `next.config.ts` | Next.js 설정 |
| `package.json` / `package-lock.json` | 의존성 (현재 설치 버전 스냅샷) |

### 수정 — 호환 경로 (architecture.md 승인)
| 경로 | 변경 내용 | 판정 |
|------|----------|------|
| `app/b/[id]/page.tsx` | 풀 구현 → redirect 스텁 (레거시 호환 경로) | ✅ 포함 — architecture.md: "compatibility routes may redirect" |
| `app/b/[id]/FacilitySaveButton.tsx` | ESLint disable 주석 추가 (lint fix) | ✅ 포함 |
| `app/products/ProductSaveButton.tsx` | ESLint disable 주석 추가 (lint fix) | ✅ 포함 |
| `app/saved/page.tsx` | ESLint disable 주석 추가 (lint fix) | ✅ 포함 |

---

## 2. 커밋 포함 — 테스트

| 경로 | VS | 설명 |
|------|-----|------|
| `e2e/vs4-live.spec.ts` | VS-4 | 대체 식재료 E2E (32 passed, 2 skipped) |
| `e2e/vs5-live.spec.ts` | VS-5 | 시설 상세·ContactButton E2E (37 passed, 7 skipped) |
| `e2e/vs6-integration.spec.ts` | VS-6 | 통합 E2E (57 passed, 21 skipped) |

---

## 3. 커밋 포함 — 프로젝트 하네스

| 경로 | 설명 |
|------|------|
| `AGENTS.md` | 저장소 경계·실행 규칙 |
| `CLAUDE.md` | 프로젝트 지시 (@import 구조) |
| `.moai/project/architecture.md` | 아키텍처 제약 (CLAUDE.md @import) |
| `.moai/project/current-slice.md` | VS 진행 현황 (CLAUDE.md @import) |
| `.moai/project/product.md` | 제품 기준선 (CLAUDE.md @import) |
| `.moai/project/quality-gates.md` | 품질 게이트 (CLAUDE.md @import) |
| `.moai/project/approvals/` | 승인 기록 (G3-07, 승인점 A/B/C) |
| `.moai/project/reviews/` | 리뷰 기록 |
| `.moai/project/work-orders/` | 작업 지시서 (CHG-G4-002) |
| `.moai/design/chg-g4-002/` | G4 설계 산출물 |
| `.claude/commands/foodground/` | Foodground 슬래시 커맨드 |
| `.claude/rules/foodground/` | Foodground 규칙 |
| `.moai/project/brand/brand-voice.md` | 브랜드 보이스 |
| `.moai/project/brand/target-audience.md` | 타겟 오디언스 |
| `.moai/project/brand/visual-identity.md` | 비주얼 아이덴티티 |

---

## 4. 커밋 포함 — QA 문서

| 경로 | 설명 |
|------|------|
| `docs/qa/vs4-vs5-final.md` | VS-4/VS-5 QA 증거 |
| `docs/qa/vs6-integration-evidence.md` | VS-6 통합 E2E 결과 |
| `docs/qa/vs6-local-performance.md` | 로컬 성능 진단 (수정됨) |
| `docs/qa/vs6-security-check.md` | 보안 체크 (수정됨 — ws 정확히 기술) |
| `docs/qa/vs6-release-readiness.md` | 릴리스 준비 상태 (수정됨) |
| `docs/qa/vs6-precommit-manifest.md` | 이 파일 |
| `docs/qa/evidence/vs6/` | 대표 스크린샷 9종 (home, substitutes, facilities, ContactButton) |
| `docs/architecture/` | 아키텍처 문서 |
| `docs/design/` | 설계 문서 |

---

## 5. 커밋 포함 — Supabase·마이그레이션·스크립트

| 경로 | 설명 |
|------|------|
| `supabase/` | Supabase 마이그레이션 SQL (승인점 A 완료) |
| `scripts/vs2_*.py` / `.mjs` / `.sql` / `.ps1` | VS-2 데이터 적재 스크립트 (하드코딩 경로 제거 완료) |
| `.env.example` | VS-2 스크립트 환경변수 템플릿 (신규, `FOODGROUND_*` 4종) |

### 스크립트 이식성 패치 (사전 감사 태스크 4)

하드코딩된 Windows 절대 경로를 환경변수로 대체:

| 파일 | 변경 내용 |
|------|----------|
| `scripts/vs2_validate.py` | `FOODGROUND_ANALYSIS_DIR`, `FOODGROUND_RECIPE_DB`, `FOODGROUND_FACILITY_DB` env var 참조 |
| `scripts/vs2_load_standard_foods.py` | 동일 |
| `scripts/vs2_load_recipes.py` | 동일 |
| `scripts/vs2_load_ingredient_name_match.py` | 동일 |
| `scripts/vs2_load_substitute_pairs.py` | 동일 |
| `scripts/vs2_run_approval_b_secure.ps1` | `$env:FOODGROUND_PYTHON_EXE` → `Get-Command python` 자동 탐지 |
| `scripts/vs2_publish_public_secure.ps1` | 동일 |
| `scripts/vs2_resume_approval_b.ps1` | 동일 |
| `scripts/vs2_resume_facilities.ps1` | 동일 |

`py_compile` ✅ / PowerShell AST 구문 검사 ✅

---

## 6. 커밋 제외

| 경로 | 이유 |
|------|------|
| `.env.local` | 환경변수 — git 미추적 확인 ✅ |
| `.vercel/` | Vercel 프로젝트 메타 — git 미추적 |
| `node_modules/` | 의존성 — git 미추적 |
| `.next/` | 빌드 산출물 — git 미추적 |
| `.claude/settings.local.json` | 로컬 세션 설정 — 사용자 지시 제외 |
| `.claude/hooks/moai/handle-stop-goal.sh` | 비공식 Stop 훅 — 사용자 지시 제외 |
| `.claude/hooks/moai/sync-phase-quality-gate.sh` | 비공식 Stop 훅 — 사용자 지시 제외 |
| `output/playwright/` | Playwright 스크린샷 (용량 + 민감 경로) |

---

## 7. 커밋 포함 — 설정 파일 확정

| 경로 | 확정 값 / 내용 | 판정 |
|------|--------------|------|
| `.moai/config/sections/quality.yaml` | `development_mode`: **ddd**, `test_coverage_target`: **85**, `ddd_settings.require_existing_tests`: **true**, `coverage_exemptions.enabled`: **false**, `max_exempt_percentage`: **5** | ✅ 포함 — G4 구현 의도 반영 확인 |
| `.moai/config/sections/db.yaml` | `enabled: true`, engine: postgresql-supabase, 마이그레이션 도구 설정 | ✅ 포함 — VS-2 진행 중 설정됨 |
| `.moai/config/sections/project.yaml` | 프로젝트 이름·설명 업데이트 | ✅ 포함 |
| `.moai/config/sections/workflow.yaml` | 워크플로 설정 변경 | ✅ 포함 |
| `START_CHG_G4_002.md`, `START_CHG_G4_002_v0.2.md`, `START_G3_07_v0.3.md`, `START_HERE_G3_DESIGN.md` | 세션 시작·설계 문서 (4개) | ✅ **제외** — `.gitignore` `START_*.md` 패턴으로 차단 |
| `05-checks/` | VS-6 로컬 QA 체크 결과 디렉토리 | ✅ 포함 — QA 증거 |
| `.env.example` | `FOODGROUND_*` 환경변수 템플릿 (신규, 실제 키 없음) | ✅ 포함 — `.gitignore` `!.env.example` 예외 추가 완료 |
| `scripts/vs2_export_facilities.py` | `FOODGROUND_FACILITY_DB` env var 참조, 절대경로 제거 | ✅ 포함 |
| `scripts/vs2_export_ingredients.py` | `FOODGROUND_RECIPE_DB` env var 참조, 절대경로 제거 | ✅ 포함 |
| `scripts/vs2_export_recipes_master.py` | `FOODGROUND_RECIPE_DB` env var 참조, 절대경로 제거 | ✅ 포함 |
| `scripts/vs2_export_recipe_ingredients.py` | `FOODGROUND_RECIPE_DB` env var 참조, 절대경로 제거 | ✅ 포함 |

---

## 8. 시크릿 스캔 결과

| 항목 | 결과 |
|------|------|
| `.env.local` git 추적 | ✅ 미추적 확인 |
| Service role 키 소스 노출 | ✅ 없음 (vs6-security-check.md 확인) |
| 구 Supabase ref 참조 | ✅ 없음 |
| 신 Supabase ref 하드코딩 | ✅ `supabase-public-server.ts` 내 ref 검증용으로만 사용 (anon-safe) |

---

## 9. 최종 확인

| 항목 | 상태 |
|------|------|
| `git diff --check` | ✅ 0 오류 |
| Remote origin | ✅ `wavenvibe/foodground_official` |
| 레거시 저장소·Vercel·Supabase 변경 | ✅ 없음 |
| commit·push·Vercel 배포 실행 | ✅ 미실행 (사용자 승인 대기) |
