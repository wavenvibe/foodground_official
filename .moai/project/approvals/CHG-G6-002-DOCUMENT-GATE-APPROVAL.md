# CHG-G6-002 DOCUMENT-GATE 승인 기록

- 승인 상태: APPROVED
- 승인 메시지: `DOCUMENT-GATE 승인. Claude Code 본판 구현 준비를 진행해줘.`
- 승인 주체: 사용자
- 변경 ID: CHG-G6-002
- 다음 작업: G4 VS-A 자산·매핑 로컬 구현

## 승인 기준선

1. `docs/design/chg-g6-002-integration-gate-1/` 통합 설계
2. 루트 `00_프로젝트관리/푸드그라운드_CHG-G6-002_DATA-GATE_판정_v0.1.md`
3. 루트 `02_문서/00_최신리비전_CHG-G6-002/` 문서 20종
4. 루트 문서등록대장의 CHG-G6-002 리비전

## 승인된 방향

- 기존 Foodground의 업체별 생산제품·HACCP·CCP·행정정보 복원
- 레시피 또는 기존 제품에서 제조업체 검증까지 이어지는 제품화 흐름
- 승인된 대체 식재료 목록·6개 유사도·영양 비교 UI 유지
- 직접연결·복수·미연결을 구분하고 가짜 연결 금지
- 공동제조 P0는 품목·필수 CCP·지역·인증의 설명 가능한 규칙근거 사용
- 과거 F1은 타깃 프로필·검증셋·재현시험 전 런타임 정확도로 사용 금지

## 이번 승인으로 허용되는 작업

- `foodground_official` 내부의 VS-A 로컬 코드·fixture·mapping·migration 초안 작성
- 원본 SQLite와 F1 자료의 읽기 전용 감사
- dry-run·정적검증·단위시험
- QA 증빙 작성

## 별도 승인 전 금지

- 신규 Supabase 원격 DDL·RLS·migration 적용·데이터 적재
- Vercel Preview·Production 배포와 환경변수 변경
- commit·push·PR·merge
- 기존 `wavenvibe/foodground`, `foodground.vercel.app`, 기존 Supabase 변경
- 복수·미연결 업체의 임의 귀속
- 1,047,894건 원본 데이터의 저장소 커밋
