# VS-6 릴리스 준비 상태

Date: 2026-08-29 (운영배포 완료 반영)
Branch: main (merge SHA: 68963ef82798aa3219ddf8e2344f0a4eab73c63f)
Status: **기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요**

운영 URL: https://foodground-official.vercel.app
배포 ID: dpl_5G666iP5aBn53B46cUJemn6r1B2a

---

## 품질 게이트 결과

| Gate | Command | Result |
|------|---------|--------|
| Lint | `npm run lint` | ✅ 0 errors |
| TypeScript | `npx tsc --noEmit` | ✅ exit 0 |
| Build | `npm run build` | ✅ Compiled successfully |
| VS-4 E2E | `npx playwright test e2e/vs4-live.spec.ts` | ✅ 32 passed, 2 skipped |
| VS-5 E2E | `npx playwright test e2e/vs5-live.spec.ts` | ✅ 37 passed, 7 skipped |
| VS-6 E2E | `npx playwright test e2e/vs6-integration.spec.ts` | ✅ 57 passed, 21 skipped |
| git diff --check | `git diff --check` | ✅ 0 actual errors (LF경고만) |

---

## 승인된 구현 범위

| 기능 | 구현 상태 |
|------|----------|
| 공개 탐색: /facilities, /facilities/[id] | ✅ 완료 |
| 공개 탐색: /recipes, /recipes/[id] | ✅ 완료 |
| 공개 탐색: /ingredients, /ingredients/[id] | ✅ 완료 |
| 대체 식재료: /substitutes | ✅ 완료 |
| FG-FUN-034: 필터 조건 근거 패널 | ✅ 완료 |
| ContactButton (문의문안 복사 + tel/homepage 연결) | ✅ 완료 |
| 반응형 (1440px, 390px) | ✅ 검증 완료 |
| 오류·빈 결과·not-found 상태 | ✅ 구현·검증 완료 |
| 보안: 비공개 컬럼 차단, 입력 검증 | ✅ 완료 |
| Supabase RLS: anon 읽기 전용 | ✅ 승인점 C 완료 (2026-08-28) |

---

## 운영배포 완료 항목 (2026-08-28)

| 항목 | 결과 |
|------|------|
| PR #1 merge (codex/g1-baseline → main) | ✅ 완료 (SHA: 68963ef) |
| Vercel 프로젝트 생성 (foodground-official) | ✅ 완료 |
| 환경변수 설정 (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) | ✅ 완료 |
| 운영 배포 (main, READY) | ✅ 완료 |
| 운영 스모크 QA (Playwright 19/19 pass) | ✅ 완료 |
| 기존 foodground.vercel.app 무변경 | ✅ 확인 |

## 운영 QA 결과 추가

| Gate | Command | Result |
|------|---------|--------|
| 운영 E2E (Playwright) | `BASE_URL=https://foodground-official.vercel.app npx playwright test e2e/vs6-production.spec.ts` | ✅ 19 passed, 5 skipped |
| 운영 HTTP 상태 | curl 16개 경로 | ✅ 모두 200/307 정상 |
| 운영 보안 체크 | API 비공개 컬럼·SQL 미노출 | ✅ |

---

## 미승인 항목 (현재 범위 제외)

- Auth, 로그인, 저장 기능
- Product filing 마이그레이션 (1,047,894건)
- OCR, RAG/LLM, 그룹구매, 실시간 알림
- label-guide (승인 소스 미제공)

---

## 알려진 열린 이슈

| 이슈 | 분류 | 처리 |
|------|------|------|
| npm audit 8 취약점 (7 high, 1 low) | ws: 런타임 번들 포함이나 클라이언트 용도로 직접 공격 경로 없음; next/postcss/sharp: --force 필요 보류 | 다음 릴리스 시 `npm audit fix` (ws 등) 권장, next 강제 업그레이드는 별도 검토 |
| LF→CRLF git 경고 18개 | Windows 환경 line ending | `.gitattributes` 추가로 해소 가능 (선택) |
