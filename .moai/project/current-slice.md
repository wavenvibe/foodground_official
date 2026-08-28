# Current work

- Gate: G4 구현
- Work unit: VS-6 QA·배포·인계 준비
- Work order: `.moai/project/work-orders/CHG-G4-002-G4-IMPLEMENTATION-v0.1.md`
- Status: VS-4·VS-5 완료 / 승인점 C 완료 / commit·push·Vercel 배포 사용자 승인 대기
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
- VS-6 (QA·배포·인계): 🟡 로컬 QA 완료 / commit·push·Vercel 사용자 승인 대기

## 승인점 상태

- 승인점 A (Supabase 원격 로그인·migration): ✅ 완료 2026-08-26
- 승인점 B (staging 데이터 적재): ✅ 완료 2026-08-27
- 승인점 C (RLS·공개 읽기 검증): ✅ 완료 2026-08-28
- VS-6 로컬 QA (통합 E2E, 성능, 보안 체크): ✅ 완료 2026-08-28
- Vercel, commit·push: ⏸ 미승인

## 금지 사항

G3 설계 재검토, VS-1~VS-3 재실행, 앱 코드 수정, 데이터 적재를 하지 않는다.
commit·push·Vercel 배포는 사용자 명시적 요청 시에만 실행한다.
기존 `CHG-G4-002-SUBSTITUTE-INTEGRATION-v0.3.md`는 현재 권위 문서가 아님.
