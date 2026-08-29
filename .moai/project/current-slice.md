# Current work

- Gate: CHG-G6-001 본판 재설계 / G4 수직 구현
- Work unit: G4-VS-01 레시피→식재료→대체 식재료→제조시설→문의 핵심흐름
- Work order: `.moai/project/work-orders/CHG-G6-001-G4-VS-01-CORE-FLOW-v0.1.md`
- Status: **UI-GATE-2 사용자 승인 완료 / G4-VS-01 로컬 구현·독립 QA 완료 / 사용자 화면검토 대기**
- Active change baseline: `CHG-G6-001·ADM-08 v0.6`

## 사용자 승인 기준

- 회색 Canvas `#F1F1EE`, Slate `#31394D`, Point Green `#03C75A`
- 레시피 → 식재료 → 대체 식재료 → 제조시설 후보 → 문의 준비의 한 흐름
- 현재 대체 식재료 목록형 비교 UI 유지
- 제품 검색·연결제품·검증 이메일·제품/공정 HACCP 적합은 감사와 별도 승인 전 미노출

## 현재 산출물

- `02_문서/03_설계/DOC-10_화면_UIUX설계서_v0.2.docx`
- `docs/design/chg-g6-001-ui-gate-2/` 상세시안 소스·화면/상태/컴포넌트 계약
- 9개 화면 × 1440×1000·390×844 검토 이미지

## 게이트 판정

| 항목 | 상태 |
|---|---|
| MVP 기술 배포 | 완료·기준선 보존 |
| MVP 사용자 UAT | 미승인 |
| UI-GATE-1 방향 승인 | 완료 2026-08-29 |
| UI-GATE-2 상세시안 작성·브라우저 QA | 완료 |
| UI-GATE-2 상세시안 승인 | 완료 2026-08-29 |
| 본판 Next.js 구현 | G4-VS-01 로컬 구현 완료 |
| 핵심흐름 QA | lint·typecheck·build PASS, G4 E2E 18 passed·18 조건분기 skipped, VS-6 회귀 57 passed·21 skipped |
| 원격 반영 | 미수행 — Supabase·Vercel·commit·push 변경 없음 |

## 다음 단계

G4-VS-01 로컬 구현 결과를 사용자 화면검토 대상으로 고정한다. 다음 수직 슬라이스는 사용자 검토 결과와 별도 작업지시를 확정한 뒤 착수하며, 원격 반영은 별도 승인 전 수행하지 않는다.

## 금지 사항

- 신규·기존 Supabase 원격 변경과 데이터 적재
- Vercel 재배포·환경변수 변경
- commit·push·PR
- 기존 `wavenvibe/foodground`, `foodground.vercel.app`, 기존 Supabase 쓰기
- 가짜 제품·연결제품·이메일·제품/공정 HACCP 결과와 사용자용 TIPS 화면
