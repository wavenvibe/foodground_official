# 06. QA and acceptance trace

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002

## 1. 추적 기준

DOC-07 v0.7의 **승인 56건**과 **조건부 4건** (FG-FUN-037, 040, 049, 051)을 전건 추적한다. **보류 46건**은 현재 인수 대상에 포함하지 않는다. 총 추적 대상 60건.

- 추적 방법: DOC-07 v0.7 기준 정식 요구사항명으로 ID별 화면·API·데이터·시험·VS 매핑. 누락 0건 목표.
- 보류 처리된 요구사항: FG-FUN-031·042·044·060 → 보류 (§2.11 참조)
- 조건부 4건: FG-FUN-037·040·049·051 — 사용자 승인 법령자료 제공 시에만 활성화

## 2. 요구사항 추적표 (60건 — DOC-07 v0.7 정식 요구사항명)

### 2.1 기능 요구사항 (공개 탐색·추천·공동제조·문의)

| 요구사항 ID | 상태 | 요구사항명 (DOC-07 v0.7) | 적용 화면·라우트 | API / 내부검증 | 데이터 | 시험 방법 | 합격기준 | 구현 VS |
|---|---|---|---|---|---|---|---|---|
| FG-FUN-001 | 승인 | 공통 내비게이션 | /, /facilities 등 전 화면 헤더·네비 | Server Component | 없음 | 전 화면 메뉴 링크 및 키보드 접근 확인 | 모든 메뉴 링크 동작, Tab 접근 가능 | VS-3 |
| FG-FUN-002 | 승인 | 제조업체 키워드 검색 | /facilities?q= | GET /api/facilities | facilities | 검색어 입력 후 결과 목록 확인 | 관련 시설 목록 표시, 빈 결과 안내 포함 | VS-3 |
| FG-FUN-003 | 승인 | 제조업체 조건 필터 | /facilities?region_sido=&type= | GET /api/facilities | facilities | 필터 조합 결과 정확도 확인 | 필터 조합에 맞는 결과 반환 | VS-3 |
| FG-FUN-004 | 승인 | 검색 정렬·초기화 | /facilities?sort= | GET /api/facilities | facilities | 정렬 순서·안정 정렬·초기화 버튼 확인 | 안정 정렬 tie-breaker 포함, 초기화 동작 | VS-3 |
| FG-FUN-005 | 승인 | 제조업체 상세정보 | /facilities/[id] | GET /api/facilities/[id] | facilities | 공개 필드 전체 표시 확인 | 시설명·지역·업종·HACCP·영업상태·제품유형·tel·homepage 표시 | VS-3 |
| FG-FUN-008 | 승인 | 레시피 검색·분류 | /recipes | GET /api/recipes | recipes | 검색·분류·페이지 결과 확인 | 분류별 필터·검색어 결과 정상 | VS-3 |
| FG-FUN-009 | 승인 | 레시피 재료·조리정보 | /recipes/[id] | GET /api/recipes/[id] | recipes | 재료 목록·조리정보 표시 및 not-found 확인 | 재료·조리정보 표시, 없는 ID → not-found | VS-3 |
| FG-FUN-010 | 승인 | 식재료 표준명·동의어 검색 | /ingredients | GET /api/ingredients | ingredients | 표준명·동의어 검색 결과 확인 | 동의어 입력 시 표준명 결과 포함 | VS-3 |
| FG-FUN-011 | 승인 | 식재료 상세정보 | /ingredients/[id] | GET /api/ingredients/[id] | ingredients | 카테고리·단위 표시 및 not-found 확인 | 상세 정보 표시, 없는 ID → not-found | VS-3 |
| FG-FUN-012 | 승인 | 안정적 페이지네이션 | 전 목록 화면 (?page=&pageSize=) | GET /api/* | 전 테이블 | 50건 제한·hasMore·안정 정렬·tie-breaker 확인 | 마지막 페이지 hasMore=false, 페이지 경계 정상 | VS-3 |
| FG-FUN-026 | 승인 | 기준 식재료 검색·선택 | /substitutes | GET /api/substitutes | substitute_pairs | 기준 식재료 검색·선택 UI 동작 확인 | 검색 결과 표시, 선택 후 후보 조회 진행 | VS-4 |
| FG-FUN-027 | 승인 | 추천 조건 입력 | /substitutes | 내부 검증 | substitute_pairs | 추천 조건 입력 필드 동작 확인 | 조건 입력 → 후보 목록 갱신 | VS-4 |
| FG-FUN-028 | 승인 | 사전산출 후보 조회·순위 | /substitutes | GET /api/substitutes | substitute_pairs | score_final 내림차순 후보 목록 확인 | 후보 목록 score_final 내림차순 정렬 | VS-4 |
| FG-FUN-029 | 승인 | 후보 영양·지표 비교 | /substitutes | GET /api/substitutes | substitute_pairs | 6개 지표 표시·NULL 처리·영양값 단위 확인 | sim_nutrition·sim_ingredient_category·sim_food_group·sim_cooking_state·sim_dish_type·sim_companion 표시 | VS-4 |
| FG-FUN-030 | 승인 | 추천 근거·한계 표시 | /substitutes | GET /api/substitutes | substitute_pairs | 매칭방법 배지(5종)·면책고지 항상 표시 확인 | 완전일치/포함일치/철자유사/동의어/미매칭 배지, 면책고지 표시 | VS-4 |
| FG-FUN-032 | 승인 | 매칭조건 입력 | /facilities (업종·제품유형 필터) | GET /api/facilities | facilities | 업종·제품유형 필터 입력 UI 동작 확인 | 업종·제품유형 입력 → 필터 적용 동작 | VS-3 |
| FG-FUN-033 | 승인 | 후보 필터·순위 | /facilities (필터 결과 목록) | GET /api/facilities | facilities | 필수 조건 위반 없는 후보 목록·순위 확인 | 필수 조건 충족 시설만 목록 표시, 안정 정렬 | VS-3 |
| FG-FUN-034 | 승인 | 일치·미충족 근거 | /facilities/[id] | GET /api/facilities/[id] | facilities | 각 조건 일치 여부 및 데이터 출처 표시 확인 | 조건별 일치·부족 근거와 출처 표시 | VS-3 |
| FG-FUN-035 | 승인 | 제조업체 상세 연결 | /facilities → /facilities/[id] | GET /api/facilities/[id] | facilities | 공동제조 후보 목록에서 시설 상세 이동 및 뒤로가기 조건 유지 확인 | 이동 후 뒤로가기 시 이전 필터 상태 유지 | VS-3 |
| FG-FUN-059 | 승인 | 브라우저 메일초안·복사 | /facilities/[id] (ContactButton) | 클라이언트 clipboard API | facilities | 문의문안 복사·tel·homepage 조건부 표시 확인 | 복사 성공 피드백, 발송완료 오표현 없음, tel/homepage 조건부 표시; **합격기준 분기: [분기 A] 승인된 이메일 소스 확보 → DOC-07 기존 요구사항대로 mailto 브라우저 메일초안 구현 (DOC-07 변경 불필요); [분기 B] 복사 전용으로 최종 확정 → ADM-08 변경등록 + DOC-07 새 리비전 완료 후 복사 전용 구현** | VS-5 |

### 2.2 조건부 기능 요구사항 (법령안내 — 사용자 승인 자료 제공 시)

| 요구사항 ID | 상태 | 요구사항명 (DOC-07 v0.7) | 적용 화면·라우트 | 활성화 조건 | 시험 방법 | 합격기준 | 구현 VS |
|---|---|---|---|---|---|---|---|
| FG-FUN-037 | 조건부 | 법령·FAQ 키워드 검색 | /label-guide | 사용자 승인 법령자료 제공 시 | 자료 미제공 → /label-guide 비노출(404) 확인; 제공 시 키워드 검색 동작 확인 | 자료 없을 때 라우트 비노출 또는 404, 있을 때 검색 정상 | VS-6 |
| FG-FUN-040 | 조건부 | 기준·면책·전문가 확인 | /label-guide | 동일 | 기준일·면책고지 항상 표시, 전문가 확인 안내 표시 확인 | 면책고지·기준일 항상 표시 | VS-6 |
| FG-FUN-049 | 조건부 | 승인 자료 검색·FAQ | /label-guide | 동일 | FAQ 카테고리 목록·검색 동작 확인 | FAQ 카테고리 표시, 검색 정상 | VS-6 |
| FG-FUN-051 | 조건부 | 안내·출처 구분 | /label-guide | 동일 | 정보 출처·날짜 구분 표시 확인 | 출처·기준일 명확히 구분 표시 | VS-6 |

### 2.3 데이터 요구사항

| 요구사항 ID | 상태 | 요구사항명 (DOC-07 v0.7) | 적용 범위 | 내부검증 방법 | 합격기준 | 구현 VS |
|---|---|---|---|---|---|---|
| FG-DAT-001 | 승인 | 마스터 데이터 기준선 | VS-1/2 감사·적재 | COUNT(*) 전 테이블 | facilities=94,723 / recipes=70,165 / ingredients=18,933 / substitute_pairs=234,955 | VS-1/2 |
| FG-DAT-003 | 승인 | 공개 기본조회 규칙 | 공개 API 전반 (anon 역할) | anon 역할 RLS 검증 | anon으로 SELECT 성공, INSERT/UPDATE/DELETE 실패 | VS-2/3 |
| FG-DAT-004 | 승인 | 출처·기준일·버전 | private.data_lineage | 적재 후 레코드 확인 | dataset_name·basis_date·row_count·rule_version 기록 존재 | VS-2 |
| FG-DAT-005 | 승인 | 레시피 제목 충돌 보존 | 레시피 적재 | 동일 이름 중복 처리 확인 | 동일 이름 레시피 키 충돌 없이 보존 | VS-2 |
| FG-DAT-006 | 승인 | 식재료 표준명·동의어 | ingredients / standard_food | 동의어 연결 확인 | 표준명·동의어 관계 정상 적재 | VS-2 |
| FG-DAT-007 | 승인 | 이상 날짜·상태 격리 | 데이터 적재 검증 | 이상 날짜·폐업 상태 행 격리 확인 | 이상 데이터 격리 테이블 이동 또는 제외 기록 | VS-2 |
| FG-DAT-008 | 승인 | 필수값 결측 격리 | 데이터 적재 검증 | NOT NULL 컬럼 결측 행 수 확인 | 필수 컬럼 결측 행 0건 (또는 격리 이동) | VS-2 |
| FG-DAT-009 | 승인 | 현재범위 경량 적재원칙 | VS-2 적재 범위 | 적재 대상 테이블·행 수 확인 | 현재 인수 범위 외 데이터 미적재 | VS-2 |
| FG-DAT-010 | 승인 | 안정 정렬키 | 전 목록 API | ORDER BY 절·EXPLAIN 확인 | mgt_no / (기준식품ID, 후보식품ID) 등 안정 키 + tie-breaker 정렬 | VS-3/4 |
| FG-DAT-011 | 승인 | 조회결과·규칙버전 계보 | private.data_lineage | 계보 레코드 확인 | 조회 결과와 분석 규칙 버전 계보 기록 존재 | VS-2/4 |

### 2.4 보안 요구사항

| 요구사항 ID | 상태 | 요구사항명 (DOC-07 v0.7) | 적용 범위 | 시험 방법 | 합격기준 | 구현 VS |
|---|---|---|---|---|---|---|
| FG-SEC-001 | 승인 | 원본 자산 무변경 | 레거시 저장소·Supabase·Vercel | git diff --stat (레거시) 확인 | 레거시 저장소 변경 0건 | VS-1~6 |
| FG-SEC-002 | 승인 | 신규 공식환경 전용 개발 | 신규 Supabase glczrbadvfgmblmkpgfj | 환경 ID 확인 | 레거시와 다른 프로젝트 ID 사용, 신규 환경 전용 개발 확인 | VS-2 |
| FG-SEC-003 | 승인 | 환경변수·키 분리 | .env / Vercel 환경변수 | 브라우저 Network 탭 검사·.gitignore 확인 | service-role 키 브라우저 미노출, .env 미커밋 | VS-2/3 |
| FG-SEC-004 | 승인 | 공개 필드 최소화 | 공개 API 응답 | API 응답 필드 검사 | 대표자명·이메일·내부 운영기록 미포함 | VS-3~5 |
| FG-SEC-009 | 승인 | 로그·오류 비밀정보 제거 | 공개 오류 응답 | 오류 응답 body 검사 | SQL·테이블명·stack trace·provider URL 미노출 | VS-3~6 |
| FG-SEC-010 | 승인 | 공개 조회권한·비밀정보 음성시험 | anon 역할 음성 테스트 | anon으로 SELECT/INSERT/UPDATE/DELETE 시도 | SELECT만 허용, INSERT/UPDATE/DELETE 실패 | VS-2/3 |

### 2.5 비기능 요구사항

| 요구사항 ID | 상태 | 요구사항명 (DOC-07 v0.7) | 적용 범위 | 시험 방법 | 합격기준 | 구현 VS |
|---|---|---|---|---|---|---|
| FG-NFR-001 | 승인 | 모바일·PC 반응형 | 전 화면 (390px · 1440px 브레이크포인트) | Chrome DevTools 390px / 1440px 화면 확인 | 390px 가로 스크롤 없음, 1440px 2패널 정상 렌더링 | VS-3~6 |
| FG-NFR-002 | 승인 | 로딩·빈 결과·오류·사용불가 | 전 화면 5개 상태 | 상태별 시나리오 테스트 | loading·empty·error·unavailable·not-found 상태 각 확인 | VS-3~6 |
| FG-NFR-003 | 승인 | 키보드·레이블·대비 | 전 화면 접근성 | 키보드 Tab 순회·색상 대비 측정 | Tab 접근, WCAG AA 4.5:1, focus 인디케이터 2px outline 확인 | VS-3~6 |
| FG-NFR-004 | 승인 | 직접 URL·새로고침·404 회귀 | 전 라우트 | URL 직접 입력·F5·없는 ID 접근 테스트 | 직접 URL 정상 렌더링, 새로고침 유지, 없는 ID → 404 | VS-3~6 |
| FG-NFR-005 | 승인 | 쿼리·응답 성능 | 전 API (Supabase 쿼리) | EXPLAIN ANALYZE 실행 | 인덱스 스캔 확인, 쿼리 계획 기록 | VS-3~6 |
| FG-NFR-006 | 승인 | 신규 웹 주요화면 응답성능 | 주요 화면 LCP/FCP | Lighthouse 또는 Vercel Analytics 측정 | 측정 결과 기록 (진단 참고, 계약 합격기준 아님) | VS-6 |
| FG-NFR-007 | 승인 | 안정화기간 가용성 검증 | Vercel Production | 배포 후 오류율 모니터링 | 안정화기간 서비스 오류 없음 확인 | VS-6 |
| FG-NFR-008 | 승인 | 빌드·정적검사 | 전 빌드 사이클 | npm run lint + npm run build 실행 | npm run lint 오류 0건, npm run build 성공, TypeScript 오류 0건 | VS-3~6 |
| FG-NFR-009 | 승인 | 출시차단 결함 | P1 결함 기준 | 통합 QA + 사용자 UAT | FG_DATA_UNAVAILABLE 반복·개인정보 노출·서비스 불가 결함 0건 | VS-6 최종 QA |
| FG-NFR-010 | 승인 | 빈 기능·가짜 화면 금지 | 전 화면 | 실데이터 연결 확인 | 실데이터 없는 빈 화면·가짜 결과 없음 | VS-3~6 |

### 2.6 운영 요구사항

| 요구사항 ID | 상태 | 요구사항명 (DOC-07 v0.7) | 적용 범위 | 시험 방법 | 합격기준 | 구현 VS |
|---|---|---|---|---|---|---|
| FG-OPS-001 | 승인 | 신규 DB 변경승인 | VS-2 원격 승인점 A/B/C | 변경 전 사용자 명시적 승인 확인 | 스키마·RLS·인덱스 변경 전 사용자 승인 기록 존재 | VS-2 |
| FG-OPS-002 | 승인 | 변경 전 백업 | migration 실행 전 | 스냅샷 또는 백업 절차 확인 | 원본 데이터 백업 또는 복원 가능 상태 확인 | VS-2 |
| FG-OPS-003 | 승인 | migration·배포 롤백 | rollback 절차 설계 | rollback 절차 문서 확인 | 개별 테이블·뷰 권한 복구·이전 migration 복원·revert 커밋 절차 기록 | VS-2 |
| FG-OPS-004 | 승인 | 원본과 신규 배포분리 | 신규 Supabase·Vercel 격리 | 환경 분리 확인 | 레거시와 신규 환경 분리, 신규 프로젝트 ID 전용 사용 | VS-2/6 |
| FG-OPS-005 | 승인 | 상태·오류 추적 | Vercel 로그·알림 | 로그 설정 확인 | 배포 후 오류율 모니터링·상태 추적 설정 확인 | VS-6 |
| FG-OPS-006 | 승인 | 소스·계정·환경 인계 | 인계 체크리스트 | 인계 문서 확인 | Git 저장소·Supabase 관리자 권한·Vercel 소유권 인계 확인 | VS-6 |
| FG-OPS-007 | 승인 | 오픈소스·데이터 출처 | 라이선스 확인 | 라이선스 목록 확인 | 사용 오픈소스·데이터 출처 라이선스 기록 | VS-1/6 |
| FG-OPS-008 | 승인 | 추가 현금지출 0원 | 비용 추적 | Supabase·Vercel 청구 확인 | KRW 0 추가 지출, nano·무료 범위 내 | VS-2~6 |
| FG-OPS-009 | 승인 | 요구사항 전 과정 추적 | 이 파일 (06-qa-acceptance-trace.md) | 60건 추적표 완성 확인 | 전 60건 추적표 완성, 보류 46건 분리 기록 | VS-1~6 |
| FG-OPS-010 | 승인 | UAT·배포·완료판정 | VS-6 UAT | 발주자 UAT 사인오프 확인 | UAT 서명·배포 증빙·완료 판정 문서 존재 | VS-6 |

## 3. 기능·상태 시험

| 시험 범주 | 시나리오 | 기대 동작 |
|---|---|---|
| 정상 경로 | 시설 검색 후 상세 이동 후 문의문안 복사 | 검색 결과 표시 → 상세 공개 필드 → 복사 성공 피드백 |
| 경계 | 페이지 50건 정확히 | 마지막 페이지 hasMore=false |
| 빈 결과 (empty) | 존재하지 않는 검색어 | "검색 결과 없음" 안내, 필터 조정 유도 |
| 서비스 불가 (unavailable) | Supabase 연결 실패 | "서비스 점검 중" 별도 메시지 |
| not-found | 없는 시설 ID 직접 URL | 404 상태 + 목록으로 링크 |
| malformed-input | 검색어 101자 이상 | FG_INVALID_INPUT + 형식 안내 |
| no-candidate | 대체 후보 없는 식재료 | "분석 데이터에 후보 없음" + 기준 식품 범위 안내 |
| partial-match | 포함일치·철자유사·동의어 매칭 결과 | "부분 일치" 배지 + 계보 고지 표시 |

## 4. 데이터 품질·계보 시험 (B-03, B-09 반영)

| 항목 | 기준 | 합격 조건 |
|---|---|---|
| substitute_pairs 건수 | 234,955 쌍 | COUNT(*) = 234,955 |
| 레시피 건수 | 70,165 | COUNT(*) = 70,165 |
| 식재료 건수 | 18,933 | COUNT(*) = 18,933 |
| 시설 건수 | 94,723 | COUNT(*) = 94,723 |
| substitute_pairs 키 중복 | 0 | PRIMARY KEY 위반 0건 |
| score_final NOT NULL | 필수 | NULL 행 0건 |
| match_type 값 | 5가지 값만 | CHECK constraint 위반 0건 |
| 표본 대조 | 100건 수동 확인 | 원본 파일과 일치 |
| **매칭방법별 건수** (B-03) | 고유 입력명 23,806건 | 완전일치 488건(2.05%) / 포함일치 11,764건(49.42%) / 철자유사 295건(1.24%) / 동의어 35건(0.15%) / 미매칭 11,224건(47.15%) — 전체 매칭 성공률 52.85% |
| 전체 매칭 성공률 기록 | 12,582 / 23,806 | 52.85% — 완전일치율이 아닌 5가지 방법의 합산 성공률임 |
| 미매칭을 partial-match로 표시 금지 | — | 미매칭(47.15%)은 "후보 없음" 상태로만 표시 |
| 영양값 단위 | 100g 기준 | NULL 포함 허용, 단위 필드 표시 확인 |

## 5. 보안·비밀·원본보호 시험

| 항목 | 시험 방법 | 합격 조건 |
|---|---|---|
| service-role 키 노출 | 브라우저 Network 탭 검사 | 미노출 |
| SQL·테이블명 노출 | 오류 응답 body 검사 | 미노출 |
| 대표자 개인정보 | API 응답 필드 확인 | 미포함 |
| 원본 Git 변경 | git diff --stat (레거시 저장소) | 0건 |
| 신규 Supabase 대상 | 프로젝트 ID glczrbadvfgmblmkpgfj 확인 | 레거시와 다른 ID |
| anon 키 RLS | anon 역할로 SELECT/INSERT/UPDATE/DELETE 시도 | SELECT만 허용 |
| 내부 stack trace | 503 오류 응답 확인 | stack 미노출 |

## 6. 웹 품질 시험 (390px·1440px)

| 항목 | 방법 | 합격 조건 |
|---|---|---|
| npm run lint | 터미널 실행 | 오류 0건 |
| npm run build | 터미널 실행 | 빌드 성공, TypeScript 오류 0건 |
| 390px 가로 넘침 | Chrome DevTools 390px | 가로 스크롤 없음 |
| 390px 텍스트 클리핑 | 동일 | 클리핑 없음, ellipsis 적절 |
| 1440px 레이아웃 | DevTools 1440px | 2패널 정상 렌더링 |
| 키보드 네비게이션 | Tab 키 순회 | 모든 인터랙티브 요소 접근 가능 |
| 포커스 인디케이터 | 시각 확인 | 2px outline, 대비 3:1 이상 |
| 컬러 대비 | 색상 검사 도구 | WCAG AA (4.5:1 이상) |
| 직접 URL 접근 | /facilities/[id] 직접 입력 | 정상 렌더링 |
| 새로고침 | F5 / Ctrl+R | 현재 상태 유지 또는 정상 재로드 |
| 404 처리 | /facilities/없는ID | 404 not-found 상태 |
| 브라우저 콘솔 오류 | Console 탭 확인 | JS 오류 0건 |
| 페이지 오류 | Network 탭 확인 | 5xx 오류 0건 (정상 흐름) |

## 7. 성능·안정성 (진단 참고 — 인수 합격기준 아님) (B-09)

역사적 TIPS 성능 수치는 과거 로컬 환경 측정값이다. 신규 웹 서비스는 별도 측정하며, 아래 수치는 계약 합격기준이 아닌 진단 목표이다. 외부 시험기관, 과거 TIPS 수치 재달성, 부하시험은 현재 인수기준에 포함하지 않는다.

| 측정 항목 | 측정 방법 | 진단 목표 (참고) |
|---|---|---|
| 시설 검색 응답 시간 | Vercel Analytics 또는 Network 탭 | 진단 참고값 (계약 기준 아님) |
| 페이지 로드 (LCP) | Lighthouse | 진단 참고값 (계약 기준 아님) |
| 대체 식재료 쿼리 응답 | Network 탭 | 진단 참고값 (계약 기준 아님) |
| Supabase 쿼리 계획 | EXPLAIN ANALYZE | 인덱스 스캔 확인 (병목 식별용) |

## 8. 인수·증빙

| 단계 | 담당 | 판정자 | 증빙 파일명 |
|---|---|---|---|
| 자체 QA | Claude Code + MoAI | — | docs/qa/self-qa-evidence.md |
| 발주자 UAT | 발주자 | 발주자 | docs/qa/uat-sign-off.md |
| 중대결함 기준 | FG_DATA_UNAVAILABLE 반복·개인정보 노출·서비스 불가 | 발주자+개발사 | — |
| 배포 증빙 | Vercel 배포 URL·커밋 SHA | 발주자 | docs/qa/deployment-evidence.md |
| 소스·DB·문서 인계 | Git 저장소·Supabase 관리자 권한·설계문서 | 발주자 | docs/qa/handoff-checklist.md |

## 2.11 보류 요구사항 (46건)

DOC-07 v0.7 기준 보류 상태의 46건은 현재 인수 대상에 포함하지 않는다. 구현 객체를 생성하지 않으며, 테스트 커버리지 대상에서 제외한다.

이 중 이전 설계서에서 현재 범위로 잘못 연결된 4건은 DOC-07 v0.7 정식명으로 보류 처리한다 (B-04, B-18):

| 요구사항 ID | DOC-07 v0.7 정식명 | 보류 사유 |
|---|---|---|
| FG-FUN-031 | 후보 저장·재조회 | 보류 — no-candidate 상태는 FG-NFR-002로 통합 처리 |
| FG-FUN-042 | 데이터·서비스 상태 조회 | 보류 — DOC-07 v0.7 보류 요구사항, 현재 범위 외 |
| FG-FUN-044 | 기존 배치 알림 | 보류 — DOC-07 v0.7 보류 요구사항, 현재 범위 외 |
| FG-FUN-060 | 게시물·문의 처리현황 | 보류 — DOC-07 v0.7 보류 요구사항, 현재 범위 외 |

## 완료 확인

- [x] 승인 56건·조건부 4건 전건 추적표 작성 — DOC-07 v0.7 정식 요구사항명으로 60건 전건 기재 (B-10)
- [x] FG-FUN-006·007 (제품 검색·상세 후속 — 보류) 승인 행에서 제거 (B-10)
- [x] FG-FUN-032~035 공동제조 핵심범위 정식 요구사항명(매칭조건 입력·후보 필터·순위·일치·미충족 근거·제조업체 상세 연결)으로 복원 (B-11)
- [x] FG-FUN-042·044·060 보류 처리 — 잘못된 기능 설명 제거 (B-11)
- [x] 52.85% = 전체 매칭 성공률, 방법별 5건 건수 대조 기준 (B-03)
- [x] 성능 수치: 진단 참고 목표, 계약 합격기준 아님 명시 (B-09)
- [x] 보류 46건 (FG-FUN-031·042·044·060 DOC-07 v0.7 정식명 반영 포함) 인수 대상 제외 명시 (B-18)
- [x] 상태·데이터·보안·반응형 시험 정의
- [x] UAT·중대결함·인계 판정 기준 정의
- [x] 390px·1440px 시험 항목 명시
