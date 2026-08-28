# CHG-G4-002 대체 식재료·공동제조 웹 이식 지시서 v0.2

## 1. 현재 단계와 목표

- 현재 단계는 `G3 CHG-G4-002 상세설계`다.
- 이번 Claude Code 실행은 설계만 수행한다.
- 기존 Python/Streamlit 분석도구를 운영서비스로 연결하지 않고, 승인된 사전산출 결과를 신규 Supabase와 Next.js에 이식하는 구조를 설계한다.
- 사용자는 공개 데이터를 탐색하고, 대체 식재료 후보와 근거를 확인한 뒤 공동제조 시설 검색과 업체 메일초안으로 이동할 수 있어야 한다.
- `.moai/design/chg-g4-002/09-review-request.md`의 사용자 승인 전에는 애플리케이션 코드, SQL migration, 데이터 적재, 원격 Supabase, Vercel을 변경하지 않는다.

## 2. 문서 우선순위

충돌 시 다음 순서를 적용한다.

1. 사용자가 확정한 20,000,000원 최종 기능범위
2. `../00_프로젝트관리/CHG-G4-002_기존대체식재료매칭_웹이식_및_2천만원범위재편_v0.1.md`
3. `.moai/project/product.md`
4. 본 지시서
5. `ADM-08 v0.4`, `DOC-07 v0.6`, `DOC-08 v0.4`, `DOC-09 v0.3`, `DOC-12 v0.3`의 CHG-G4-002 현재범위 행
6. 기존 기획·계약·설계문서와 기존 코드

다음 문서는 이전 40,000,000원 범위가 남아 있으므로 현재 구현범위를 결정하는 자료로 사용하지 않는다.

- 구축기획 v0.8, 개발계획 v0.6, 마스터실행계획 v0.6의 기존 기능·금액 부분
- G2-01 P0 사용자흐름 v0.4
- DOC-01 v0.2, DOC-02 v0.4, DOC-03 v0.2, DOC-05 v0.2, DOC-06 v0.2
- DOC-10 v0.1, DOC-11 v0.1, TEC-03 v0.2, TEC-04 v0.1의 Auth·프로젝트·OCR·LLM·게시판·비밀문의·제품 전건이관 설계
- 이전 `G3-DESIGN.md`와 `START_HERE_G3_DESIGN.md`

## 3. 확정 구현범위

1. 레시피·식재료·제조시설 공개 검색, 필터, 목록, 상세, 출처와 기준일
2. 기존 사전산출 데이터 기반 대체 식재료 검색과 후보 순위
3. 후보별 6개 유사도 지표, 영양 비교, 데이터버전, 정확·부분일치 근거와 품질한계
4. 지역·업종·HACCP·영업상태·제품유형 등 보유 데이터 범위의 공동제조 조건매칭
5. 시설 후보 순위, 일치·미충족 근거, 시설 상세 연결
6. 대체 후보에서 공동제조 검색조건 전달
7. 시설 연락처가 있을 때 브라우저 `mailto:` 초안, 없을 때 내용복사
8. loading, empty, error, unavailable, not-found, malformed-input, no-candidate, partial-match 상태
9. 390px·1440px 반응형, 접근성, 비밀검사, QA, 배포·롤백·인계
10. 발주자가 승인된 최신 자료를 제공한 경우에만 정적 식품표기 법령 검색·FAQ·출처·기준일·면책

제품 검색은 기존 화면의 호환 여부만 조사한다. 제품 신고자료 1,047,894건 신규 이관과 이를 전제로 하는 신규 검색구축은 현재 인수대상이 아니다.

## 4. 후속 범위

다음 기능은 화면, API, 테이블, RLS, migration, 테스트 픽스처를 새로 만들지 않는다.

- 회원가입·로그인, 관심저장, 제품화 프로젝트, 후보 저장
- 이미지 OCR, 공개 업로드, Python 재분석, Streamlit iframe
- RAG·LLM 답변, 자동 식품표기 오류판정, 법적 적합성 판정
- 공동구매 게시판, 참여·신고, 업체별 비밀문의와 처리상태
- 제품 신고자료 1,047,894건 신규 전건 이관
- 계약·결제·정산·실시간 채팅·푸시·서버 자동메일
- 모델 재학습, 과거 TIPS 점수의 웹 재달성·보장·외부 공인 재시험

## 5. 기존 문서의 알려진 충돌

Claude는 다음 항목을 구현 근거로 사용하지 않고 설계 위험목록에 기록한다.

- DOC-07 `FG-FUN-001`: 관심목록·프로젝트 메뉴 문구
- DOC-07 `FG-FUN-006`: 제품 1,047,894건 전건 이관을 전제로 한 제품검색
- DOC-07 `FG-DAT-009`: 전체 제품 적재를 포함하는 데이터 범위
- DOC-07·08 `FG-FUN-032`: 프로젝트 존재를 전제로 한 공동제조 조건입력 문구
- DOC-07 `FG-FUN-059`: 회원을 전제로 한 `mailto:` 문구
- DOC-09 `WBS-08-03`: 보류된 OCR 작업을 선행조건으로 둔 정적 법령안내
- DOC-09 `WBS-09-04`: 보류된 비밀문의 작업을 선행조건으로 둔 메일초안
- DOC-12: 프로젝트 화면을 현재 웹 품질 측정대상으로 남긴 문구
- DOC-04 v0.4의 숨은 과거 금액·공수 셀은 변경이력으로만 보고 현재 금액 계산에 사용하지 않는다.

현재 설계에서는 공동제조 입력을 공개 독립 흐름으로 정의하고, `mailto:`도 로그인이나 비밀문의 저장 없이 동작하게 한다. 정적 법령안내는 OCR과 독립적으로 활성화할 수 있어야 한다.

## 6. 읽기 순서

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.moai/project/product.md`
4. `.moai/project/architecture.md`
5. `.moai/project/quality-gates.md`
6. `.moai/project/current-slice.md`
7. 본 지시서
8. CHG-G4-002 변경기록
9. ADM-08 v0.4, DOC-07 v0.6, DOC-08 v0.4, DOC-09 v0.3, DOC-12 v0.3의 `.inspect.ndjson`
10. `docs/design/g3-03-option2/`
11. 실제 Next.js 코드와 로컬 Next.js 16 문서

기존 분석 폴더는 읽기 전용으로 감사한다.

`C:\Users\rlove\OneDrive\바탕 화면\업무\웨이브앤바이브\1. 연도별프로젝트_2026\2603 빅데이터 분석 활용 지원사업 (고도화)\최종결과물_260818\final_output`

기준선은 레시피 69,406건, 관계 553,763건, 표준식품 686건, 사전산출 식품쌍 234,955건, 고유 입력명 매칭 12,582/23,806(52.85%)다. 숫자가 다르면 추정하지 말고 차이를 기록한다.

## 7. G3 설계 산출물

다음을 `.moai/design/chg-g4-002/`에 작성한다.

1. `01-scope-and-source-audit.md`
2. `02-user-flow-and-screen-states.md`
3. `03-data-contract-and-lineage.md`
4. `04-supabase-schema-migration-rls.md`
5. `05-nextjs-component-api-design.md`
6. `06-qa-acceptance-trace.md`
7. `07-risks-decisions-open-items.md`
8. `08-implementation-slices.md`
9. `09-review-request.md`

`08-implementation-slices.md`는 다음 순서를 기본으로 한다.

- VS-1: 소스·코드·데이터 감사, fixture와 계약 확정, 원격 변경 없음
- VS-2: 신규 Supabase staging/publish migration·RLS·rollback
- VS-3: 공개 레시피·식재료·제조시설 탐색
- VS-4: `/substitutes` 검색·후보·지표·근거
- VS-5: 공동제조 매칭·시설상세·`mailto:` 연결
- VS-6: 조건부 법령안내, 공통상태, 통합 QA·배포·인계

설계 결과에는 각 VS의 요구사항 ID, 화면, API, 테이블·뷰, 오류상태, 테스트, 증빙과 원격변경 승인점을 포함한다.

## 8. 승인과 구현

1. 설계 산출물 9종을 작성한 뒤 `09-review-request.md`에서 멈춘다.
2. 사용자 승인 전 `/moai:run`, 앱 코드 수정, migration 실행, 데이터 적재, 배포, commit, push를 하지 않는다.
3. 승인 후 `.moai/project/current-slice.md`에 구현할 VS 하나만 지정한다.
4. `/foodground:chg-g4-002-run`으로 해당 VS 하나만 구현한다.
5. UI·데이터·상태·시험·추적증빙을 함께 완료하고 다음 VS로 자동 이동하지 않는다.
6. 원격 migration·적재·배포·commit·push는 각각 사용자 명시 승인 전 실행하지 않는다.

## 9. 완료 표현

- `구현`: 코드가 존재하고 lint·build/type 검증을 통과했다.
- `연결`: 승인된 신규 Supabase와 실제 데이터계약으로 응답한다.
- `검증`: 390px·1440px, loading·empty·error·unavailable·not-found, 핵심 회귀와 비밀검사 증빙이 있다.
- `완료`: 구현·연결·검증과 요구사항 추적이 모두 충족됐다.

빈 결과를 연결 성공으로 간주하지 않는다. 과거 TIPS 수치를 신규 웹의 현재 성능으로 표시하지 않는다.
