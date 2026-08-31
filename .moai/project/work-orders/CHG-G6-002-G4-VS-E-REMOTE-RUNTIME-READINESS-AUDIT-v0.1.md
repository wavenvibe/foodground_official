# CHG-G6-002 G4 VS-E 공식 데이터·런타임 준비 감사 v0.1

## 1. 목표

VS-B~D에서 로컬 SQLite·CSV로 검증한 제품·HACCP·안전·공동제조 기능이 신규 공식 Supabase와 Vercel에서도 동일한 근거로 동작하도록, 원격 적용 전에 데이터 용량·스키마·적재·런타임의 누락과 위험을 독립 감사한다. 이번 슬라이스는 감사와 실행계획 확정까지만 수행하며 원격 변경은 하지 않는다.

## 2. 권위 기준

1. `.moai/project/approvals/CHG-G6-002-DOCUMENT-GATE-APPROVAL.md`
2. `00_프로젝트관리/푸드그라운드_CHG-G6-002_DATA-GATE_판정_v0.1.md`
3. `.moai/project/current-slice.md`의 VS-A~D PASS 상태
4. VS-A~D 작업지시·QA와 `docs/design/chg-g6-002-integration-gate-1/`
5. 기존 `wavenvibe/foodground`, 기존 Supabase, `foodground.vercel.app` 읽기 전용 불변 원칙

## 3. 감사 범위

### 3.1 데이터·용량

- 원본 SQLite는 `FOODGROUND_SOURCE_DB` 환경변수로만 받고 `mode=ro`·`PRAGMA query_only=ON`으로 읽는다.
- 원본 및 공개 예상 건수를 재검증한다.
  - `production_log`: 1,047,894 / 시설 연결 815,989 / 미연결 231,905
  - `haccp_cert`: 308 / 시설 연결 269 / 미연결 39
  - `sales_suspension`: 355 / 공개 직접연결 103
  - 공동제조 프로필: 308 / 공개 linked 265 / ambiguous 4 / unlinked 39
- 각 projection의 실제 텍스트 바이트, 예상 CSV 크기, PostgreSQL 적재량의 보수적 범위를 산출한다.
- `products_public`와 `facility_products_public`의 815,989건 중복 저장 필요성을 점검한다. 승인 설계를 임의 변경하지 말고, 중복 저장·경량 연결 테이블·view 중 권고안과 영향만 보고한다.
- 현재 신규 Supabase의 잔여 용량은 자격증명 없이 확인할 수 없으면 사용자 확인항목으로 분리한다.

### 3.2 migration·보안·복구

- migration 0028~0033과 rollback의 컬럼·FK·인덱스·RLS·ACL·실행순서·원자성을 대조한다.
- staging 원본계약, private mapping, public projection 사이의 누락·불일치 여부를 찾는다.
- anon/authenticated 공개열과 비공개열을 명시한다. `raw_payload`, `biz_addr`, `maker_addr`, 내부 검토필드는 공개 금지다.
- 100만 건 이상 적재의 중단·재개·중복실행 방지·부분 실패 복구 방법을 정의한다.
- 기존 VS-2 공개 7개 테이블과 데이터를 보존하고, CHG-G6-002 테이블만 독립 rollback할 수 있어야 한다.

### 3.3 Vercel 런타임

- `lib/source-db.ts`가 로컬 SQLite만 사용하고 공식 Supabase fallback이 없는지 검증한다.
- `lib/manufacturing-match.ts`가 로컬 비추적 CSV에 의존해 Vercel에서 사용할 수 없는지 검증한다.
- 제품 검색·상세, 시설별 제품·HACCP·안전정보, 제조옵션·후보 API가 원격에서 필요로 하는 public 테이블·컬럼·쿼리를 화면별로 매핑한다.
- 로컬 우선/공식 Supabase fallback 계약, 오류 상태, 검색·페이지네이션·정렬·공개열 제한을 설계한다.

## 4. 이번 슬라이스 산출물

- `docs/qa/chg-g6-002-vs-e-remote-runtime-readiness-audit.md`
- 데이터셋별 건수·추정 용량·중복비용 표
- migration/rollback 결함 및 수정 필요 목록
- 로컬 SQLite/CSV → 공식 Supabase 런타임 전환 매트릭스
- 후속 구현을 `VS-F 데이터 적재 패키지`와 `VS-G Supabase 런타임 fallback`으로 나눈 실행순서
- 원격 적용 직전 필요한 사용자 승인·대시보드 확인항목

## 5. 검증

- 기존 `scripts/chg_g6_002_dryrun_validator.py`를 실제 원본으로 실행한다.
- 감사용 추가 코드는 만들지 말고 기존 스크립트와 읽기 전용 쿼리만 사용한다.
- 코드·migration은 수정하지 않는다.
- 긴 lint·build·Playwright는 재실행하지 않는다.
- 결과의 모든 수치는 원본·파일·쿼리 근거를 함께 기록한다.

## 6. 비용·변경 경계

- 승인된 CHG-G6-002 범위 내 로컬 감사이며 공수·현금지출 증액 없음.
- Supabase 원격 DDL·migration·적재·키 변경, Vercel 변경, commit·push·PR·merge는 수행하지 않는다.
- 기존 원본·레거시 환경과 `.claude/settings.local.json`, hook, scheduled task, bridge loop를 변경하지 않는다.
- 감사 결과만으로 승인 설계를 임의 변경하지 않는다. 용량 또는 데이터 계약 변경이 필요하면 `NEEDS_USER_APPROVAL`로 분리한다.
