# Claude Design·Claude Code용 UI-GATE-2 작업지시

## 목적

CHG-G6-001 본판의 상세 디자인을 확정한다. 기존 배포본은 MVP 기술 기준선으로만 사용하고, 승인된 시안의 정보구조와 사용자 흐름을 실제 개발 가능한 컴포넌트·상태·반응형 설계로 완성한다.

## 권위 자료

1. `docs/design/chg-g6-001-ui-gate-2/index.html`
2. `docs/design/chg-g6-001-ui-gate-2/styles.css`
3. `docs/design/chg-g6-001-ui-gate-2/screen-matrix.md`
4. `docs/design/chg-g6-001-ui-gate-2/component-state-contract.md`
5. `02_문서/03_설계/DOC-10_화면_UIUX설계서_v0.2.docx`

## 수행할 일

- SCR-001·010·011·020·021·030·040·041·050의 1440×1000·390×844 상세시안을 작성한다.
- 공통 Header, ContextCard, SearchFilterBar, StatePanel, SubstituteCandidate, FacilityReason, ContactPanel을 재사용 가능한 단위로 정의한다.
- ST-01~08과 FB-01을 화면별로 연결한다.
- SCR-030은 현재 대체 식재료 목록형 UI의 정보밀도·점수 정렬·6개 유사도·100g 영양 비교를 유지한다.
- 레시피→식재료→대체 식재료→시설 후보→문의에서 선택 맥락이 유지되는 표현을 사용한다.
- 시안별 데스크톱·모바일 캡처와 변경목록을 남긴다.

## 금지

- 이번 단계에서 Next.js 앱 코드, Supabase, Vercel, 환경변수, migration을 변경하지 않는다.
- commit·push·PR을 만들지 않는다.
- 제품·연결제품·검증 이메일·제품/공정 HACCP 적합을 가짜 데이터로 만들지 않는다.
- 회원·저장·알림·공개 TIPS 성과 화면을 추가하지 않는다.
- 새 UI 라이브러리·유료 서비스를 추가하지 않는다.

## 완료보고

1. 9개 화면 × 2개 뷰포트 산출물
2. 공통 컴포넌트·상태 연결표
3. 기존 MVP 대비 변경사항
4. 구현 전 사용자 결정사항
5. 앱·DB·배포·Git 변경 없음 확인

보고 후 멈추고 UI-GATE-2 사용자 승인을 기다린다. 승인 전 본판 코딩을 시작하지 않는다.
