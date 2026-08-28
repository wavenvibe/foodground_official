# G3 상세설계 착수 지시서

## 1. 목적

Claude Code와 MoAI ADK가 푸드그라운드의 UI/UX와 기술구조를 독립적으로
검토하고, 구현 전에 사용자가 승인할 수 있는 G3 상세설계 산출물을 만든다.

이번 작업은 설계 전용이다. 애플리케이션 코드, SQL migration, Supabase,
Vercel, 외부 API 설정을 변경하지 않는다.

## 2. 역할 경계

- Codex가 작성한 사업범위, 요구사항, 데이터 집계, 사용자 선택 디자인 방향은 입력조건이다.
- Claude Code + MoAI가 화면구조, 사용자흐름, 컴포넌트, 반응형 상태, DB/API/RLS, 오류계약, migration·백업·롤백 구조를 상세설계한다.
- Codex가 작성한 DOC-10·DOC-11·TEC-03·TEC-04와 VS-1A 코드는 참고 초안이다. 그대로 채택하지 말고 요구사항과 실제 저장소를 기준으로 검증한다.
- 사용자가 G3 산출물을 승인하기 전에는 G4 구현을 시작하지 않는다.

## 3. 반드시 지켜야 할 고정조건

1. 쓰기 가능한 저장소는 `wavenvibe/foodground_official`뿐이다.
2. `wavenvibe/foodground`, `foodground.vercel.app`, 기존 유료 Supabase는 읽기 전용 TIPS 재현 기준선이다.
3. 데이터베이스는 별도 신규 Supabase 프로젝트만 사용한다.
4. 추가 유료 API·SaaS·인프라 비용은 사용자 승인 없이 도입하지 않는다.
5. 런타임 기준은 레시피 70,165건, 식재료 18,933건, 제조시설 94,723건, 합계 183,821건이다.
6. 제품 신고자료 1,047,894건은 전체 원문 복제가 아니라 실제 검색에 필요한 경량 구조와 용량 검증방안을 설계한다.
7. 과거 TIPS 104,000건 및 성능점수는 과거 로컬 시험성과다. 웹에서 동일 점수 재달성·보장·공인재시험은 현재 목표가 아니다.
8. 사용자에게 TIPS 메뉴, 성과점수, 증빙관리 화면을 제공하지 않는다.
9. OCR·표기점검은 사전점검이며 법적 적합성 확정판정으로 표현하지 않는다.
10. 계약·결제·정산·실시간 채팅·실시간 푸시는 현재 범위가 아니다.
11. 공동구매 모집 게시판, 비공개 업체문의, 메일초안은 현재 범위다.
12. 기존 미커밋 VS-1A 코드는 동결된 Codex 프로토타입이다. 삭제·수정·채택은 설계안 승인 이후 별도 결정한다.

## 4. 사용자 승인 디자인 방향

- 정보구조: A안의 작업 중심 B2B 구조
- 분위기: 차분하고 포멀한 회색 배경
- 포인트: 녹색을 행동, 선택, 진행, 중요 값에 제한적으로 사용
- 참고: `docs/design/g3-03-option2/`
- 금지: 과도한 그라데이션, 큰 홍보문구, AI 서비스처럼 보이는 장식, 녹색 전면 배경, 사용자용 TIPS 성과화면

세부 색상, 글꼴, 간격, 카드·표·필터 구조, 모바일 내비게이션은 Claude가
접근성과 구현비용을 검토해 제안한다.

## 5. 읽기 순서

### 5.1 저장소 내부 필수자료

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.moai/project/product.md`
4. `.moai/project/architecture.md`
5. `.moai/project/quality-gates.md`
6. 본 문서 `.moai/project/work-orders/G3-DESIGN.md`
7. `.moai/project/brand/brand-voice.md`
8. `.moai/project/brand/target-audience.md`
9. `.moai/project/brand/visual-identity.md`
10. `docs/design/g3-03-option2/`

### 5.2 상위 프로젝트의 권위자료

저장소 루트에서 `..`는 웨이브앤바이브 프로젝트 폴더다.

1. `../01_기획/푸드그라운드_TIPS연계_웹사이트_구축기획_v0.8.md`
2. `../01_기획/푸드그라운드_개발문서_산출물정의_및_FE_BE개발계획_v0.6.md`
3. `../00_프로젝트관리/푸드그라운드_G2-01_P0사용자흐름_및_개발경계_v0.4.md`
4. `../00_프로젝트관리/CHG-G4-001_TIPS성능지표_웹재달성_범위분리_v0.1.md`
5. `../02_문서/02_착수요구/DOC-07_요구사항정의서_v0.5.xlsx.inspect.ndjson`
6. `../02_문서/02_착수요구/DOC-08_기능RFP_요구사항추적표_v0.3.xlsx.inspect.ndjson`
7. `../02_문서/02_착수요구/DOC-09_WBS_진척관리표_v0.2.xlsx.inspect.ndjson`
8. `../02_문서/03_설계/DOC-12_TIPS지표_기능_증빙연결표_v0.2.xlsx.inspect.ndjson`

### 5.3 참고초안 — 권위자료 아님

- `../02_문서/03_설계/DOC-10_화면_UIUX설계서_v0.1.docx`
- `../02_문서/03_설계/DOC-11_시스템_DB_API_보안설계서_v0.1.docx`
- `../02_문서/03_설계/TEC-03_Supabase_RLS_권한표_v0.2.xlsx`
- `../02_문서/03_설계/TEC-04_API_데이터계약서_v0.1.xlsx`
- `docs/architecture/g3-05/IMPLEMENTATION_CONTRACT.md`
- 현재 Git working tree의 미커밋 VS-1A 코드

DOCX·XLSX를 직접 읽기 어렵다면 참고초안은 생략해도 된다. 권위자료의
Markdown·NDJSON과 실제 코드 구조를 우선한다.

## 6. 수행절차

### 6.1 사전감사

- `git status --short`와 `git diff --stat`으로 기존 미커밋 변경을 확인한다.
- 현재 Next.js 구조, 기존 공개검색 화면, Supabase 연결방식을 읽기 전용으로 분석한다.
- 기존 구현을 정답으로 전제하지 않고 요구사항과 충돌·누락을 정리한다.

### 6.2 서비스·UX 설계

- FLOW-P0-01~09를 사용자 관점의 메뉴와 작업흐름으로 재구성한다.
- 데스크톱 1440px·모바일 390px 기준 IA, 화면목록, 핵심흐름, 내비게이션을 설계한다.
- loading, empty, error, permission denied, external service unavailable, success, refreshing, insufficient evidence 상태를 정의한다.
- 검색·프로젝트·대체레시피·제조시설후보·OCR/표기점검·공동구매·비공개문의의 연결관계를 명확히 한다.
- 화면에 TIPS 과제명·성과점수·증빙을 노출하지 않는다.

### 6.3 UI 시스템 설계

- 브랜드 입력자료와 사용자 승인 방향을 기반으로 색상, 타이포그래피, 간격, 그리드, 아이콘, 표·카드·필터·폼·상태패널을 제안한다.
- 기존 G3 시안과 다른 결론도 허용하되 변경근거를 기록한다.
- 접근성, 키보드 조작, 명도대비, 모바일 필터 사용성을 검토한다.
- 필요하면 정적 HTML/CSS 프로토타입을 `docs/design/claude-g3/`에 만들 수 있으나 `app/`, `components/`, `lib/`은 수정하지 않는다.

### 6.4 기술설계

- Next.js App Router의 Server/Client Component 경계를 제안한다.
- Supabase 스키마, 공개필드, RLS 역할, Storage, API, 오류, 페이지네이션, 감사로그를 설계한다.
- migration, 데이터 적재, 중복·결측 검역, 백업, 복구, 롤백 순서를 설계한다.
- OCR·규칙검증·법령근거·LLM 설명을 분리하고 외부 서비스 실패 시 직접입력·규칙검증 대체경로를 설계한다.
- 과거 TIPS 점수와 웹 런타임 측정을 분리한다. G5에서는 웹 품질을 측정하되 과거 점수 재달성을 합격조건으로 만들지 않는다.

### 6.5 검토와 승인요청

- 요구사항 충족표, 미결정사항, 비용·일정 위험, Codex 초안 대비 채택·수정·폐기 목록을 작성한다.
- 설계 산출물만 제시하고 사용자에게 G3 승인 여부를 요청한 뒤 멈춘다.
- `/moai:run`, 코드 구현, remote migration, data load, deploy, commit, push를 실행하지 않는다.

## 7. 필수 산출물

다음 파일을 `.moai/design/foodground-g3/`에 작성한다.

1. `01-design-brief.md` — 목표, 사용자, 범위, 고정조건
2. `02-ia-user-flows.md` — IA, 메뉴, FLOW-P0-01~09 사용자흐름
3. `03-screen-state-matrix.md` — 화면목록, 권한, 반응형, 상태
4. `04-design-system.md` — 토큰과 컴포넌트 계약
5. `05-technical-architecture.md` — FE/BE, Supabase, API, RLS, 외부서비스
6. `06-data-migration-recovery.md` — 데이터, migration, 백업, 롤백
7. `07-requirement-trace.md` — 요구사항·화면·API·DB·시험 연결
8. `08-decisions-risks.md` — 채택·수정·폐기, 미결정, 위험
9. `09-g3-review-request.md` — 사용자 검토용 요약과 승인항목

선택적으로 정적 프로토타입을 `docs/design/claude-g3/`에 작성한다.

## 8. G3 완료조건

- 필수 산출물 9종이 존재한다.
- FLOW-P0-01~09와 DOC-07 요구사항이 추적된다.
- 데스크톱·모바일, 권한, 오류·빈 결과·외부서비스 장애 상태가 포함된다.
- Supabase·RLS·데이터 migration·백업·롤백 설계가 포함된다.
- TIPS 과거성과와 웹 측정·후속 재달성 범위가 분리된다.
- 기존 VS-1A 초안의 채택·수정·폐기 판단이 기록된다.
- 애플리케이션·원격환경 변경이 0건이다.
- 사용자가 설계를 검토하고 승인하기 전에는 상태를 완료로 바꾸지 않는다.
