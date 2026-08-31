# CHG-G6-002 G4 VS-F 공식 데이터 적재 패키지 v0.1

## 1. 목표

사용자가 승인한 선택지 C(VIEW)와 로컬 직접 실행 방식에 따라, 제품·HACCP·안전·공동제조 데이터를 신규 공식 Supabase에 안전하게 옮길 수 있는 migration·staging 적재·게시·검증·rollback 패키지를 로컬에서 완성한다. 이번 슬라이스는 실제 원본 dry-run과 정적 검증까지만 수행하며 원격 Supabase에는 접속하거나 쓰지 않는다.

## 2. 권위 기준

1. 사용자 승인: `선택지 C(VIEW)와 로컬 직접 실행 방식`
2. `.moai/project/approvals/CHG-G6-002-DOCUMENT-GATE-APPROVAL.md`
3. `docs/qa/chg-g6-002-vs-e-remote-runtime-readiness-audit.md`
4. migration 0028~0033과 기존 VS-2 보안 실행기 패턴
5. 기존 `wavenvibe/foodground`, 기존 Supabase, `foodground.vercel.app` 읽기 전용 불변 원칙

## 3. 확정 데이터 계약

| 계층 | 대상 | 기대 건수 |
|---|---|---:|
| staging | production_log_raw | 1,047,894 |
| staging | haccp_cert_raw | 308 |
| staging | sales_suspension_raw | 355 |
| staging | company_profiles_raw | 308 |
| private | company_profile_mapping | 308 = linked 265 + ambiguous 4 + unlinked 39 |
| public | products_public | 1,047,894 |
| public VIEW | facility_products_public | 815,989 |
| public | haccp_certifications_public | 308 |
| public | facility_safety_public | 103 |
| public | manufacturing_profiles_public | 265 |

원본 SQLite는 `FOODGROUND_SOURCE_DB` 환경변수로만 받고 URI `mode=ro`와 `PRAGMA query_only=ON`으로 읽는다. 공동제조 프로필·매핑 경로도 환경변수 또는 저장소 상대경로만 사용하며 사용자 절대경로를 코드·로그·문서에 기록하지 않는다.

## 4. 구현 범위

### 4.1 선택지 C migration 정리

- `facility_products_public`은 실테이블이 아니라 `products_public WHERE facility_mgt_no IS NOT NULL`의 VIEW로 정의한다.
- PostgreSQL 15+에서 가능한 경우 `security_invoker=true`를 사용하고, anon/authenticated에는 SELECT만 부여한다.
- `products_public.facility_mgt_no` 부분 인덱스를 그대로 조회에 사용한다.
- rollback은 TABLE이 아닌 VIEW를 정확히 제거하고 기존 VS-2 객체는 보존한다.
- migration·rollback 주석의 건수·의존성·용량 설명을 VIEW 기준으로 정정한다.

### 4.2 staging 적재기

- Python 로컬 실행기로 production_log·haccp_cert·sales_suspension·company_profiles·mapping을 청크 적재한다.
- 기본 batch size와 `--batch-size`, `--only`, `--dry-run`, `--resume`을 제공한다.
- production_log는 안정적인 원본키 `report_no ASC`를 기준으로 체크포인트 이후 재개한다. 나머지는 각 PK 또는 company_id를 사용한다.
- 체크포인트는 private 스키마의 전용 테이블에 dataset, ingest_run_id, source_fingerprint, last_source_key, loaded_rows, status, updated_at을 보존한다.
- source fingerprint가 달라지면 기존 체크포인트 재개를 거부한다.
- 청크는 트랜잭션 단위로 커밋하고 staging PK에 idempotent UPSERT하여 재실행 중복을 방지한다.
- 자격증명·DSN·원본 경로·원문 샘플을 출력하지 않는다.

### 4.3 preflight·게시·검증

- preflight는 승인 프로젝트 ref `glczrbadvfgmblmkpgfj`, migration 존재, 기존 VS-2 7개 테이블 보존, staging/public 예상 상태를 확인한다.
- staging → public 게시 SQL은 단일 트랜잭션으로 실행한다.
- public 4개 실테이블은 full refresh 또는 동등한 원자적 방식으로 일관되게 교체하고 VIEW는 자동 반영한다.
- 게시 전후 건수, PK 중복, 시설 FK 고아, linked/ambiguous/unlinked 경계, 비공개열 부재를 검증한다.
- public 게시 후 기대 건수 1,047,894 / VIEW 815,989 / 308 / 103 / 265를 확인한다.
- anon/authenticated SELECT·쓰기 차단과 staging/private 접근 차단 검증 절차를 포함한다.

### 4.4 rollback·보안 실행기

- rollback은 CHG-G6-002 신규 객체와 데이터만 대상으로 하며 VS-2 7개 테이블·데이터를 변경하지 않는다.
- migration rollback과 게시 데이터 rollback의 목적을 구분한다.
- PowerShell 실행기는 URI template과 비밀번호를 숨김 입력으로 받고 process scope 환경변수만 사용하며 `finally`에서 제거한다.
- 실제 원격 실행 명령은 준비하되 이번 슬라이스에서는 호출하지 않는다.

### 4.5 검색 인덱스 경계

- 기존 `GIN to_tsvector(product_name)`가 현재 ILIKE 검색을 직접 가속하지 않는 사실을 주석·검증 문서에 남긴다.
- pg_trgm 도입이나 런타임 검색 변경은 VS-G 결정사항으로 남기며 이번 migration에 임의 추가하지 않는다.

## 5. 필수 검증

- 실제 원본 SQLite/CSV 전체 dry-run: 건수·키·NULL·공개/비공개열·mapping 265/4/39
- Python `py_compile`, PowerShell AST, SQL 정적 검사
- 기존 `scripts/chg_g6_002_dryrun_validator.py`를 VIEW 계약에 맞게 갱신해 PASS
- source DB `mode=ro`·`query_only`와 원본 mtime/크기 불변 확인
- 비밀·절대경로·service role key·원문 샘플 출력 0건
- lint·typecheck·build는 앱 코드 미변경이면 생략 사유 기록, 변경되면 실행

## 6. 산출물

- migration/rollback VIEW 정정본
- checkpoint schema migration
- staging loader, preflight, publish, verify, secure PowerShell wrapper
- `docs/qa/chg-g6-002-vs-f-data-load-package.md`
- 실행 순서·재개법·실패 시 조치·원격 승인점

## 7. 완료 조건과 중단점

- 로컬 dry-run·정적검증 전부 PASS
- 실제 Supabase 접속·migration·staging 적재·public 게시 0건
- 완료 후 원격 승인점 A(DDL) 진입 전 필요한 대시보드 용량과 사용자 입력만 보고하고 중단한다.

## 8. 절대 금지

- 신규·기존 Supabase 원격 조회·DDL·migration·적재·변경
- Vercel·환경변수 원격 변경
- commit·push·PR·merge·브랜치 변경
- 원본 SQLite·CSV 수정·복사
- `.claude/settings.local.json`, hook, scheduled task, bridge loop 변경
- 선택지 A/B로의 임의 회귀, 가짜 데이터·가짜 적재 결과 생성
