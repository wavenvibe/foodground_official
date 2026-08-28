# CHG-G4-002 상세설계 작업지시서 v0.3

## 1. 작업 목적

- 현재 게이트는 `G3-07 Claude Code·MoAI 상세설계`다.
- 이번 실행은 설계 산출물 9종 작성과 사용자 승인요청까지만 수행한다.
- 기존 대체 식재료 분석결과를 새로 개발한 알고리즘으로 표현하지 않고, 승인된 사전산출 결과를 Supabase와 Next.js에 안전하게 이식하는 구조를 설계한다.
- 사용자 승인 전 애플리케이션 코드, SQL migration, 데이터 적재, 원격 Supabase, Vercel, commit, push를 변경하지 않는다.

## 2. 권위자료 우선순위

충돌 시 다음 순서를 적용한다.

1. 사용자가 확정한 총 20,000,000원 최종 기능범위
2. `../00_프로젝트관리/CHG-G4-002_기존대체식재료매칭_웹이식_및_2천만원범위재편_v0.1.md`
3. `../02_문서/02_착수요구/DOC-07_요구사항정의서_v0.7.xlsx.inspect.ndjson`
4. `../02_문서/02_착수요구/DOC-08_기능RFP_요구사항추적표_v0.5.xlsx.inspect.ndjson`
5. `../02_문서/02_착수요구/DOC-09_WBS_진척관리표_v0.4.xlsx.inspect.ndjson`
6. `../02_문서/01_발주계약/DOC-04_견적서_산출내역서_v0.5.xlsx.inspect.ndjson`
7. `../02_문서/04_개발관리/ADM-08_변경요청서_변경합의서_v0.5.xlsx.inspect.ndjson`
8. `.moai/project/product.md`, `.moai/project/architecture.md`, `.moai/project/quality-gates.md`
9. 본 지시서
10. 외부 전달 검토본 DOC-01 v0.3·DOC-02 v0.5·DOC-03 v0.3·DOC-05 v0.3·DOC-06 v0.3
11. 기존 DOC-10·DOC-11·TEC-03·TEC-04, 프로토타입 코드와 과거 기획문서

하위 우선순위 자료에서 이전 40,000,000원 범위가 발견되면 구현 근거로 사용하지 말고 충돌목록에 기록한다.

## 3. 필수 읽기 순서

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.moai/project/product.md`
4. `.moai/project/architecture.md`
5. `.moai/project/quality-gates.md`
6. `.moai/project/current-slice.md`
7. 본 지시서
8. 위 권위자료 2~7의 최신 파일
9. `docs/design/g3-03-option2/`
10. 실제 Next.js 코드와 `node_modules/next/dist/docs/`의 관련 Next.js 16 문서
11. 읽기 전용 기존 분석 폴더

기존 분석 폴더:

`C:\Users\rlove\OneDrive\바탕 화면\업무\웨이브앤바이브\1. 연도별프로젝트_2026\2603 빅데이터 분석 활용 지원사업 (고도화)\최종결과물_260818\final_output`

## 4. 확정 현재범위

1. 레시피 70,165건·식재료 18,933건·제조시설 94,723건의 공개 탐색과 상세
2. 승인된 사전산출 데이터 기반 대체 식재료 검색·후보순위
3. 후보별 6개 유사도 지표·영양 비교·데이터버전·매칭근거·품질한계
4. 보유 필드 범위의 공동제조 조건매칭·순위·일치·미충족 근거·시설 상세 연결
5. 대체 후보에서 공동제조 검색조건으로 이동하는 연결
6. 시설 연락처가 있을 때 브라우저 `mailto:` 초안, 없을 때 내용복사
7. 승인된 기준일자 자료가 제공된 경우에만 정적 식품표기 법령 검색·FAQ·출처·면책
8. loading·empty·error·unavailable·not-found·malformed-input·no-candidate·partial-match 상태
9. 390px·1440px 반응형, 접근성, 비밀검사, QA, 배포·롤백·인계

대체 식재료 기준선은 69,406 레시피, 553,763 관계, 686 표준식품, 234,955 사전산출 식품쌍이다. 고유 입력명 매칭은 12,582/23,806(52.85%)이며 정확일치와 부분문자열 일치의 계보를 구분한다. 차이가 발견되면 숫자를 맞추지 말고 원인과 영향으로 기록한다.

## 5. 설계하지 않는 후속범위

- Auth·관심저장·제품화 프로젝트·후보저장
- OCR·이미지 업로드·Python 재분석·Streamlit 운영연결
- RAG·LLM·자동 식품표기 판정
- 공동구매 게시판·참여·신고·비밀문의·처리상태
- 제품 신고자료 1,047,894건 신규 전건 이관
- 계약·결제·정산·실시간 채팅·푸시·서버 자동메일
- 모델 재학습·과거 TIPS 수치의 웹 재달성·보장·공인 재시험

후속범위용 화면, API, 테이블, RLS, migration, 테스트 fixture를 만들지 않는다.

## 6. 작업 절차

1. `git status --short`, `git diff --stat`, 실제 라우트·컴포넌트·API·Supabase 파일을 읽고 기존 미커밋 작업을 보존한다.
2. 기존 분석 폴더를 파일목록·크기·해시·스키마·건수·키·중복·결측·의존성 범위에서 읽기 전용 감사한다.
3. 최신 inspect 자료에서 승인 56건·조건부 4건을 자동 추출하고 설계·시험 추적 기준으로 사용한다.
4. `.moai/design/chg-g4-002/`의 9개 템플릿을 조사결과로 완성한다.
5. 확인하지 못한 사실은 추정하지 않고 `UNKNOWN`과 미결정사항으로 기록한다.
6. `node 05-checks/validate-g3-07.mjs --mode=final`을 통과한다.
7. `09-review-request.md`에 승인사항을 정리한 뒤 멈춘다.

## 7. 산출물 9종

1. `01-scope-and-source-audit.md`
2. `02-user-flow-and-screen-states.md`
3. `03-data-contract-and-lineage.md`
4. `04-supabase-schema-migration-rls.md`
5. `05-nextjs-component-api-design.md`
6. `06-qa-acceptance-trace.md`
7. `07-risks-decisions-open-items.md`
8. `08-implementation-slices.md`
9. `09-review-request.md`

각 파일은 `Status: REVIEW READY`로 바꾸고 조사근거·파일경로·요구사항 ID·결정·대안·미결정사항을 포함해야 한다.

## 8. 구현 슬라이스 기본순서

- VS-1: 소스·코드·데이터 감사, fixture와 데이터계약 확정, 원격변경 없음
- VS-2: 신규 Supabase staging/publish migration·공개권한·rollback
- VS-3: 공개 레시피·식재료·제조시설 탐색
- VS-4: `/substitutes` 검색·후보·6개 지표·영양·근거
- VS-5: 공동제조 매칭·시설상세·`mailto:` 연결
- VS-6: 조건부 법령안내·공통상태·통합 QA·배포·인계

각 VS에 요구사항 ID, 화면·라우트, API, 테이블·뷰, 오류상태, 테스트, 증빙, 선행조건과 사용자 승인점을 적는다.

## 9. 금지동작과 중단조건

- 앱·테스트·설정·SQL migration 파일 수정
- 원격 Supabase 조회를 넘어선 쓰기·적재·DDL·정책변경
- 원본 Git·Vercel·Supabase 변경
- Vercel 배포, commit, push, PR, tag
- 비밀값·개인정보·내부 TIPS 증빙을 문서나 프롬프트에 복사
- 템플릿의 미확인 내용을 사실처럼 채우기

최신 자료 접근이 불가능하거나 현재범위와 충돌하는 중대 의사결정이 있으면 설계를 강행하지 말고 `07`과 `09`에 기록하여 사용자 판단을 요청한다.

## 10. 완료 판정

G3-07은 다음을 모두 충족할 때만 사용자 승인 대기 상태가 된다.

- 산출물 9종 존재와 final validator 통과
- 앱 코드·SQL·데이터·원격환경·배포·git 이력 변경 0건
- 승인 56건·조건부 4건 추적
- 기존 자산·현재 신규개발·후속범위 분리
- 09 문서에 권고안·대안·미결정사항·승인체크가 존재

사용자 승인 전에는 G3-07 또는 G3-GATE를 완료로 표시하지 않는다.
