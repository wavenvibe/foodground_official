# CHG-G6-002 VS-B 제품·업체·HACCP 근거 연결 QA

- 상태: **PASS — 로컬 실제 원본 검증 완료**
- 기준 작업지시: `.moai/project/work-orders/CHG-G6-002-G4-VS-B-PRODUCT-FACILITY-EVIDENCE-v0.1.md`
- 검증일: 2026-08-30
- 원격 변경: 없음

## 1. 구현 결과

기존의 분리된 메뉴 구조를 보완해 다음 직접 연결 흐름을 구현했다.

1. 제품 검색 `/products`
2. 제품 상세 `/products/[reportNo]`
3. `facility_mgt_no` 기반 실제 제조업체 연결
4. 제조시설 상세의 생산제품·HACCP 인증번호·인증일·CCP 표시
5. 제품명·제품코드·시설 관리번호로 직접 연결된 안전정보 표시

홈과 헤더에도 제품 진입점을 추가했으며, 홈에는 `제품 → 제조업체 → HACCP·CCP → 안전정보·문의` 4단계 흐름을 명시했다.

## 2. 데이터 안전 경계

- 원본 SQLite는 `FOODGROUND_SOURCE_DB` 환경변수로만 전달한다.
- 데이터 계층은 `readonly: true`, `fileMustExist: true`, `PRAGMA query_only = ON`으로 연다.
- 개인 PC 절대경로는 코드·문서·환경 예시에 기록하지 않았다.
- `maker_addr`, `biz_addr`, `raw_payload`, `road_addr`, 좌표, 내부 SQL 오류는 API에 노출하지 않는다.
- 원본 경로가 없으면 fixture나 가짜 결과를 만들지 않고 `FG_DATA_UNAVAILABLE`을 반환한다.
- HACCP은 시설 수준 인증이며 특정 제품·모든 공정의 적합성을 자동 보증하지 않는다고 화면에 명시했다.
- 안전정보가 0건인 경우에도 ‘안전 판정’으로 표현하지 않고 ‘직접 연결정보 없음’으로 표시한다.

## 3. 실제 원본 검증 사례

| 항목 | 검증값 |
|---|---|
| 제조시설 | 주식회사소울네이처푸드 |
| 시설 관리번호 | `4490000-106-2013-00033` |
| 직접 연결 생산제품 | 216건 |
| 제품 사례 | 버터그린밀 / 품목보고번호 `20130368349509` |
| HACCP 인증 | `2024-6-0026`, 인증일 `2024-01-01` |
| CCP | 수분활성도측정공정 |
| 직접 연결 안전정보 | 대장균군 기준 규격 부적합 1건 |
| 조치 정보 | 물류 차량 및 택배 |

실제 원본 API에서 제품 검색, 제품 상세, 시설별 제품, 시설별 HACCP, 시설별 안전정보가 모두 HTTP 200으로 반환되었고 위 연결 키가 일치했다.

## 4. 검증 결과

| 검증 | 결과 |
|---|---|
| `npx tsc --noEmit` | PASS, 오류 0건 |
| `npm run lint` | PASS, 오류 0건·기존 경고 5건 |
| `npm run build` | PASS, 제품·시설 증거 API 포함 전체 route 컴파일 |
| `git diff --check` | PASS, 오류 0건 |
| Playwright API·UI | PASS, 3 tests |
| 데스크톱 1440×1000 | PASS, 콘솔·페이지 오류 0건·가로넘침 0건 |
| 모바일 390×844 | PASS, 모바일 제품 메뉴·가로넘침·근거 흐름 확인 |
| 비공개 필드 API 미노출 | PASS |
| 기존 대체 식재료·레시피·식재료·시설 route build 회귀 | PASS |

## 5. 시각 증빙

- `output/playwright/chg-g6-002-vs-b/desktop-home-flow.png`
- `output/playwright/chg-g6-002-vs-b/desktop-product-search.png`
- `output/playwright/chg-g6-002-vs-b/desktop-product-detail.png`
- `output/playwright/chg-g6-002-vs-b/desktop-facility-evidence.png`
- `output/playwright/chg-g6-002-vs-b/mobile-home-flow.png`
- `output/playwright/chg-g6-002-vs-b/mobile-product-search.png`
- `output/playwright/chg-g6-002-vs-b/mobile-product-detail.png`
- `output/playwright/chg-g6-002-vs-b/mobile-facility-evidence.png`

## 6. 미수행·다음 조건

- Supabase migration·적재·RLS 변경 미수행
- Vercel 환경변수·Preview·Production 변경 미수행
- commit·push·PR·merge·브랜치 변경 미수행
- 기존 `wavenvibe/foodground`, `foodground.vercel.app`, 기존 Supabase 변경 없음

다음 VS-C에서는 이번에 검증한 실제 제품·시설·CCP 연결을 입력값으로 제품화 브리프와 제조요건 계약을 설계한다. 공동제조 점수는 308개 프로필 중 직접 연결 265개와 검토대상 43개를 구분하고, 미확인 조건을 감점이나 추정으로 숨기지 않는 근거형 판정으로 제한한다.
