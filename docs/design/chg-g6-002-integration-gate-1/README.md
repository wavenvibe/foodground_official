# CHG-G6-002 INTEGRATION-GATE-1 통합 설계 시안

- 상태: INTEGRATION-GATE-1 사용자 승인 / DATA-GATE 진행 / 구현 미승인
- 변경 유형: 기존 Foodground 기능·TIPS 공동제조 자산 복원 및 통합
- 운영 MVP·Supabase·Vercel·Git main: 변경 없음
- 주의: 프로토타입의 업체명·점수·품목은 UI 구조 설명을 위한 예시이며 실제 매칭 결과가 아니다.

## 달라진 핵심

1. 상단 메뉴만 오가는 구조가 아니라, `제품화 작업보드`가 선택 맥락과 다음 행동을 보존한다.
2. 기존 Foodground의 `제품 검색 → 제조업체 → 생산품목·HACCP 인증`을 공개탐색 축으로 복원한다.
3. 레시피·식재료·대체 식재료 선택은 `제품·공정 요구조건`으로 변환하여 제조시설 후보 조건으로 사용한다.
4. `시설 HACCP 보유`, `인증 상세`, `CCP 공정`, `선택 제품·공정 적합`을 서로 다른 근거로 표시한다.
5. 문의는 매칭을 대체하지 않고, 후보·생산품목·인증·공정 근거를 확인한 후의 마지막 행동으로만 제공한다.

## 검토 화면

- `index.html?screen=workspace`: 통합 제품화 작업보드
- `index.html?screen=product`: 기존 제품·제조업체 연결 탐색
- `index.html?screen=substitutes`: 승인된 대체 식재료 목록·6개 유사도·영양 비교 유지
- `index.html?screen=brief`: 레시피·대체안을 제품·공정 요구조건으로 확정
- `index.html?screen=matching`: HACCP·CCP·품목 근거를 보여주는 제조시설 후보
- `index.html?screen=facility`: 업체·생산품목·HACCP 인증·공정 근거 통합 상세

## 승인 전 금지

- Next.js 앱 구현
- Supabase schema·data·RLS 변경
- Git commit·push·PR·merge
- Vercel Preview·Production 배포
- 과거 F1 0.9853을 현재 런타임 성능으로 표시

## 자동 검증

- 6개 화면 × 1440×1000·390×844 = 12개 화면 PASS
- 가로 넘침 0건
- 콘솔·페이지 오류 0건
- 결과: `screenshots/` 및 `qa-wireframe.mjs`
