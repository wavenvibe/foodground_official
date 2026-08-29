# CHG-G6-001 UI-GATE-2 상세시안 패키지

## 검토 방법

`index.html`을 브라우저로 열면 9개 화면을 상단·하단 화면 인덱스로 이동해 확인할 수 있다. URL의 `screen` 값으로 화면을 직접 지정할 수도 있다.

상태·배지 시안을 확인하려면 `state-board.html`을 별도 탭으로 열면 된다. ST-01~08, FB-01, 5종 MatchTypeBadge가 데스크톱·모바일 반응형으로 표시된다.

- `home`: 홈
- `recipes`: 레시피 목록
- `recipe-detail`: 레시피 상세
- `ingredients`: 식재료 목록
- `ingredient-detail`: 식재료 상세/허브
- `substitutes`: 대체 식재료 비교
- `facilities`: 제조시설 후보
- `facility-detail`: 시설 상세
- `inquiry`: 문의 준비

## 패키지 구성

| 파일 | 용도 |
|---|---|
| `index.html` | 핵심 9개 화면 단일 진입점 |
| `state-board.html` | 상태·배지 부록 보드 (ST-01~08, FB-01, 5종 MatchTypeBadge) |
| `styles.css` | 승인 토큰·반응형·컴포넌트 표현 |
| `prototype.js` | 9개 화면 시안과 화면 전환 |
| `screen-matrix.md` | 화면 목적·핵심정보·다음 행동·상태계약 |
| `component-state-contract.md` | 공통 컴포넌트·문구·반응형 계약 |
| `claude-design-instructions.md` | Claude Design·Claude Code 설계 지시 |
| `qa-ui-gate-2.mjs` | 18개 뷰포트·화면 브라우저 검사 |
| `qa-state-board.mjs` | 상태·배지 부록의 데스크톱·모바일 브라우저 검사 |
| `qa-result.md` | 브라우저 QA 결과 |

## 현재 판정

- UI-GATE-1: 사용자 방향 승인 완료
- UI-GATE-2: 상세시안 + 상태·배지 보드 브라우저 QA 완료·사용자 검토 대기
- 본판 Next.js 구현: 미착수
- 운영 MVP·Supabase·Vercel·Git: 변경 없음
