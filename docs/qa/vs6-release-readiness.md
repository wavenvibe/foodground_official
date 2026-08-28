# VS-6 릴리스 준비 상태

Date: 2026-08-28
Branch: codex/g1-baseline
Status: commit·push·Vercel 배포 사용자 승인 대기

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

## 배포 전 필수 확인 (사용자 실행)

1. `git add` → `git commit` → `git push origin codex/g1-baseline`
2. Vercel 프로젝트 연결 확인: 신 저장소(`wavenvibe/foodground_official`) 연결 여부
3. Vercel 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 여부
4. 배포 후 프리뷰 URL에서 smoke test: `/`, `/facilities`, `/substitutes?ingredient=가시오갈피`
5. Supabase RLS: 배포 후 익명 접근 동작 재확인

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
