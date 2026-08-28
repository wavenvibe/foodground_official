# 08. Implementation slices

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002
- Implementation: NOT STARTED

## 1. 공통 원칙

- 각 VS는 UI·데이터·권한·상태·시험·증빙을 함께 완료한다.
- 다음 VS로 자동 이동하지 않는다 — 각 VS 완료 후 사용자 확인 또는 별도 승인이 필요하다.
- 원격 migration·적재·배포·commit·push는 별도 사용자 승인사항이다.
- 사용자 G3 설계 승인 전 어떤 VS도 시작하지 않는다.

## 2. VS 목록

### VS-1: 소스·코드·데이터 감사와 fixture·계약 확정

**목적**: G3 설계 가설을 실제 파일·컬럼·스키마로 검증하고 구현 계약을 확정한다.

**선행 작업 (요구사항 ID 아님)**: WORK-VS1-AUDIT — 아래 작업 목록에 FG-DAT-* 요구사항 ID 명시

**입력 자산**:
- final_output/analysis_outputs/ 파일 목록·헤더
- final_output/reference_data/ 표준 식품 파일
- 현재 working tree (Codex 프로토타입 파일)
- DOC-07 요구사항 56+4건

**요구사항 ID**: FG-DAT-001, FG-DAT-003~011

**작업 (읽기 전용)**:
1. analysis_outputs/ 디렉토리 파일 목록·포맷·헤더·건수·키 확인 (FG-DAT-003)
2. 6개 지표 실제 필드명 확인 → 03-data-contract 업데이트 (FG-DAT-004)
3. substitute_pairs 234,955 건수 대조 (FG-DAT-005)
4. 표준 식품 686건 확인 (FG-DAT-006)
5. 레시피 70,165 / 식재료 18,933 / 시설 94,723 원본 데이터 접근 확인 (FG-DAT-007)
6. 연락정보 사용 계획 확인 (tel·homepage 공개 범위, email 없음 확인) — Q-01 대체 (FG-DAT-008)
7. fixture 100건 생성 (QA용 표본) (FG-DAT-009)
8. 데이터 이용 계약 확인 (Q-04) (FG-DAT-001/010/011)

**원격 변경**: 0건

**테스트**:
- analysis_outputs/ 파일 건수 = 기준선 (234,955, 69,406 등)
- 6개 지표 필드명 확인 → 설계서에 반영
- fixture 100건 로컬 검증

**증빙**: docs/qa/vs1-audit-evidence.md (파일 목록, 건수, 해시, 컬럼명)

**완료 조건**: 모든 UNKNOWN 중 VS-2 진입 전 필요한 항목 해소, fixture 생성, 계약 확정

---

### VS-2: 신규 Supabase staging·publish·공개권한·rollback

**목적**: 신규 Supabase 프로젝트 `glczrbadvfgmblmkpgfj`에 데이터를 적재하고 공개 읽기 권한을 설정한다.

**요구사항 ID**: FG-OPS-001~010 (운영·적재 선행 조건)

**설계 완료 (승인 전 작성 가능)**:
- migration DDL 의사코드 (04-supabase-schema-migration-rls.md)
- RLS 정책 설계
- rollback 절차 설계
- staging 검증 계획

**원격 승인점 (사용자 명시적 승인 필요)**:
1. **승인점 A**: 신규 Supabase `glczrbadvfgmblmkpgfj` 스키마 생성 실행
2. **승인점 B**: staging 적재 완료 후 건수·키·표본 대조 확인
3. **승인점 C**: public 권한·RLS·인덱스 활성화 실행

**Migration 순서**:
1. DDL 실행 (테이블·인덱스·data_lineage)
2. CSV/JSON → staging 임시 테이블 적재
3. 건수·키·표본 검증 → 사용자 확인
4. staging → public 테이블 UPSERT (멱등성 보장)
5. RLS anon 읽기 정책 활성화
6. anon 쿼리 응답 테스트

**rollback 절차**: TRUNCATE staging 테이블, DROP TABLE IF EXISTS 스키마 복구, 테이블·뷰별 정확한 객체 지정 REVOKE (예: `REVOKE SELECT ON TABLE public.facilities FROM anon`)

**테스트**:
- COUNT(*) = 기준선 각각 (94,723 / 70,165 / 18,933 / 234,955)
- anon SELECT 성공 / INSERT 실패 검증
- 매칭방법별 건수 진단 (완전일치 488·포함일치 11,764·철자유사 295·동의어 35·미매칭 11,224 기준 대조, 허용 편차 없음)
- 표본 100건 수동 대조

**증빙**: docs/qa/vs2-migration-evidence.md (건수, 오류율, 표본 대조 결과)

**완료 조건**: 모든 테이블 건수 = 기준선, RLS 정책 활성, anon 쿼리 응답 확인

---

### VS-3: 공개 레시피·식재료·제조시설 탐색

**목적**: /facilities, /recipes, /ingredients 목록·상세 화면 구현 및 검증

**요구사항 ID**: FG-FUN-001~005·008~012, FG-FUN-032~035, FG-NFR-001~010

**라우트·컴포넌트**:
- /facilities, /facilities/[id]
- /recipes, /recipes/[id]
- /ingredients, /ingredients/[id]
- 호환 경로: /search → /facilities, /b/[id] → /facilities/[id]

**API**:
- GET /api/facilities, GET /api/facilities/[id]
- GET /api/recipes, GET /api/recipes/[id]
- GET /api/ingredients, GET /api/ingredients/[id]

**데이터**: VS-2 연결 (glczrbadvfgmblmkpgfj 신규 Supabase)

**상태 구현**: loading, empty, error, unavailable, not-found (5개)

**390px·1440px 검증**:
- 390px: 가로 스크롤 없음, 1컬럼 카드, 필터 접근 가능
- 1440px: 좌측 필터 240px + 우측 결과 영역

**테스트**:
- 검색·필터·정렬·페이지네이션 동작 확인
- 5개 상태 각 확인
- npm run lint, npm run build 통과
- 390px·1440px 브라우저 검증

**증빙**: 브라우저 스크린샷 (390px/1440px), 빌드 로그

**선행 조건**: VS-2 완료 (Supabase 연결 확인 후)

**완료 조건**: 모든 라우트 정상 동작, 5개 상태 구현, 빌드 성공, 반응형 확인

---

### VS-4: 대체 식재료 조회·후보·6개 지표·영양·근거

**목적**: /substitutes 대체 식재료 추천 기능 구현 및 검증

**요구사항 ID**: FG-FUN-026~030 (FG-FUN-031 보류 제외)

**라우트·컴포넌트**:
- /substitutes
- SubstituteSearch, SubstituteCandidateList, SimilarityBar, NutritionTable, MatchTypeBadge, ProvenanceBadge, LimitationNotice

**API**: GET /api/substitutes?ingredient=

**데이터**: substitute_pairs (VS-1·VS-2 선행)

**상태 구현**: loading, empty, error, unavailable, malformed-input, no-candidate, partial-match (7개)

**특수 처리**:
- exact match: 정확 일치 배지 표시
- substring match: "부분 일치" 배지 + 계보 고지
- no-candidate: 후보 없음 + 기준 식품 범위 안내
- 6개 지표 NULL 처리 (측정불가 표시)
- 영양값 단위 (100g 기준) 표시

**테스트**:
- exact/substring 결과 각 배지 표시 확인
- no-candidate 상태 확인
- 6개 지표 모두 표시·NULL 처리 확인
- 면책고지 항상 표시 확인
- 발송완료 문구 없음 확인

**선행 조건**: VS-1 (6개 지표 필드명 확정), VS-2 (substitute_pairs 적재)

**완료 조건**: 7개 상태 구현, 배지·고지·지표·영양 표시, 빌드 성공

---

### VS-5: 시설 상세·연락정보·문의 초안

**목적**: 시설 상세 페이지 연락정보 표시 및 문의문안 복사 기능 구현 (FG-FUN-042·044·060 보류)

**요구사항 ID**: FG-FUN-059, FG-SEC-004, FG-SEC-009, FG-SEC-010

**화면·라우트**:
- /facilities/[id] (상세 + ContactButton)

**API**: GET /api/facilities/[id]

**데이터**: facilities (VS-2 선행)

**특수 처리**:
- ContactButton: 문의문안 클립보드 복사 (기본)
- 복사 성공: "복사되었습니다" 피드백 (1초 후 복원)
- 복사 실패: 텍스트 영역 선택 유도
- tel 필드 존재 시: 전화번호 표시
- homepage 필드 존재 시: 링크 표시
- 별도 승인 이메일 확보 시에만 mailto 활성화 — 현재 비활성
- "발송완료" 오표현 금지 (B-06)
- 원본 facility 테이블에 email 컬럼 없음 — 이메일 추정·수집 금지

**보안 (FG-SEC-004·009·010)**:
- 개인정보 포함 필드 공개 금지 (이메일·대표자명)
- anon 클라이언트 + RLS 접근 — service-role 미사용
- 입력 sanitize (mgt_no 길이·허용문자 검증)

**테스트**:
- ContactButton 복사 동작 확인 (성공·실패 분기)
- tel·homepage 조건부 표시 확인
- "발송 완료" 문구 없음 자동 검색
- mgt_no 부정입력 → 400 반환 확인
- anon 권한 초과 요청 → 거부 확인

**선행 조건**: VS-3 (시설 탐색 기반), VS-4 (대체 후보 연결점)

**완료 조건**: ContactButton 동작, 오표현 없음, 보안 검증, 빌드 성공

---

### VS-6: 조건부 법령안내·공통 상태·통합 QA·배포·인계

**목적**: 조건부 /label-guide 구현 (자료 제공 시), 통합 QA, 배포, 인계

**요구사항 ID**: FG-FUN-037, 040, 049, 051 (조건부), FG-SEC-001~003

**활성화 조건**: 사용자 승인 법령자료 제공 시만 활성화

**자료 미제공 시**: /label-guide 메뉴 없음, 라우트 비노출

**자료 제공 시**:
- 정적 검색 (키워드)
- FAQ 카테고리 목록
- 기준일·면책고지 항상 표시

**통합 QA**:
- 전 화면 회귀 테스트 (VS-1~5 기능 재확인)
- 보안 스캔 (개인정보·SQL·stack trace 노출 없음)
- 성능 측정 (신규 기준)
- 복구 테스트 (rollback 절차 재확인)

**배포**:
- Vercel Preview 배포 → 사용자 UAT
- Vercel Production 배포 (사용자 최종 승인 후)

**인계**:
- Git 저장소 (`wavenvibe/foodground_official`) 소유권 확인
- Supabase 관리자 권한 이전
- 설계 문서 (.moai/design/chg-g4-002/) 인계
- 운영 매뉴얼 작성

**선행 조건**: VS-3·4·5 완료, 조건부 자료 제공 여부 확인, G5 전체 QA 승인

**완료 조건**: 통합 QA 완료, 배포 성공, 인계 완료

## 3. 슬라이스 추적표

| VS | 요구사항 ID | 화면·라우트 | API | 테이블·뷰 | 상태 | 테스트 | 증빙 | 선행·승인 | 완료 조건 |
|---|---|---|---|---|---|---|---|---|---|
| VS-1 | WORK-VS1-AUDIT (내부 작업) | 해당 없음 (감사) | 없음 | 없음 | 해당 없음 | 건수·컬럼·fixture | vs1-audit-evidence.md | 원격 변경 없음 | UNKNOWN 해소, fixture 생성 |
| VS-2 | WORK-VS2-INFRA (내부 작업) | 해당 없음 | 없음 | 7개 테이블 생성 (public 6 + private.data_lineage 1) | 해당 없음 | COUNT, RLS, 표본 | vs2-migration-evidence.md | **사용자 원격 승인 3회** | 기준선 건수 일치, anon 접근 |
| VS-3 | FG-FUN-001~005·008~012, 032~035 | /facilities, /recipes, /ingredients | 6개 GET API | facilities, recipes, ingredients | 5개 | 검색·필터·페이지·390/1440 | 스크린샷, 빌드 로그 | VS-2 연결 | 5개 상태, 빌드, 반응형 |
| VS-4 | FG-FUN-026~030 (031 보류) | /substitutes | GET /api/substitutes | substitute_pairs | 7개 | 지표·배지·면책고지 | 스크린샷, 빌드 로그 | VS-1 (지표 확정), VS-2 | 7개 상태, 지표, 배지 |
| VS-5 | FG-FUN-059, FG-SEC-004·009·010 | /facilities/[id] | GET /api/facilities/[id] | facilities | 2개 | ContactButton, 복사, 보안 | 테스트 로그 | VS-3·4 | ContactButton 동작, 오표현 없음, 보안 |
| VS-6 | FG-FUN-037, 040, 049, 051 (조건부) | /label-guide | 없음 | 없음 (정적) | 조건부 | UAT, 보안, 성능, 회귀 | UAT 기록, 배포 URL | 조건부 자료 제공, G5 | 배포, 인계 완료 |

## 4. 원격 변경 승인표

| 항목 | 대상 식별자 | 백업·복구 | rollback | 승인자 | 실행 증빙 |
|---|---|---|---|---|---|
| Supabase 스키마 생성 | glczrbadvfgmblmkpgfj | 없음 (신규 프로젝트) | DROP TABLE | 사용자 | migration 실행 로그 |
| Supabase 데이터 적재 | glczrbadvfgmblmkpgfj | staging 임시 테이블 | TRUNCATE staging | 사용자 (건수 확인 후) | COUNT 결과 캡처 |
| Supabase 공개 권한 | glczrbadvfgmblmkpgfj | REVOKE SELECT로 rollback | 각 테이블별 REVOKE SELECT (예: REVOKE SELECT ON TABLE public.facilities FROM anon) | 사용자 | anon 쿼리 테스트 결과 |
| Vercel Preview 배포 | wavenvibe/foodground_official | 이전 배포 URL 유지 | 이전 배포 재활성화 | 사용자 | Vercel 배포 URL |
| Vercel Production 배포 | 동일 | 동일 | 이전 Production 재활성화 | 사용자 (UAT 후) | Vercel 배포 URL + 커밋 SHA |
| commit·push | codex/g1-baseline 또는 새 브랜치 | git revert | 이전 커밋 revert 또는 수정 커밋 | 사용자 | git log |

## 완료 확인

- [x] VS-1~6 범위와 순서 정의
- [x] 요구사항·화면·API·DB·상태·테스트·증빙 정의
- [x] 각 VS의 사용자 승인점 명시
- [x] 다음 VS 자동 이동 금지 원칙 명시
