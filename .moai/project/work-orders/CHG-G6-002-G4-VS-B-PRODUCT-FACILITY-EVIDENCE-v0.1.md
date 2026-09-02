# CHG-G6-002 G4 VS-B 제품·업체·HACCP 공개조회 수직슬라이스 v0.1

## 1. 목표

기존 Foodground에서 실제로 제공하던 `제품 → 제조시설 → 생산제품·HACCP·CCP·안전정보` 연결을 `foodground_official` 본판에 로컬 수직슬라이스로 복원한다.

이번 완료조건은 메뉴나 HTTP 200이 아니라, 실제 원본 SQLite를 읽기 전용으로 조회해 제품과 시설이 `facility_mgt_no`로 양방향 연결되고 시설 상세에서 근거가 구분되어 보이는 것이다.

## 2. 권위 기준

1. `.moai/project/approvals/CHG-G6-002-DOCUMENT-GATE-APPROVAL.md`
2. `.moai/project/work-orders/CHG-G6-002-G4-VS-A-ASSET-MAPPING-v0.1.md`
3. `docs/qa/chg-g6-002-vs-a-asset-mapping.md`
4. `docs/design/chg-g6-002-integration-gate-1/`
5. migration 0028~0033의 Codex 교정 후 실제 원본 컬럼 계약
6. `D:/0. 업무/foodground/data/foodground.db` — SQLite `mode=ro` 전용

## 3. 구현 범위

### 3.1 로컬 데이터 접근 계층

- 새 서버 전용 모듈에서 `FOODGROUND_SOURCE_DB` 환경변수로 SQLite 경로를 받는다.
- 연결은 반드시 `file:...?mode=ro`, `PRAGMA query_only=ON`을 적용한다.
- 앱 코드·설정·로그에 개인 절대경로를 하드코딩하지 않는다.
- 환경변수가 없거나 원본을 열 수 없으면 가짜 데이터 대신 `FG_DATA_UNAVAILABLE`을 반환한다.
- SQL 파라미터 바인딩, 검색어 길이 제한, 안정정렬·서버 페이지네이션을 적용한다.

### 3.2 제품 공개조회

- `/products`: 제품명·품목(category)·제조사 검색, 품목 필터, 페이지네이션
- `/products/[reportNo]`: 신고번호, 제품명, 품목, 제조사, 원재료 원문, 유통기한, 신고일, 연결 시설
- `/api/products`, `/api/products/[reportNo]`
- 제품 시설키가 있는 815,989행만 시설을 확정 연결하고, 231,905행은 `연결 확인 필요`로 표시한다.
- 제품 목록과 상세에서 연결된 경우 `/facilities/[mgt_no]`로 이동한다.

### 3.3 시설 근거 상세

- 기존 `/facilities/[id]` 기본정보·연락 기능을 보존한다.
- 실제 `production_log` 최신 생산제품과 총 건수, 전체보기 링크를 표시한다.
- 실제 `haccp_cert` 인증번호·인증일·CCP 목록을 표시하고 `raw_payload`, `biz_addr`는 노출하지 않는다.
- 실제 `sales_suspension` 중 시설키 직접연결 행만 안전정보로 표시한다. 시설키 없는 252행을 문자열 유사만으로 귀속하지 않는다.
- 시설 `is_haccp`, HACCP 인증 상세, CCP, 선택 제품·공정 적합은 서로 다른 의미로 표시한다.
- 제품·공정 적합을 확정하거나 과거 F1을 런타임 성능으로 표시하지 않는다.

### 3.4 API

- `/api/facilities/[id]/products`
- `/api/facilities/[id]/haccp`
- `/api/facilities/[id]/safety`
- 오류는 기존 `FG_*` 형식과 안전한 trace ID를 사용한다.
- 원본 SQL·경로·내부 예외·키를 응답에 노출하지 않는다.

### 3.5 내비게이션·흐름

- Header의 승인 범위 메뉴에 `제품`(`/products`)을 복원한다.
- 제품 목록 → 제품 상세 → 시설 상세 → 생산제품/HACCP/CCP/안전정보가 화면상 이어져야 한다.
- 레시피·식재료·대체 식재료 기존 기능과 승인된 목록형 대체 UI는 변경하지 않는다.
- 문의는 시설 근거 확인 뒤 보조행동으로 유지한다.

## 4. 필수 상태

- loading, empty, error, unavailable, not-found, facility-unlinked
- HACCP 없음, CCP 없음, 안전정보 없음
- 긴 제품명·원재료·CCP 문자열과 390px 가로 넘침 방어

## 5. 테스트·검증

1. Python VS-A validator 재실행
2. lint, `tsc --noEmit`, build
3. 새 API 단위/통합 테스트
4. Playwright 1440×1000·390×844
5. 실제 원본 케이스:
   - 시설 연결 제품
   - 시설 미연결 제품
   - 생산제품이 있는 시설
   - HACCP·CCP가 있는 시설
   - 직접연결 안전정보가 있는 시설
6. 확인기준:
   - 제품↔시설 양방향 이동
   - 공개 필드 allowlist
   - `raw_payload`, `biz_addr`, `maker_addr` 미노출
   - 콘솔·페이지 오류 0, 가로 넘침 0
   - 기존 VS-4·VS-5·VS-6 및 CHG-G6-001 핵심흐름 회귀 없음

QA 증빙은 `docs/qa/chg-g6-002-vs-b-product-facility-evidence.md`에 기록한다.

## 6. 완료 후 상태

- 완료 시 VS-B PASS와 변경파일·실데이터 검증·회귀결과를 보고한다.
- 다음 VS-C는 제품화 브리프와 제조요건 계약이다.
- 원격 Supabase migration·적재는 별도 승인점 전까지 대기한다.

## 7. 금지

- 신규·기존 Supabase 원격 변경 또는 적재
- Vercel Preview·Production·환경변수 변경
- commit·push·PR·merge·브랜치 변경
- 원본 SQLite·F1 자료 변경·복사
- 원본 대용량 자료·개인경로·비밀정보 커밋 후보화
- 가짜 제품·업체·HACCP·CCP·안전정보 생성
- 공동제조 추천점수나 과거 F1 런타임 표시
- `.claude/settings.local.json`, scheduled task, bridge loop, hook·전역설정 변경
