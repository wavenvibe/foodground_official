# VS-6 운영배포 QA 증거

Date: 2026-08-29
Status: **기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요**

---

## 1. 운영 배포 정보

| 항목 | 값 |
|------|-----|
| Vercel 프로젝트명 | `foodground-official` |
| Vercel 프로젝트 ID | `prj_ukJaRLmcVUUeZEfMn0enjGWrk6Bb` |
| 운영 URL | `https://foodground-official.vercel.app` |
| 배포 ID | `dpl_5G666iP5aBn53B46cUJemn6r1B2a` |
| 배포 Git SHA | `68963ef82798aa3219ddf8e2344f0a4eab73c63f` |
| 운영 브랜치 | `main` |
| 신규 Supabase ref | `glczrbadvfgmblmkpgfj` |
| 배포 일시 | 2026-08-28T14:02:58Z |
| 배포 상태 | READY (production) |

---

## 2. 운영 QA: Playwright E2E

**Command**: `BASE_URL=https://foodground-official.vercel.app npx playwright test e2e/vs6-production.spec.ts`
**Result**: **19 passed, 5 skipped (desktop-only API 테스트), 0 failed**

### 테스트 항목별 결과

| # | 테스트 | viewport | 결과 |
|---|--------|----------|------|
| 1 | home: loads 200 no console errors | desktop 1440×1000 | ✅ pass |
| 2 | home: loads 200 no console errors | mobile 390×844 | ✅ pass |
| 3 | recipes: list loads 200 | desktop | ✅ pass |
| 4 | recipes: list loads 200 | mobile | ✅ pass |
| 5 | recipes: detail loads 200 | desktop | ✅ pass |
| 6 | recipes: detail loads 200 | mobile | ✅ pass |
| 7 | ingredients: list loads 200 | desktop | ✅ pass |
| 8 | ingredients: list loads 200 | mobile | ✅ pass |
| 9 | substitutes: exact match returns data | desktop | ✅ pass |
| 10 | substitutes: exact match returns data | mobile | ✅ pass |
| 11 | facilities: list loads 200 | desktop | ✅ pass |
| 12 | facilities: list loads 200 | mobile | ✅ pass |
| 13 | facilities: detail loads 200 | desktop | ✅ pass |
| 14 | facilities: detail loads 200 | mobile | ✅ pass |
| 15 | api: facilities no private columns | desktop | ✅ pass |
| 16 | api: recipes no private columns | desktop | ✅ pass |
| 17 | api: substitutes returns data | desktop | ✅ pass |
| 18 | api: error format no SQL no stack trace | desktop | ✅ pass |
| 19 | search: redirect to facilities | desktop | ✅ pass |
| 20–24 | api tests (mobile) | mobile | ⊘ skip (desktop-only) |

---

## 3. 운영 QA: HTTP 상태 (curl)

| 경로 | HTTP | 비고 |
|------|------|------|
| `/` | 200 | 홈 |
| `/recipes` | 200 | 레시피 목록 |
| `/recipes/6942782` | 200 | 레시피 상세 |
| `/ingredients` | 200 | 식재료 목록 |
| `/ingredients/1133588` | 200 | 식재료 상세 |
| `/facilities` | 200 | 시설 목록 |
| `/facilities/3450000-106-2006-00035` | 200 | 시설 상세 |
| `/substitutes?ingredient=가시오갈피` | 200 + exact match | 대체 식재료 |
| `/search?q=고등어` | 307 → `/facilities` → 200 | 검색 리다이렉트 |
| `/b/1` | 200 | 레거시 경로 호환 |
| `/products` | 200 | 레거시 경로 호환 |
| `/api/recipes` | 200 | |
| `/api/ingredients` | 200 | |
| `/api/facilities` | 200 | |
| `/api/substitutes?ingredient=가시오갈피` | 200 | |
| `/api/search/facilities?q=고등어` | 200 | |

---

## 4. 보안 체크 (운영환경)

| 항목 | 결과 |
|------|------|
| 비공개 컬럼 노출 (road_addr, coord_x, coord_y, suspension_count) | ✅ 미노출 |
| 서비스롤 키·SQL·stack trace 에러 노출 | ✅ 없음 |
| 에러 응답 형식 | ✅ `FG_*` code + traceId |
| XSS 입력 처리 | ✅ 크래시 없음 (Playwright 검증) |
| Supabase ref 격리 | ✅ `glczrbadvfgmblmkpgfj` (신규 격리 프로젝트) |

---

## 5. 반응형 검증

| 항목 | 결과 |
|------|------|
| 1440×1000 가로 넘침 | ✅ 없음 (Playwright noOverflow 검증) |
| 390×844 가로 넘침 | ✅ 없음 |
| 콘솔 에러 (favicon 제외) | ✅ 0건 |
| viewport meta 태그 | ✅ 존재 |

---

## 6. 기존 서비스 무변경 확인

| 항목 | 결과 |
|------|------|
| `foodground.vercel.app` HTTP 상태 | ✅ 200 (정상 운영 중) |
| 기존 `wavenvibe/foodground` 저장소 변경 | ✅ 변경 없음 (읽기 전용) |
| 기존 Supabase 변경 | ✅ 변경 없음 (읽기 전용) |

---

## 7. 빌드·정적 검증 (운영 브랜치)

| 항목 | 결과 |
|------|------|
| `eslint` | ✅ 0 errors, 5 warnings (기존) |
| `tsc --noEmit` | ✅ exit 0 |
| `next build` | ✅ Compiled successfully |

---

## 8. 환경변수 확인

| 키 | 환경 | 결과 |
|----|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | production · preview · development | ✅ 설정됨 (ref: glczrbadvfgmblmkpgfj) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production · preview · development | ✅ 설정됨 |
| service-role 키 | — | ✅ 미설정 (런타임 미노출 확인) |

---

## 9. 추가 비용

| 항목 | 결과 |
|------|------|
| Vercel 유료 플랜 전환 | ✅ 없음 (Hobby 플랜 내 배포) |
| 추가 SaaS·유료 서비스 도입 | ✅ 없음 |

---

## 10. 스크린샷 증빙

저장 경로: `docs/qa/evidence/vs6-production/`

| 파일 | 설명 |
|------|------|
| `home-desktop.png` | 홈 1440×1000 |
| `home-mobile.png` | 홈 390×844 |
| `recipes-list-desktop.png` | 레시피 목록 데스크톱 |
| `recipes-list-mobile.png` | 레시피 목록 모바일 |
| `recipes-detail-desktop.png` | 레시피 상세 데스크톱 |
| `recipes-detail-mobile.png` | 레시피 상세 모바일 |
| `ingredients-list-desktop.png` | 식재료 목록 데스크톱 |
| `ingredients-list-mobile.png` | 식재료 목록 모바일 |
| `substitutes-desktop.png` | 대체 식재료 데스크톱 |
| `substitutes-mobile.png` | 대체 식재료 모바일 |
| `facilities-list-desktop.png` | 시설 목록 데스크톱 |
| `facilities-list-mobile.png` | 시설 목록 모바일 |
| `facilities-detail-desktop.png` | 시설 상세 데스크톱 |
| `facilities-detail-mobile.png` | 시설 상세 모바일 |

---

## 11. 상태 판정

| 항목 | 상태 |
|------|------|
| Git PR merge (`codex/g1-baseline` → `main`) | ✅ 완료 (PR #1, SHA: 68963ef) |
| 신규 Supabase 연결 (glczrbadvfgmblmkpgfj) | ✅ 완료 |
| Vercel 운영 배포 | ✅ 완료 (READY) |
| 기술 스모크 QA | ✅ 완료 (19/19 pass) |
| 사용자 UAT | ⏸ 미승인 |
| G6-GATE 최종 인수 | ⏸ 미완료 |
| **종합 판정** | **기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요** |

사용자가 현재 화면·서비스 완성도에 부적합 의견을 제시함. G6-GATE 최종 인수 완료로 표시하지 않음.
새 기능 및 디자인 개선은 후속 CHG-G6 변경작업으로 분리한다.
