# Current work

- Gate: G4 구현 완료 / G6-GATE 인수 보류
- Work unit: VS-6 QA·배포·인계 — 기술 배포 완료
- Work order: `.moai/project/work-orders/CHG-G4-002-G4-IMPLEMENTATION-v0.1.md`
- Status: **기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요**
- Active change baseline: `CHG-G4-002`

## G3-07 승인 완료

G3-07 상세설계가 사용자 승인 완료됨.
승인 기록: `.moai/project/approvals/G3-07-APPROVAL.md`
설계 산출물 9종은 승인 이력으로 보존 (수정 금지).

## VS 진행 현황

- VS-1 (읽기 전용 감사): ✅ 완료
- VS-2 (로컬 migration·적재 준비): ✅ 완료
- VS-3 (공개탐색 로컬 구현·검증): ✅ 완료
- VS-4 (대체 식재료): ✅ 완료 2026-08-28
- VS-5 (시설 상세·ContactButton): ✅ 완료 2026-08-28
- VS-6 (QA·배포·인계): ✅ 기술 배포 완료 2026-08-28

## 승인점 상태

- 승인점 A (Supabase 원격 로그인·migration): ✅ 완료 2026-08-26
- 승인점 B (staging 데이터 적재): ✅ 완료 2026-08-27
- 승인점 C (RLS·공개 읽기 검증): ✅ 완료 2026-08-28
- VS-6 로컬 QA (통합 E2E, 성능, 보안 체크): ✅ 완료 2026-08-28
- Git PR merge (codex/g1-baseline → main): ✅ 완료 2026-08-28 (PR #1, SHA: 68963ef)
- Vercel 운영 배포 (foodground-official.vercel.app): ✅ 완료 2026-08-28 (배포 ID: dpl_5G666iP5aBn53B46cUJemn6r1B2a)
- 운영 스모크 QA (Playwright 19/19): ✅ 완료 2026-08-29

## 상태 판정

| 항목 | 상태 |
|------|------|
| 기술 배포 | ✅ 완료 |
| 사용자 UAT | ⏸ 미승인 |
| G6-GATE 최종 인수 | ⏸ 미완료 |
| 종합 | **기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요** |

사용자가 현재 화면·서비스 완성도에 부적합 의견 제시함.
G6-GATE 최종 인수 완료로 표시하지 않음.
새 기능 및 디자인 개선은 후속 CHG-G6 변경작업으로 분리한다.

## 다음 단계

후속 CHG-G6 변경작업에서 다룰 항목:
- 사용자가 지적한 화면·서비스 품질 개선
- 필요시 디자인 개선·기능 추가

## 금지 사항

기존 foodground·Vercel·Supabase 쓰기 금지.
Vercel 재배포·환경변수 변경·main 직접 수정 금지 (사용자 명시적 요청 시에만 실행).
기존 `CHG-G4-002-SUBSTITUTE-INTEGRATION-v0.3.md`는 현재 권위 문서가 아님.
