# CHG-G4-002 대체 식재료 추천 웹 이식 설계·구현 지시서

## 1. 목표

기존 Python/Streamlit 분석도구를 서비스로 직접 연결하지 않고, 승인된 사전산출 데이터만 신규 Supabase와 Next.js에 안전하게 이식한다. 사용자는 대체 식재료 후보와 근거를 확인하고 공동제조 시설 탐색·업체 메일문의까지 이어갈 수 있어야 한다.

이번 첫 실행은 설계 전용이다. 사용자가 설계를 승인하기 전에는 애플리케이션 코드, SQL migration, 데이터 적재, 원격 Supabase, Vercel을 변경하지 않는다.

## 2. 권위자료 읽기 순서

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.moai/project/product.md`
4. `.moai/project/architecture.md`
5. `.moai/project/quality-gates.md`
6. `.moai/project/current-slice.md`
7. 본 지시서
8. `../00_프로젝트관리/CHG-G4-002_기존대체식재료매칭_웹이식_및_2천만원범위재편_v0.1.md`
9. `../02_문서/04_개발관리/ADM-08_변경요청서_변경합의서_v0.4.xlsx.inspect.ndjson`
10. `../02_문서/01_발주계약/DOC-04_견적서_산출내역서_v0.4.xlsx.inspect.ndjson`
11. `../02_문서/02_착수요구/DOC-07_요구사항정의서_v0.6.xlsx.inspect.ndjson`
12. `../02_문서/02_착수요구/DOC-08_기능RFP_요구사항추적표_v0.4.xlsx.inspect.ndjson`
13. `../02_문서/02_착수요구/DOC-09_WBS_진척관리표_v0.3.xlsx.inspect.ndjson`
14. `../02_문서/03_설계/DOC-12_TIPS지표_기능_증빙연결표_v0.3.xlsx.inspect.ndjson`
15. `docs/design/g3-03-option2/`

## 3. 읽기 전용 외부 입력

기존 분석 폴더:

`C:\Users\rlove\OneDrive\바탕 화면\업무\웨이브앤바이브\1. 연도별프로젝트_2026\2603 빅데이터 분석 활용 지원사업 (고도화)\최종결과물_260818\final_output`

허용: 파일목록, 코드, 스키마, 수량, 표본, 해시, 의존성 읽기.

금지: 원본 파일 수정, 분석 재실행으로 산출물 덮어쓰기, 서버로 직접 노출, 공개 업로드 연결, 자격증명 복사.

확인 기준선은 레시피 69,406건, 관계 553,763건, 표준식품 686건, 사전산출 식품쌍 234,955건이다. 고유 입력명 매칭은 12,582/23,806, 52.85%이며 부분문자열 매칭이 있다. 숫자가 다르면 추정하지 말고 차이를 위험으로 기록한다.

## 4. 현재 범위

- 공개 레시피·식재료·제조시설 탐색
- `/substitutes` 기준 식재료 검색, 후보순위, 6개 지표, 영양차이, 매칭근거, 데이터버전, 한계
- 공동제조 조건·필터·순위·근거·시설상세
- 대체 후보에서 제조시설 검색으로 조건 전달
- 시설 상세에서 `mailto:` 초안과 내용복사
- 승인 법령자료가 있을 때만 정적 `/label-guide` 검색·FAQ
- loading, empty, error, unavailable, malformed input, no candidate, partial match 상태
- 390px·1440px 반응형, 접근성, 비밀검사, QA, 배포·롤백·인계 설계

## 5. 후속 범위

OCR, RAG/LLM, Auth·저장·프로젝트, 공동구매 게시판, 비밀문의, 제품 1,047,894건 신규 이관, 결제·계약·정산·채팅·푸시, 과거 TIPS 점수 재달성은 설계·코드·migration에 포함하지 않는다.

## 6. 1단계 — MoAI 설계

1. `git status --short`, `git diff --stat`으로 기존 미커밋 파일을 보존한다.
2. 로컬 Next.js 문서와 실제 저장소 구조를 확인한다.
3. 기존 분석 산출물의 파일·스키마·키·중복·결측·해시·이용권한 위험을 감사한다.
4. 다음을 `.moai/design/chg-g4-002/`에 작성한다.
   - `01-scope-and-source-audit.md`
   - `02-user-flow-and-screen-states.md`
   - `03-data-contract-and-lineage.md`
   - `04-supabase-schema-migration-rls.md`
   - `05-nextjs-component-api-design.md`
   - `06-qa-acceptance-trace.md`
   - `07-risks-decisions-open-items.md`
   - `08-implementation-slices.md`
   - `09-review-request.md`
5. `08-implementation-slices.md`는 최소한 다음 순서를 사용한다.
   - VS-1: 소스감사·fixture·데이터계약, 원격 변경 없음
   - VS-2: 신규 Supabase staging/publish migration·RLS·rollback
   - VS-3: `/substitutes` 검색·후보·근거 세로단위
   - VS-4: 공동제조 매칭·시설상세 연결
   - VS-5: mailto·법령안내 조건부·상태 UI
   - VS-6: 통합 QA·배포·인계
6. 설계 리뷰 요청 후 멈춘다. `/moai:run`, app 코드, migration 실행, data load, deploy, commit, push를 하지 않는다.

## 7. 2단계 — 승인 후 구현

사용자가 `09-review-request.md`를 승인하고 `.moai/project/current-slice.md`가 해당 VS로 변경된 뒤에만 한 VS씩 `/moai:run`한다. 각 VS는 UI·데이터·상태·시험·추적증빙을 함께 완료한다.

원격 migration·적재·배포·commit·push는 각각 사용자 명시 승인 전 실행하지 않는다. 구현 완료 표현은 lint, build/type, 테스트, 390px/1440px 브라우저, 오류·빈결과, 비밀검사, 요구사항 추적이 모두 남은 경우에만 사용한다.

## 8. 표현 금지

- AI 추천, 원가절감, 재료비 절감 보장
- 관능·효능·가격 동등성
- 식품표기 적합·부적합 자동판정
- 과거 TIPS 점수가 신규 웹에서 재달성됐다는 표현
- 단순 iframe·Streamlit 연결을 완성된 웹 이식으로 간주
