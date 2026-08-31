# Current work

- Gate: CHG-G6-002 / G4 VS-I 공식 Supabase 공개 런타임 연결 로컬 QA 완료
- Work unit: 제품·시설·HACCP·공동제조 런타임 연결 마감 및 Preview 승인 준비
- Work order: `.moai/project/work-orders/CHG-G6-002-G4-VS-I-SUPABASE-RUNTIME-WIRING-v0.1.md`
- Approval record: `.moai/project/approvals/CHG-G6-002-APPROVAL-C.md`
- Status: **VS_I_RUNTIME_WIRING_PASS / LOCAL_PRODUCTION_QA_PASS / PRECOMMIT_AUDIT_PASS / DEPLOYMENT_NOT_EXECUTED**
- Active change baseline: `CHG-G6-002 v0.1`

## 정정된 기준

- 기존 Production과 Preview는 MVP 기술 초안이자 비교 기준선이다.
- 현재 만족도가 확인된 대체 식재료 목록·6개 유사도·영양 비교 UI는 보존한다.
- 기존 Foodground의 업체별 생산제품·HACCP·행정정보를 복원한다.
- 공동제조 후보는 제품유형·품목·필수 CCP·지역·인증의 일치·미충족·미확인 근거를 보여야 한다.
- 레시피 또는 기존 제품에서 업체 검증까지 선택상태가 이어져야 한다.
- 문의는 업체 근거 검증 이후의 보조 연락수단이다.

## Approval A 완료 증거 요약

- DDL migration 0028-0034: 7개 전부 `db push` 성공
- 원격 테이블: 전부 0행 (빈 테이블 정상)
- Data API: anon key로 5개 public 테이블 빈 SELECT 성공, private/staging 미노출
- 스키마 덤프: SKIPPED (Docker 미사용, migration 실패 아님)
- 기존 VS-2 데이터: 변경 없음
- 인프라: 4 GB → 8 GB 디스크 리사이즈, Spend Cap 활성, Nano 컴퓨트, 7건 물리 백업

## Approval B 완료 증거 요약

- staging.production_log_raw: 1,047,894행
- staging.haccp_cert_raw: 308행
- staging.sales_suspension_raw: 355행
- staging.company_profiles_raw: 308행
- private.company_profile_mapping: 308행
- checkpoint 5개 completed, loaded_rows와 lineage 일치
- 적재 후 원본 5종 건수·불변성 재검증 PASS
- G6 public 도메인 객체 5종 0행, 기존 VS-2 public 7개 테이블 행수 불변
- `PUBLIC-LINEAGE-001`: 미게시 staging lineage 5건이 기존 public view에서 anon 조회됨
- migration 0035 원격 적용 후 anon Data API에서 미게시 lineage 0건 확인
- Approval C 차단. public 게시·Vercel·Git 금지

## 안전하게 완료된 범위

1. Approval A migration 0028~0034 원격 적용·검증 완료
2. Approval B staging 5종 적재·checkpoint·원본불변성 검증 완료
3. `PUBLIC-LINEAGE-001` 로컬 보완 migration 0035·게시/롤백/검증 계약 작성
4. 최종 로컬 검증: py_compile PASS, 단위 테스트 109건 PASS, dry-run validator 0 오류, git diff 오류 0건
5. 원격 migration 0035 단독 적용: dry-run에서 pending 1건 확인 후 db push 성공
6. 원격 anon 검증: 미게시 lineage 0건, 공개 lineage 7건 모두 publish_version 존재
7. 회귀 검증: 기존 VS-2 public 7종 기준 건수 유지, G6 public 도메인 관계 5종 0건 유지
8. Migration 0036 ACL Hardening 로컬 보완: BEGIN/COMMIT 트랜잭션, 6개 관계 REVOKE ALL + GRANT SELECT, 2 sequence REVOKE ALL, DML 없음
9. Rollback 0036 fail-closed 보안 rollback: insecure 기본값 복원 대신 동일 SELECT-only ACL 보존, 거짓 복원 주장 제거
10. 0036 검증: dryrun validator PASS, unittest TestMigration0036AclHardening 13건 PASS — 최종 통합 단위 테스트 **105건 PASS**
11. 원격 migration 0036 단독 적용: dry-run에서 pending 1건 확인 후 db push 성공, local/remote 이력 일치
12. 게시 전 anon 검증: G6 public 5종 0건, 미게시 lineage 0건 유지
13. Approval C 2차 시도: `pg_policies.roles` name[]/text[] 타입 불일치와 `cmd` 카탈로그 값 오해로 COMMIT 전 자동 롤백, public·lineage 0건 재확인
14. publish/verify 정책 카탈로그 교정: `upper(cmd) IN ('SELECT','ALL')`, `roles::text[]`과 anon+authenticated 또는 public 역할 검증, 회귀테스트 4건 추가
15. Approval C 3차 게시: lineage marker 5건을 `chg-g6-002-v1`로 원자 설정하고 public 5종 게시·PK·FK·매핑·비공개 열·RLS/ACL 사전 경비 PASS 후 COMMIT
16. Approval C 게시 후 검증: products 1,047,894, facility-products VIEW 815,989, HACCP 308, safety 103, manufacturing profiles 265, mapping 308 정확 일치; PK/FK/VIEW/RLS/ACL/pg_policies/lineage 전 항목 PASS
17. 독립 anon Data API 재검증: public 5종과 `chg-g6-002-v1` lineage 5건은 exact count PASS, private mapping은 HTTP 404로 차단 PASS
18. VS-I Supabase 런타임 연결: 제품검색·상세, 시설제품·HACCP·안전정보, 공동제조 265개 프로필을 공식 public anon 경계로 전환
19. fail-closed 보완: 부분 환경변수·하위 근거조회 오류에서 SQLite fallback 또는 빈 근거 표시를 금지하고 `FG_DATA_UNAVAILABLE`로 통제
20. 104만 건 조회 최적화: PG 57014 재현 후 PK 정렬·planned count·제품명 GIN 전문검색으로 무DDL 해결
21. 제품 카테고리: 원본 read-only 빈도 상위 30개 집계 JSON을 단일 런타임 출처로 적용, 초기 30회 REST 요청 제거
22. 최종 독립검증: lint 0 errors, typecheck·build·diff PASS, fresh production `/products` 2.17초, Playwright **24/24 PASS**
23. 커밋 전 감사: 후보 112개·2.61 MiB 확정, 실제 비밀키 0건, 개인설정·F1 원본 28개·output·환경파일 제외, 임시 패치 스크립트 제거, lint·typecheck·build·단위테스트 109건·dry-run 재검증 PASS

## 다음 단계

1. 사용자 별도 승인 후 현재 Preview 계보에서 `codex/chg-g6-002-vs-i-preview` 브랜치를 만들고 감사된 112개 후보만 커밋한다.
2. VS-I 변경만 분리 검토하도록 최초 PR base를 기존 `codex/chg-g6-001-g4-vs-01-preview`로 두고 Vercel Preview를 검증한다.
3. Preview UAT와 선행 Preview 계보 정리 전 `main`·Production은 변경하지 않는다.

**Approval C 공개 데이터와 VS-I 로컬 런타임 연결·production QA·커밋 전 감사까지 통과했다. 제품·시설·HACCP·안전정보·공동제조 조회는 공식 Supabase anon 경계에서 실데이터로 동작하며 24개 시나리오가 통과했다. Vercel·Git은 변경하지 않았다.**

## 현재 산출물

- `docs/design/chg-g6-002-integration-gate-1/` 통합 시안·자산대조·서비스 청사진
- 데스크톱·모바일 12개 와이어프레임과 자동 QA
- 루트 프로젝트의 CHG-G6-002 변경요청·문서영향표·기획/개발/실행계획 새 검토본
- `data/derived/chg-g6-002/` 프로필 308행 매핑: linked 265, ambiguous 4, unlinked 39
- `supabase/migrations/20260830*_vs-a_g6_002_*.sql` 공개·private·staging·checkpoint 계약 7종과 명시적 rollback
- `scripts/chg_g6_002_*.py` read-only 감사·매핑·staging loader·preflight·통합 dry-run 검증기
- `scripts/chg_g6_002_*.sql` publish·verify·publish rollback SQL
- `scripts/chg_g6_002_run_migration.ps1` SecureString 보안 실행기
- `docs/qa/chg-g6-002-vs-a-asset-mapping.md` 원본·매핑·컬럼계약 독립검증 증빙
- 제품 검색·상세와 시설별 생산제품·HACCP·CCP·안전정보 실제 원본 연결 API·UI
- `docs/qa/chg-g6-002-vs-b-product-facility-evidence.md` 실데이터·데스크톱·모바일 QA 증빙
- 제품·레시피 → 제품화 브리프 → 근거형 공동제조 후보 → 실제 시설 상세 연결
- `docs/qa/chg-g6-002-vs-c-manufacturing-brief-match.md` 265/43 경계·판정·반응형 QA 증빙
- `docs/design/chg-g6-002-integration-gate-1/productization-context-contract-v0.1.md` 선택맥락 필드·금지사항 계약
- 레시피 → 원재료 → 대체 후보 → 제품화 브리프 → 제조후보 → 시설 근거 → 문의의 실제 URL·화면 연결
- `docs/qa/chg-g6-002-vs-d-context-flow.md` 실제 청국장 경로·12개 통합 회귀 QA 증빙
- `docs/qa/chg-g6-002-vs-e-remote-runtime-readiness-audit.md` 용량·migration·런타임 공백 독립감사
- `docs/qa/chg-g6-002-vs-f-data-load-package.md` VIEW·checkpoint·loader·publish·보안 실행기 로컬 검증 증빙
- `.moai/project/approvals/CHG-G6-002-APPROVAL-A.md` Approval A 실행 기록
- `supabase/migrations/20260831000000_0035_g6_002_lineage_publish_boundary.sql` PUBLIC-LINEAGE-001 VIEW 경계 수정
- `supabase/rollback/20260831_0035_g6_002_lineage_publish_boundary_rollback.sql` 0035 스키마 rollback
- publish/verify/publish_rollback SQL lineage marker 원자 설정·검증·해제 (섹션 5/8/2 추가)
- `docs/qa/chg-g6-002-vs-h-lineage-publish-boundary.md` PUBLIC-LINEAGE-001 수정 QA 증빙
- `.moai/project/work-orders/CHG-G6-002-G4-VS-H-LINEAGE-PUBLISH-BOUNDARY-v0.1.md` VS-H 작업지시서
- `.moai/project/work-orders/CHG-G6-002-G4-VS-I-SUPABASE-RUNTIME-WIRING-v0.1.md` VS-I 작업지시서
- `docs/qa/chg-g6-002-vs-i-supabase-runtime-wiring.md` 24개 production-runtime QA 증빙
- `data/derived/chg-g6-002/product_category_top30.json` 제품 카테고리 빈도 상위 30개 비식별 집계
- Request 022 최종 교정: publish/rollback/verify에 dataset_name 이중 키·expected row guards·distinct run ID 추가, verify VIEW 필터 lower() case-robust, 0035 view owner 용어·PUBLIC REVOKE 추가, 구조 테스트 10건 추가. 당시 93건 PASS; Request 025 이후 최종 105건

## 금지 사항

- Approval C publish 재실행 또는 게시 데이터 수동 수정
- 신규·기존 Supabase 데이터 추가 적재/publish
- Vercel 재배포·환경변수 변경
- commit·push·PR·merge
- 기존 `wavenvibe/foodground`, `foodground.vercel.app`, 기존 Supabase 쓰기
- 가짜 제품·HACCP·CCP·공동제조 결과와 과거 F1의 런타임 성능 오표시
