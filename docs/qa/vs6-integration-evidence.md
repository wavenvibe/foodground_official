# VS-6 통합 QA 증거

Date: 2026-08-29 (운영배포 결과 반영)
Branch: main (SHA: 68963ef82798aa3219ddf8e2344f0a4eab73c63f)
운영 URL: https://foodground-official.vercel.app
배포 ID: dpl_5G666iP5aBn53B46cUJemn6r1B2a

---

## 운영 스모크 QA (Playwright — 2026-08-29)

**Target**: `https://foodground-official.vercel.app`
**Result**: **19 passed, 5 skipped, 0 failed**

| 화면 | desktop 1440×1000 | mobile 390×844 |
|------|------------------|----------------|
| 홈 (`/`) | ✅ 200, overflow 없음 | ✅ 200, overflow 없음 |
| 레시피 목록 (`/recipes`) | ✅ 200 | ✅ 200 |
| 레시피 상세 (`/recipes/6942782`) | ✅ 200 | ✅ 200 |
| 식재료 목록 (`/ingredients`) | ✅ 200 | ✅ 200 |
| 대체 식재료 (`/substitutes?ingredient=가시오갈피`) | ✅ 200, exact match | ✅ 200, exact match |
| 시설 목록 (`/facilities`) | ✅ 200 | ✅ 200 |
| 시설 상세 (`/facilities/3450000-106-2006-00035`) | ✅ 200 | ✅ 200 |
| API 비공개 컬럼 미노출 | ✅ | — (desktop-only) |
| API 에러 FG_* 형식, SQL 미노출 | ✅ | — (desktop-only) |
| 검색 리다이렉트 (`/search` → `/facilities`) | ✅ | — (desktop-only) |

스크린샷: `docs/qa/evidence/vs6-production/` (14개)

---

## 로컬 통합 QA (2026-08-28, 원본)

---

## 정적 검증

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ 0 errors, 3 warnings (pre-existing) |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ Compiled successfully |

---

## VS-6 통합 E2E

**Command**: `npx playwright test e2e/vs6-integration.spec.ts --reporter=line`
**Result**: 57 passed, 21 skipped, 0 failed

### 스킵 사유

| Test | Reason |
|------|--------|
| `home: shows nav links` (mobile) | desktop-only (`testInfo.project.name !== "desktop"`) |
| `home: mobile hamburger opens menu` (desktop) | mobile-only |
| `facilities: keyword filter...` (mobile) | desktop-only (API 검증) |
| `facilities: sido filter...` (mobile) | desktop-only (API 검증) |
| `facilities: haccp filter...` (mobile) | desktop-only (API 검증) |
| `facilities: status filter...` (mobile) | desktop-only (API 검증) |
| `facilities: pagination...` (mobile) | desktop-only (API 검증) |
| `facilities: write request rejected` (mobile) | desktop-only |
| `facilities: filter context panel FG-FUN-034` (mobile) | desktop-only |
| `api: *` (mobile × 6) | desktop-only (API 검증) |
| `a11y: nav links...` (mobile) | desktop-only |
| `a11y: state panels...` (mobile) | desktop-only |
| `responsive: / no overflow desktop` (mobile) | wrong viewport |
| `responsive: /facilities no overflow desktop` (mobile) | wrong viewport |
| `responsive: / no overflow mobile` (desktop) | wrong viewport |
| `responsive: /facilities no overflow mobile` (desktop) | wrong viewport |

> 총 21 skips = 각 viewport에 맞지 않는 테스트 또는 API-level 검증은 desktop 전용

### 주요 검증 항목

| 항목 | 결과 |
|------|------|
| 홈, 레시피, 식재료, 대체 식재료, 제조시설 페이지 로딩 | ✅ 200, no error state |
| substitutes: empty/unmatched/exact match 상태 분기 | ✅ |
| substitutes: 100자 long query, XSS 시도 → 200 no crash | ✅ |
| facilities: sido/haccp/status API-level 필터 검증 | ✅ |
| facilities: pagination 2페이지 중복 없음 | ✅ |
| facilities: POST 405 (write rejection) | ✅ |
| facilities: invalid ID → error/404 state (not crash) | ✅ |
| FG-FUN-034: 필터 목록 → 상세 이동 시 filter context 패널 표시 | ✅ 경기도 + HACCP 텍스트 확인 |
| API: 비공개 컬럼 누출 없음 (road_addr, coord_x, suspension_count 등) | ✅ |
| API: 한글 mgt_no → 400 + FG_BAD_REQUEST | ✅ |
| API: 존재하지 않는 mgt_no → 404 | ✅ |
| 반응형: 양 viewport 오버플로 없음 | ✅ |
| 접근성: Tab 키 포커스 진입 가능 | ✅ |

### 스크린샷

커밋 포함 경로: `docs/qa/evidence/vs6/`

| 파일 | 내용 |
|------|------|
| `home-desktop.png` | 홈 1440px |
| `home-mobile.png` | 홈 390px |
| `substitutes-desktop.png` | 대체 식재료 1440px |
| `substitutes-mobile.png` | 대체 식재료 390px |
| `facilities-list-desktop.png` | 시설 목록 1440px |
| `facilities-list-mobile.png` | 시설 목록 390px |
| `facilities-filter-context-desktop.png` | FG-FUN-034 필터 컨텍스트 패널 1440px |
| `facilities-contactbtn-success-desktop.png` | ContactButton 복사 성공 |
| `facilities-contactbtn-fallback-desktop.png` | ContactButton fallback |

---

## 알려진 한계

- FG-FUN-034 filter context 패널: `is_haccp=true` 시설 상세에서만 "HACCP 일치" 표시. HACCP 미인증 시설에서는 "미충족" 표시.
- `substitutes: long query` — 100자 한글 입력 시 API가 빈 결과 반환; 빈 상태(not error)로 렌더링됨.
- `npm audit` 상태: 7 high (node_modules/ws — 개발 의존성, 런타임 취약점 아님). `npm audit fix` 미실행.
