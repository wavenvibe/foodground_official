# CHG-G6-001 UI-GATE-2 상세디자인 작업지시서 v0.1

## 1. 현재 기준선

- 현재 운영배포본은 MVP 기술 기준선이며 사용자 최종 인수본이 아니다.
- 사용자는 CHG-G6-001 UI-GATE-1에서 회색 Canvas·Slate·Point Green과 작업 중심 5단계 흐름을 승인했다.
- 현재 대체 식재료 목록형 비교 UI는 유지 기준선이다.
- 이번 작업은 **디자인만** 수행하며 Next.js 앱 구현을 시작하지 않는다.

## 2. 작업 위치

`foodground_official` 저장소 루트

Claude Code를 위 폴더에서 실행하고 MoAI 프로젝트 규칙을 로드한다.

## 3. 먼저 읽을 자료

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.moai/project/current-slice.md`
4. `docs/design/chg-g6-001-ui-gate-2/claude-design-instructions.md`
5. `docs/design/chg-g6-001-ui-gate-2/screen-matrix.md`
6. `docs/design/chg-g6-001-ui-gate-2/component-state-contract.md`
7. `docs/design/chg-g6-001-ui-gate-2/index.html`

## 4. 산출물

- SCR-001·010·011·020·021·030·040·041·050 상세시안
- 각 화면 1440×1000, 390×844
- ST-01~08, FB-01 상태 연결표
- 공통 컴포넌트 명세와 MVP 대비 변경표
- 사용자 결정이 필요한 항목 목록

## 5. 절대 금지

- `app/`, `components/`, `lib/` 등 실제 Next.js 앱 코드 변경
- Supabase 스키마·데이터·키·migration 변경
- Vercel 설정·배포·환경변수 변경
- commit·push·PR
- 제품·연결제품·검증 이메일·제품/공정 HACCP 적합의 가짜 결과
- 회원·저장·알림·공개 TIPS 성과 화면 추가
- 기존 `wavenvibe/foodground`, `foodground.vercel.app`, 기존 Supabase 변경

## 6. 완료 조건과 중단점

9개 화면의 데스크톱·모바일 시안, 상태·컴포넌트 계약, 브라우저 오류·가로 넘침 검증을 완료한다. 결과를 보고한 뒤 **UI-GATE-2 사용자 승인 전 반드시 중단**한다. 본판 코딩은 별도 승인과 구현 작업지시서가 나온 뒤 시작한다.
