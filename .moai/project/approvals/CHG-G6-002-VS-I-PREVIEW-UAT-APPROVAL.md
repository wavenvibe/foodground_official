# CHG-G6-002 VS-I Preview UAT 승인 기록

- 변경 ID: `CHG-G6-002`
- 수직 슬라이스: `G4 VS-I 공식 Supabase 런타임 연결`
- 승인 대상: stacked PR #3의 Vercel Preview
- 승인일: 2026-08-31
- 승인자: 발주자(사용자대표)
- 승인 근거: 대화에서 사용자가 `UAT 승인`을 명시

## 승인 범위

다음 Preview UAT 18건을 승인한다.

- 홈·레시피·식재료·대체 식재료 회귀
- 제품 목록·필터·상세와 제품 API
- 제조시설 목록·상세의 생산제품·HACCP 공개 근거
- 제조요건 입력과 `과자` 공동제조 후보·CCP/HACCP 근거
- 1440×1000·390×844 반응형, 가로 넘침 0, 콘솔·페이지 오류 0
- stacked Preview 격리, `main`·Production 불변

상세 시험 ID와 자동증빙은 루트 프로젝트의 `DOC-13_시험계획_QA_UAT목록_v0.4.xlsx` 내 `VS-I_Preview_UAT` 시트 UAT-055~072를 기준으로 한다.

## 승인에서 제외되는 사항

이번 승인은 VS-I Preview UAT 18건에 한정한다. 다음 사항은 자동으로 승인되거나 실행되지 않는다.

- DOC-13의 기존 사용자 QA 54건 전체 완료
- G5 출시후보 통합 QA 완료
- PR #3 또는 선행 stacked PR의 merge
- 원격 `main` 변경
- Vercel Production 배포·별칭 변경
- G6-GATE 최종 인수·완료보고·운영인계
- Supabase 추가 migration·적재·publish

## 판정

`VS_I_PREVIEW_UAT_APPROVED / G5_RELEASE_CANDIDATE_PENDING`

다음 단계는 stacked PR 계보를 포함한 G5 출시후보 감사를 읽기 전용·로컬 검증으로 수행하는 것이다. merge·`main`·Production 변경은 별도 명시적 승인 전 금지한다.
