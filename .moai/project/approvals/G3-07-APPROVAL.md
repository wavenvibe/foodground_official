# G3-07 사용자 승인 기록

- Gate: G3-07
- Change ID: CHG-G4-002
- Approval status: APPROVED
- Approved by: 사용자 (wavenvibe)
- Approval date: 2026-08-26

## 승인 범위

- 설계 산출물 9종 (`.moai/design/chg-g4-002/01~09`)
- `validate-g3-07.mjs --mode=final` PASS (9 files) 확인 후 승인
- 신규 Supabase 프로젝트 `glczrbadvfgmblmkpgfj` (Mumbai, ap-south-1) 사용 승인

## 주요 승인 내용

| 항목 | 승인 내용 |
|---|---|
| 아키텍처 | Next.js 16 App Router + Supabase anon/service-role 분리 |
| 데이터 | 기존 `final_output/analysis_outputs/` 사전계산 결과 신규 Supabase 이관 |
| 매칭 표시 | 5가지 매칭방법 배지 + 면책고지 의무화 |
| 문의 방식 | ContactButton(문의문안 복사) 기본; email 컬럼 없음 확인 |
| /label-guide | 사용자 승인 자료 제공 시에만 활성화 |
| 구현 순서 | VS-1 → VS-2 → VS-3 → VS-4 → VS-5 → VS-6 |

## 승인 이력 보존 대상

아래 파일은 승인 당시 이력으로 보존하며 수정하지 않는다.

- `.moai/design/chg-g4-002/01-scope-and-source-audit.md`
- `.moai/design/chg-g4-002/02-user-flow-and-screen-states.md`
- `.moai/design/chg-g4-002/03-data-contract-and-lineage.md`
- `.moai/design/chg-g4-002/04-supabase-schema-migration-rls.md`
- `.moai/design/chg-g4-002/05-nextjs-component-api-design.md`
- `.moai/design/chg-g4-002/06-qa-acceptance-trace.md`
- `.moai/design/chg-g4-002/07-risks-decisions-open-items.md`
- `.moai/design/chg-g4-002/08-implementation-slices.md`
- `.moai/design/chg-g4-002/09-review-request.md`
- `05-checks/validate-g3-07.mjs`
