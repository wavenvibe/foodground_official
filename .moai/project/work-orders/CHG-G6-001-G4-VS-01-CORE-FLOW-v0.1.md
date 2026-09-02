# CHG-G6-001 G4 본판 핵심흐름 구현 작업지시서 v0.1

## 1. 목표

UI-GATE-2 승인 시안을 기존 Next.js 앱과 실제 공개 Supabase 데이터에 적용해 다음 흐름을 끊김 없이 구현한다.

`레시피 → 식재료 → 대체 식재료 → 제조시설 후보 → 문의 준비`

정적 시안을 복사하는 작업이 아니라 현재 앱의 데이터 접근계층·API·라우트를 재사용해 실제 동작하는 본판으로 만든다.

## 2. 권위 문서

1. `.moai/project/approvals/CHG-G6-001-UI-GATE-2-APPROVAL.md`
2. `docs/design/chg-g6-001-ui-gate-2/index.html`
3. `docs/design/chg-g6-001-ui-gate-2/screen-matrix.md`
4. `docs/design/chg-g6-001-ui-gate-2/component-state-contract.md`
5. `docs/design/chg-g6-001-ui-gate-2/state-board.html`
6. `.moai/design/chg-g4-002/` G3-07 데이터·API·보안 설계 9종
7. 현재 앱 코드와 실제 public Supabase 계약

충돌 시 사용자 승인 기록과 더 보수적인 데이터·보안 경계를 우선한다.

## 3. 구현 화면과 경로

| 화면 | 실제 경로 | 필수 연결 |
|---|---|---|
| 홈 | `/` | 5단계 흐름과 레시피·식재료 시작점 |
| 레시피 목록 | `/recipes` | 검색·분류·정렬·페이지 → 상세 |
| 레시피 상세 | `/recipes/[id]` | 구성 식재료 → 식재료 상세 |
| 식재료 목록 | `/ingredients` | 표준식품 연결·영양·연결 레시피 → 상세 |
| 식재료 상세 | `/ingredients/[id]` | 영양·연결 레시피 → 대체 식재료 검색 |
| 대체 식재료 | `/substitutes` | 기존 목록형 비교 유지 → 후보로 시설 찾기 |
| 제조시설 후보 | `/facilities` | 선택 맥락·필터·확인 근거 → 상세 |
| 제조시설 상세 | `/facilities/[id]` | 공개정보·확인/미확인 조건 → 문의 준비 |
| 문의 준비 | `/inquiry` | 레시피·식재료·대체후보·시설 맥락 → 문안 복사·전화·홈페이지 |

기존 `/search`, `/b/[id]` 등의 호환경로는 삭제하지 말고 현재 승인 경로로 안전하게 연결한다.

## 4. 필수 구현 계약

### 공통 UI

- Header에는 레시피·식재료·대체 식재료·제조시설 4개 메뉴만 노출한다.
- 데스크톱 1440×1000 최대폭 1180px, 모바일 390×844 좌우 16px·1열·주요 버튼 전체폭을 적용한다.
- 토큰은 Canvas `#F1F1EE`, Slate `#31394D`, Point Green `#03C75A`, Surface `#FFFFFF`, Ink `#20242C`, Rule `#D7DBE1`을 사용한다.
- loading·empty·error·unavailable·not-found·partial-match·unmatched·context-lost·copied 상태를 공통계약대로 구현한다.

### 실제 데이터와 연결 흐름

- 목록·상세·검색·정렬·페이지네이션은 기존 public Supabase와 서버 데이터 접근계층을 사용한다.
- fixture는 Supabase가 없는 로컬 개발에서만 허용하며 production에서는 성공 데이터로 대체하지 않는다.
- 레시피 상세의 식재료에서 실제 `ingredient_id`가 있는 항목만 식재료 상세로 연결한다. 없는 키는 가짜 링크를 만들지 않고 미연결 상태를 표시한다.
- 식재료 상세에서 실제 표준식품 연결이 있는 경우만 대체 식재료 분석으로 연결한다.
- 대체 후보 선택, 제조시설 필터, 시설 상세, 문의 준비의 맥락은 URL query 또는 명시적 직렬화 객체로 보존한다. 새 영구저장 기능은 만들지 않는다.
- 제조시설 후보 근거는 실제 확인된 지역·업종·시설 HACCP 보유 등만 표시하고, 제품·공정 적합 여부는 “문의로 확인할 조건”으로 분리한다.
- 문의 준비는 자동발송 없이 문안 복사, 공개 전화·홈페이지 연결만 제공한다. 이메일을 생성하거나 추정하지 않는다.

### 대체 식재료 회귀 금지

- 현재 사용자가 승인한 목록형 UI를 유지한다.
- `score_final DESC`, 후보별 6개 유사도, `available_sim_count`, 100g 영양 비교, exact·substring·fuzzy·synonym·unmatched 배지, 출처·한계고지를 유지한다.
- unmatched에서는 유사도와 후보를 표시하지 않는다.

## 5. 명시적 제외

- 제품 검색·연결제품 표시
- 제품·공정 HACCP 적합 판정
- 없는 시설 이메일·자동메일
- Auth·저장·알림·프로젝트·공동구매 게시판
- 사용자용 TIPS 성과·시험성적·증빙 화면
- 신규 유료 API·SaaS·패키지 교체

## 6. 구현 순서

1. 현재 라우트·데이터계약·환경변수·기존 테스트를 읽기 전용 감사한다.
2. 승인 토큰과 공통 Header·Footer·ContextCard·SearchFilterBar·StatePanel을 구현한다.
3. 홈 → 레시피 목록·상세 → 식재료 목록·상세를 실제 데이터로 연결한다.
4. 기존 대체 식재료 UI를 유지하면서 앞뒤 맥락 연결을 추가한다.
5. 제조시설 후보·상세 → 문의 준비 흐름을 구현한다.
6. 호환경로와 모든 상태를 보완한다.
7. 정적검증과 실제 브라우저 QA를 수행하고 증빙을 남긴다.

## 7. 완료 기준

- `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과
- 기존 E2E 회귀 통과 및 CHG-G6 핵심흐름 Playwright 신규 작성·통과
- 1440×1000·390×844에서 핵심 9개 경로 HTTP 정상, 가로 넘침 0, 콘솔·페이지 오류 0
- 실제 데이터로 레시피 → 식재료 → 대체 식재료 → 제조시설 → 문의 준비 연결 검증
- 시설 비공개 컬럼, service-role 키, SQL·스택 트레이스 미노출
- `docs/qa/chg-g6-001-g4-vs-01.md`에 변경파일·실데이터 예시·테스트·제한사항 기록

## 8. 이번 작업 금지

- 신규·기존 Supabase 스키마·데이터·키·migration 원격 변경
- Vercel 배포·환경변수 변경
- commit·push·PR·merge
- 기존 원본 데이터·레거시 저장소 변경
- `.claude/settings.local.json`, 비공식 훅, 전역 Claude 설정 변경
- 승인 설계 문서의 의미 변경 또는 범위 확대

원격 승인이나 실제 데이터 부재 없이는 해결할 수 없는 항목만 차단사항으로 남기고, 그 외 로컬 구현·테스트는 중간 질문 없이 끝까지 수행한다.
