# CHG-G6-002 G5 릴리스 후보 감사

- 감사일: 2026-08-31
- 최신 갱신: 2026-09-01
- 감사 대상: `codex/chg-g6-002-vs-i-preview`
- 사용자 승인 기준: VS-I Preview UAT 승인
- 판정: **감사 완료 / 릴리스 후보 확정 보류**

## 1. 결론

VS-I 구현과 공식 Supabase 읽기 경계는 현재 코드 기준으로 재검증을 통과했다. 그러나 G5 릴리스 후보로 확정하거나 `main` 병합·Production 배포를 진행할 수 있는 상태는 아니다.

차단 원인은 다음 두 가지다.

1. PR #3의 base인 `codex/chg-g6-001-g4-vs-01-preview`를 `main`으로 연결하는 PR이 없다.
2. G5 필수 산출물 DOC-14·TEC-05·TEC-06·TEC-07·TEC-08·TEC-09는 2026-08-31 검토본으로 작성됐지만 기술검토·발주자 승인이 남았고, DOC-13의 기존 사용자 QA 54건도 미시험 상태다.

따라서 이번 감사의 상태는 `G5_RC_AUDIT_COMPLETE / RELEASE_CANDIDATE_BLOCKED`로 기록한다.

## 2. 변경 계보 감사

| 구간 | 커밋 | 변경 파일 | 원격 상태 |
|---|---:|---:|---|
| `origin/main` → `origin/codex/vs6-closeout` | 2 | 20 | PR #2 open |
| `origin/codex/vs6-closeout` → `origin/codex/chg-g6-001-g4-vs-01-preview` | 1 | 28 | main 연결 PR 없음 |
| `origin/codex/chg-g6-001-g4-vs-01-preview` → `origin/codex/chg-g6-002-vs-i-preview` | 1 | 112 | PR #3 open |
| 원격 VS-I head → 로컬 HEAD | 1 | 2 | 로컬 문서 증빙 커밋, 원격 미반영 |

현재 확인된 PR은 다음과 같다.

| PR | base ← head | 상태 | 판정 |
|---|---|---|---|
| #1 | `main` ← `codex/g1-baseline` | merged | 기존 Production 기준선 |
| #2 | `main` ← `codex/vs6-closeout` | open | VS-6 문서 마감 계층 |
| #3 | `codex/chg-g6-001-g4-vs-01-preview` ← `codex/chg-g6-002-vs-i-preview` | open | VS-I stacked PR |

PR #3은 자체 base에 대해서는 올바른 stacked PR이지만, 그 base를 `main`으로 연결하는 후속 경로가 없다. PR #2를 병합해도 G6-001 커밋 `91c435f`와 VS-I 커밋 `22aab01`은 `main`에 들어가지 않는다.

## 3. 코드·데이터 계약 재검증

| 게이트 | 결과 | 비고 |
|---|---|---|
| `npm run lint` | PASS | 0 errors, 기존 warning 5 |
| `npx tsc --noEmit` | PASS | 오류 0 |
| `npm run build` | PASS | 최초 감사 당시 Next.js 16.2.4; 현재 패치·재검증 결과는 11절 참조 |
| G6 데이터 패키지 단위테스트 | PASS | 109/109 |
| G6 dry-run validator | PASS | 0 errors |
| `git diff --check` | PASS | 오류 0, Windows line-ending 경고만 존재 |
| VS-I Playwright | PASS | 24개 시나리오 × desktop/mobile = 48/48 |

Playwright는 1440×1000과 390×844에서 제품 목록·상세, 시설 제품, HACCP 필터, 제조후보, 오류 계약, 개인정보 비노출, 페이지네이션, 반응형, 김치 전문검색, 예상건수 표시, 카테고리 집계 경계를 실제 공식 Supabase anon 읽기로 확인했다.

최초 샌드박스 실행은 외부 네트워크가 차단되어 Supabase 조회가 실패했다. 동일 빌드의 서버만 네트워크 허용 환경에서 다시 실행한 결과 48건 전부 통과했으므로 애플리케이션 회귀 실패로 판정하지 않는다. Supabase·Git·Vercel에는 쓰기 작업을 수행하지 않았다.

## 4. G5 필수 산출물 감사

| 산출물 | 현재 상태 | G5 조치 |
|---|---|---|
| DOC-13 시험계획·QA·UAT 목록 v0.4 | VS-I UAT 18건 승인 | 기존 사용자 QA 54건 별도 실행 필요 |
| DOC-14 시험결과·결함조치표 v0.1 | 검토본 작성·21개 XLSX 시트 전수 렌더링 중 해당 4개 시트 확인 | 자동회귀 PASS와 사용자 QA 54건·복구시험·PR 계보 차단을 분리 기록, 발주자 검토 필요 |
| TEC-05 Migration·배포·롤백기록 v0.1 | 검토본 작성·4개 시트 QA 완료 | migrations 0028~0036, Approval A~C, 자동 롤백 2건, 성공 게시 후 실제 롤백 미실행을 구분 기록 |
| TEC-06 오픈소스·라이선스목록 v0.1 | 검토본 작성·4개 시트 QA 완료 | 직접 의존성·override 18종과 현재 npm audit 7건(high 6, low 1) 기록, 패치 승인 필요 |
| TEC-07 개인정보·보안점검표 v0.1 | 검토본 작성·4개 시트 QA 완료 | RLS·ACL·private/staging 차단·비밀정보·입력·XSS·의존성 경계 기록 |
| TEC-08 성능점검결과 v0.1 | 검토본 작성·5개 시트 QA 완료 | 로컬 10회 p50/p95와 공식 Supabase 쿼리 측정을 SLA·TIPS 지표와 분리 기록 |
| TEC-09 데이터백업·복구확인서 v0.1 | 검토본 작성·DOCX 구조검사·3쪽 대체 렌더링 QA 완료 | 예약 물리백업 7건 존재와 실제 복구시험 미실행을 구분. 기술검토·격리 복구시험 필요 |
| TEC-12 릴리스노트 v0.2 | 내용 노후 | UAT 승인과 G5 보류 상태를 반영한 v0.3 필요 |

## 5. 릴리스 차단사항

| ID | 중요도 | 차단사항 | 해제 조건 |
|---|---|---|---|
| RC-B01 | Critical | G6-001 base 브랜치의 main 연결 PR 부재 | 선행 변경을 별도 PR로 만들거나 승인된 통합 RC 브랜치로 계보 재구성 |
| RC-B02 | High | DOC-14·TEC-05·06·07·08·09 검토·승인 미완 | v0.1 검토본 6종은 작성·렌더링·등록대장 반영 완료. 기술검토·발주자 승인 필요 |
| RC-B03 | High | 기존 사용자 QA 54건 미시험 | 범위 재분류 후 필수 항목 실행·판정 |
| RC-B04 | High | 로컬 HEAD `0a84b6f`와 UAT 승인 기록이 원격 PR head에 없음 | 승인된 문서 전용 커밋으로 포함 여부 감사 후 반영 |
| RC-B05 | Medium | TEC-12 v0.2가 UAT 부적합 상태를 유지 | 새 리비전으로 현재 상태 교정 |

## 6. 권고 병합 순서

아래는 실행안이며 이번 감사에서는 수행하지 않는다.

1. 작성된 DOC-14·TEC-05·TEC-06·TEC-07·TEC-08·TEC-09 v0.1과 TEC-12 v0.3을 기술검토·발주자 검토해 승인 또는 보완한다.
2. 기존 사용자 QA 54건을 현재 승인 범위에 맞게 필수·조건부·비대상으로 재분류하고 필수 항목을 실행한다.
3. `origin/main`에서 별도 릴리스 후보 브랜치를 만들고 `210d7bf` → `91c435f` → `22aab01`의 포함 범위를 검토 가능한 커밋 순서로 재구성한다.
4. UAT 승인·G5 문서 증빙을 별도 문서 커밋으로 추가한다.
5. 정확한 RC SHA에서 lint·typecheck·build·109 단위테스트·dry-run·Playwright를 다시 실행한다.
6. Preview를 RC SHA로 생성해 최종 스모크 검증한다.
7. 별도의 merge 승인 후에만 `main`을 변경한다.
8. 별도의 Production 승인 후에만 운영 배포한다.

## 7. 변경 금지 확인

- `main` merge·push: 미실행
- Vercel Production·환경변수 변경: 미실행
- Supabase DDL·DML·migration·게시 재실행: 미실행
- 기존 `wavenvibe/foodground`, `foodground.vercel.app`, 기존 Supabase 쓰기: 미실행
- 개인 `.claude/settings.local.json`: 미접촉

## 8. 폐기된 Claude Code 초안 — 60건 요구사항 대조표 (판정 근거로 사용 금지)

> 이 절은 야간 자동 감사에서 `DOC-13 사용자 QA 54건`과 `요구사항 추적표 60건`을 잘못 혼용한 초안이다. 아래 표와 집계는 G5 판정·UAT 완료율·승인 근거로 사용하지 않는다. 권위 있는 정정 결과는 10절을 따른다.

<details>
<summary>폐기된 오류 초안 원문 보기 — 일반 검토에서는 펼치지 않음</summary>

2026-09-01 야간 감사에서 `06-qa-acceptance-trace.md`의 60건 추적 대상(승인 56 + 조건부 4)을 기존 Playwright 9개 스펙 파일 + 신규 `g5-qa-reconciliation.spec.ts`의 자동화 증거에 대조한 결과다.

### 분류 기준

| 분류 | 의미 |
|---|---|
| `automated-evidence-present` | 기존 또는 신규 Playwright 스펙으로 자동 검증 가능 |
| `required-manual` | 수동 또는 외부 도구 시험 필요 (DB 콘솔, Lighthouse, Vercel 대시보드 등) |
| `conditional-not-applicable` | 조건부 요구사항으로 활성화 조건(사용자 법령자료 제공) 미충족 시 해당 없음 |
| `blocked` | 선행 조건(Production 배포, 격리 복구 등) 미충족으로 현재 시험 불가 |

### 8.1 기능 요구사항 (20건 승인)

| ID | 요구사항명 | 분류 | 자동화 증거 |
|---|---|---|---|
| FG-FUN-001 | 공통 내비게이션 | automated-evidence-present | vs4-live `header navigation links`; g5-qa `FG-NFR-003 keyboard focus` |
| FG-FUN-002 | 제조업체 키워드 검색 | automated-evidence-present | vs5-live `facility keyword search`; vs6-integration `facility search` |
| FG-FUN-003 | 제조업체 조건 필터 | automated-evidence-present | vs5-live `facility filter`; vs6-integration `facility filter` |
| FG-FUN-004 | 검색 정렬·초기화 | automated-evidence-present | g5-qa `FG-FUN-004 stable ordering with tie-breaker` |
| FG-FUN-005 | 제조업체 상세정보 | automated-evidence-present | vs5-live `facility detail`; vs-i `facility products` |
| FG-FUN-008 | 레시피 검색·분류 | automated-evidence-present | vs4-live `recipes page`; g4-core-flow `recipe detail` |
| FG-FUN-009 | 레시피 재료·조리정보 | automated-evidence-present | g4-core-flow `recipe detail`; g5-qa `FG-NFR-002 nonexistent recipe not-found` |
| FG-FUN-010 | 식재료 표준명·동의어 검색 | automated-evidence-present | vs4-live `ingredients page`; g4-core-flow `ingredient search` |
| FG-FUN-011 | 식재료 상세정보 | automated-evidence-present | g4-core-flow `ingredient detail`; g5-qa `FG-NFR-002 nonexistent ingredient not-found` |
| FG-FUN-012 | 안정적 페이지네이션 | automated-evidence-present | g5-qa `FG-FUN-012 page size capped at 50`; g5-qa `FG-FUN-012 last page hasMore=false`; vs-i `pagination` |
| FG-FUN-026 | 기준 식재료 검색·선택 | automated-evidence-present | vs4-live `substitutes search`; g4-core-flow `substitute search` |
| FG-FUN-027 | 추천 조건 입력 | automated-evidence-present | vs4-live `substitutes`; g4-core-flow `substitute` |
| FG-FUN-028 | 사전산출 후보 조회·순위 | automated-evidence-present | g4-core-flow `substitute candidates ranked` |
| FG-FUN-029 | 후보 영양·지표 비교 | automated-evidence-present | g5-qa `FG-FUN-029 substitute 6 similarity metrics` |
| FG-FUN-030 | 추천 근거·한계 표시 | automated-evidence-present | g5-qa `FG-FUN-030 match-type badge and disclaimer` |
| FG-FUN-032 | 매칭조건 입력 | automated-evidence-present | vs5-live `facility filter`; vs-c `manufacturing candidates` |
| FG-FUN-033 | 후보 필터·순위 | automated-evidence-present | vs-c `manufacturing candidates 308`; vs5-live `facility filter` |
| FG-FUN-034 | 일치·미충족 근거 | automated-evidence-present | vs-c `manufacturing match evidence`; vs5-live `facility detail` |
| FG-FUN-035 | 제조업체 상세 연결 | automated-evidence-present | g4-core-flow `facility detail navigation`; vs-d `context flow` |
| FG-FUN-059 | 브라우저 메일초안·복사 | automated-evidence-present | vs5-live `ContactButton copy`; g4-core-flow `inquiry clipboard` |

### 8.2 조건부 기능 요구사항 (4건)

| ID | 요구사항명 | 분류 | 비고 |
|---|---|---|---|
| FG-FUN-037 | 법령·FAQ 키워드 검색 | conditional-not-applicable | 사용자 법령자료 미제공 — /label-guide 비노출 상태 |
| FG-FUN-040 | 기준·면책·전문가 확인 | conditional-not-applicable | 동일 |
| FG-FUN-049 | 승인 자료 검색·FAQ | conditional-not-applicable | 동일 |
| FG-FUN-051 | 안내·출처 구분 | conditional-not-applicable | 동일 |

### 8.3 데이터 요구사항 (10건)

| ID | 요구사항명 | 분류 | 자동화 증거 / 비고 |
|---|---|---|---|
| FG-DAT-001 | 마스터 데이터 기준선 | required-manual | DB COUNT 직접 확인 필요. Approval A~C 적재 증빙 존재 |
| FG-DAT-003 | 공개 기본조회 규칙 | automated-evidence-present | vs6-integration `anon RLS`; vs-i `private columns excluded` |
| FG-DAT-004 | 출처·기준일·버전 | required-manual | private.data_lineage DB 직접 확인. Approval B lineage 증빙 존재 |
| FG-DAT-005 | 레시피 제목 충돌 보존 | required-manual | DB 직접 확인 필요. 적재 스크립트 검증 증빙 존재 |
| FG-DAT-006 | 식재료 표준명·동의어 | automated-evidence-present | g4-core-flow `ingredient synonym`; vs4-live `ingredients` |
| FG-DAT-007 | 이상 날짜·상태 격리 | required-manual | 적재 스크립트 dry-run 109건 PASS 증빙 존재 |
| FG-DAT-008 | 필수값 결측 격리 | required-manual | 동일 dry-run validator 증빙 |
| FG-DAT-009 | 현재범위 경량 적재원칙 | required-manual | Approval A~C 범위 감사 증빙 존재 |
| FG-DAT-010 | 안정 정렬키 | automated-evidence-present | g5-qa `FG-FUN-004 stable ordering`; vs-i `pagination stable order` |
| FG-DAT-011 | 조회결과·규칙버전 계보 | required-manual | private.data_lineage DB 직접 확인. Approval B 증빙 존재 |

### 8.4 보안 요구사항 (6건)

| ID | 요구사항명 | 분류 | 자동화 증거 |
|---|---|---|---|
| FG-SEC-001 | 원본 자산 무변경 | required-manual | 레거시 저장소 git diff 수동 확인 필요 |
| FG-SEC-002 | 신규 공식환경 전용 개발 | required-manual | Supabase 프로젝트 ID 수동 확인. Approval A 증빙 존재 |
| FG-SEC-003 | 환경변수·키 분리 | automated-evidence-present | vs6-integration `service-role key not exposed`; .gitignore 확인 |
| FG-SEC-004 | 공개 필드 최소화 | automated-evidence-present | vs-i `private columns`; g5-qa `FG-SEC-004 recipes/ingredients API` |
| FG-SEC-009 | 로그·오류 비밀정보 제거 | automated-evidence-present | g5-qa `FG-SEC-009 error response no SQL/stack`; vs-i `FG error codes` |
| FG-SEC-010 | 공개 조회권한·비밀정보 음성시험 | automated-evidence-present | vs6-integration `anon RLS negative test` |

### 8.5 비기능 요구사항 (10건)

| ID | 요구사항명 | 분류 | 자동화 증거 / 비고 |
|---|---|---|---|
| FG-NFR-001 | 모바일·PC 반응형 | automated-evidence-present | vs-i `responsive 390/1440`; g5-qa `FG-NFR-001 /recipes /ingredients /substitutes 390px` |
| FG-NFR-002 | 로딩·빈 결과·오류·사용불가 | automated-evidence-present | g5-qa `FG-NFR-002 empty search / nonexistent recipe / ingredient` |
| FG-NFR-003 | 키보드·레이블·대비 | automated-evidence-present | g5-qa `FG-NFR-003 keyboard focusable with visible indicator` |
| FG-NFR-004 | 직접 URL·새로고침·404 회귀 | automated-evidence-present | g5-qa `FG-NFR-004 /facilities /recipes /ingredients /substitutes + 404` |
| FG-NFR-005 | 쿼리·응답 성능 | required-manual | EXPLAIN ANALYZE DB 직접 확인 필요. TEC-08 증빙 존재 |
| FG-NFR-006 | 신규 웹 주요화면 응답성능 | required-manual | Lighthouse/Vercel Analytics 측정 필요. TEC-08 로컬 p50/p95 존재 |
| FG-NFR-007 | 안정화기간 가용성 검증 | blocked | Production 미배포 — 안정화기간 시험 불가 |
| FG-NFR-008 | 빌드·정적검사 | automated-evidence-present | 섹션 3 lint/typecheck/build PASS |
| FG-NFR-009 | 출시차단 결함 | required-manual | 통합 QA + 사용자 UAT 완료 후 판정 |
| FG-NFR-010 | 빈 기능·가짜 화면 금지 | automated-evidence-present | vs-i `real Supabase data` 24개 시나리오 실데이터 확인 |

### 8.6 운영 요구사항 (10건)

| ID | 요구사항명 | 분류 | 비고 |
|---|---|---|---|
| FG-OPS-001 | 신규 DB 변경승인 | required-manual | Approval A/B/C 기록 존재. 문서 승인 필요 |
| FG-OPS-002 | 변경 전 백업 | required-manual | 물리백업 7건 존재. TEC-09 증빙 |
| FG-OPS-003 | migration·배포 롤백 | required-manual | rollback SQL 존재. TEC-05 증빙. 실제 복구시험 미실행 |
| FG-OPS-004 | 원본과 신규 배포분리 | required-manual | 환경 분리 확인. Approval A 증빙 |
| FG-OPS-005 | 상태·오류 추적 | blocked | Production 미배포 — 모니터링 설정 확인 불가 |
| FG-OPS-006 | 소스·계정·환경 인계 | blocked | 인계 미실행 — G6 완료 후 |
| FG-OPS-007 | 오픈소스·데이터 출처 | required-manual | TEC-06 라이선스목록 v0.1 검토본 존재 |
| FG-OPS-008 | 추가 현금지출 0원 | required-manual | Supabase nano + Vercel 무료 확인 필요 |
| FG-OPS-009 | 요구사항 전 과정 추적 | automated-evidence-present | 이 대조표 자체가 60건 전건 추적 증빙 |
| FG-OPS-010 | UAT·배포·완료판정 | required-manual | UAT 18건 승인됨. 전체 54건 사용자 QA 미완 |

### 8.7 대조 집계

| 분류 | 건수 | 비율 |
|---|---|---|
| automated-evidence-present | 34 | 56.7% |
| required-manual | 19 | 31.7% |
| conditional-not-applicable | 4 | 6.7% |
| blocked | 3 | 5.0% |
| **총계** | **60** | **100%** |

**자동화 커버리지(폐기 초안 내부 정정값)**: 추적 대상 60건 중 34건(56.7%)이 기존 + 신규 Playwright 스펙으로 자동 검증 가능하다.

### 8.8 신규 Playwright 스펙

`e2e/g5-qa-reconciliation.spec.ts` — 22개 테스트 케이스 추가.

| 대상 요구사항 | 테스트 수 | 내용 |
|---|---|---|
| FG-FUN-004 | 1 | 정렬 안정성·tie-breaker |
| FG-FUN-012 | 2 | pageSize 50 상한, hasMore=false 경계 |
| FG-FUN-029 | 1 | 6개 유사도 지표 표시 |
| FG-FUN-030 | 1 | 매칭방법 배지 5종 + 면책고지 |
| FG-NFR-001 | 3 | /recipes /ingredients /substitutes 390px 가로 넘침 |
| FG-NFR-002 | 3 | 빈 검색·존재하지 않는 recipe·ingredient not-found |
| FG-NFR-003 | 1 | 키보드 Tab 포커스 인디케이터 |
| FG-NFR-004 | 5 | /facilities /recipes /ingredients /substitutes 직접 URL + 404 |
| FG-SEC-004 | 2 | recipes·ingredients API 비공개 컬럼 미포함 |
| FG-SEC-009 | 1 | 오류 응답 SQL/stack trace/Supabase URL 미노출 |

### 8.9 남은 수동 시험 항목

아래 항목은 자동화 대상이 아니며 별도 수동 시험이 필요하다.

1. **FG-DAT-001/004/005/007/008/009/011** — DB 콘솔 COUNT, lineage, 적재 검증
2. **FG-SEC-001/002** — 레거시 저장소 무변경·신규 프로젝트 ID 확인
3. **FG-NFR-005/006** — EXPLAIN ANALYZE, Lighthouse 측정
4. **FG-NFR-009** — 통합 QA 후 출시차단 결함 판정
5. **FG-OPS-001~004/007/008/010** — 승인 기록·백업·롤백·라이선스·비용·UAT 사인오프

### 8.10 야간 감사 실행 결과

#### 실행 가능했던 검증

| 검증 | 명령 | 결과 |
|---|---|---|
| git diff --check | `git diff --check` | PASS (오류 0, CRLF 경고만) |
| 신규 스펙 파일 생성 | `e2e/g5-qa-reconciliation.spec.ts` | 22개 테스트 작성 완료 |

#### 샌드박스 제한으로 실행 불가했던 검증

| 검증 | 차단 원인 |
|---|---|
| `npm run lint` | 샌드박스 npm 실행 승인 미부여 |
| `npx tsc --noEmit` | 동일 |
| `npm run build` | 동일 |
| `npx playwright test` | 동일 |
| G6 단위테스트 109건 | 동일 |

이 검증은 사용자가 다음 세션에서 직접 실행하거나 승인된 환경에서 재실행해야 한다.

## 9. 폐기 초안의 판정 기록

**G5 릴리스 후보 감사와 필수 산출물 6종의 검토본 작성은 완료했다. 코드 품질과 VS-I 런타임 회귀는 통과했지만, PR 계보·문서 승인·기존 사용자 QA 54건·실제 복구시험 공백 때문에 릴리스 후보 확정은 보류한다.**

**2026-09-01 야간 추가 감사(폐기 기록)**: 요구사항 추적표 60건 중 자동화 34건, 수동 19건, 조건부 4건, 차단 3건으로 산술 정정했다. 이 분류는 DOC-13 사용자 QA 54건의 완료율이나 승인 근거로 사용하지 않는다.

</details>

## 10. 권위 있는 정정 — DOC-13 사용자 QA 54건

### 10.1 범위와 승인 경계

- 권위 원본은 `DOC-13_시험계획_QA_UAT목록_v0.4.xlsx`의 `사용자_QA` 시트 UAT-001~054이다.
- UAT-055~072의 VS-I Preview UAT 18건 승인 기록은 별도 범위이며 UAT-001~054를 대체하지 않는다.
- 자동화 회귀 증거가 있어도 사용자 결과·재검증 결과·최종판정은 자동 승인하지 않는다.
- 따라서 현재 UAT-001~054의 발주자 판정은 **미시험 54건 / 승인 0건**으로 유지한다.

### 10.2 누락 없는 54건 분류

| 분류 | 시험 ID | 건수 | 처리 원칙 |
|---|---|---:|---|
| 자동화 증거 연결 대상 | UAT-001~047, UAT-051~053 | 50 | Playwright·API·정적검사 결과를 개발자 증거로 연결하되 사용자 판정은 미시험 유지 |
| 실제 사용자·외부 핸들러 확인 필요 | UAT-048~050, UAT-054 | 4 | 클립보드 권한거부 대안, 실제 `tel:` 처리, 외부 홈페이지 열기, 기존 운영 서비스 보존을 사람이 확인 |
| **합계** | **UAT-001~054 전건** | **54** | 중복·누락 없음 |

### 10.3 화면군별 자동화 증거 연결 계획

| 화면군 | 시험 ID | 건수 | 주 증거 |
|---|---|---:|---|
| 공통·반응형·직접 URL | UAT-001~008 | 8 | 기존 VS-4/VS-6/VS-I + `g5-qa-reconciliation.spec.ts` |
| 레시피 | UAT-009~015 | 7 | 기존 core-flow/VS-6 + 목록·빈 페이지·404 회귀 |
| 식재료 | UAT-016~021 | 6 | 기존 core-flow/VS-6 + 목록·404 회귀 |
| 대체 식재료 | UAT-022~033 | 12 | 기존 VS-4 + 정확한 `ingredient=` 쿼리, 6개 meter, 영양표, 점수 내림차순 단언 |
| 제조시설 | UAT-034~046 | 13 | 기존 VS-5/VS-I + 필터·상세·보안·페이지네이션 |
| 문의·보안·범위 | UAT-047, UAT-051~053 | 4 | 복사 성공, 공개 필드 allowlist, 오류 비밀정보 미노출, 미구현 메뉴 미노출 |
| 수동 확인 | UAT-048~050, UAT-054 | 4 | 브라우저 권한·OS 핸들러·외부 사이트·기존 운영 URL |

### 10.4 정정된 현재 판정

G5는 자동화 증거 보강과 보안 패치·회귀검증을 진행할 수 있으나, 사용자 QA 54건은 아직 완료되지 않았다. 로컬 검증 통과는 `개발자 사전검증`이며 발주자 UAT 승인이나 릴리스 승인으로 해석하지 않는다.

## 11. 2026-09-01 로컬 보강 실행 결과

### 11.1 코드·보안 조치

| 항목 | 조치 전 | 조치 후 | 판정 |
|---|---:|---:|---|
| Next.js | 16.2.4 | 16.3.3 exact pin | 패치 완료 |
| `npm audit` | high 6, low 1 | 0 vulnerabilities | PASS |
| `ws` override | 8.21.3 | 8.21.3 | 단일 안전 버전 유지 |
| 목록 마지막 페이지 | PostgREST `PGRST103`을 503으로 변환 | 레시피·식재료·시설 모두 빈 목록 200 + 정확한 total 반환 | 결함 수정 |

### 11.2 자동검증

| 검증 | 결과 |
|---|---|
| `npm run lint` | PASS, 오류 0·기존/보조파일 warning 6 |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS, Next.js 16.3.3 production build |
| G6 데이터 패키지 단위시험 | PASS, 109/109 |
| G6 dry-run validator | PASS, 0 errors |
| `g5-qa-reconciliation.spec.ts` | PASS, desktop/mobile 42/42 |
| `chg-g6-002-vs-i.spec.ts` | PASS, desktop/mobile 48/48 |
| VS-4·VS-5·VS-6 기존 회귀 | PASS 126, viewport 조건 skip 30 |
| Claude Code 독립 정적 리뷰 | P0 0, P1 1 발견·조치(폐기 초안 산술 및 가시성 정정), P2 5 검토 |

Playwright 보강 스펙은 잘못된 `q=` 쿼리를 실제 계약인 `ingredient=`로 교정했고, 첫 후보의 접근성 `meter` 6개 라벨·영양표·종합점수 내림차순을 정확히 단언한다. 첫 실행에서 발견된 마지막 페이지 503은 애플리케이션 코드를 수정한 뒤 재검증했다.

### 11.3 변경·승인 경계

- Supabase DDL·DML·migration·게시: 미실행
- Git add·commit·push·PR·merge: 미실행
- Vercel Preview·Production·환경변수 변경: 미실행
- 사용자 QA UAT-001~054: 자동 승인하지 않음, 미시험 54건 유지
- G5 RC 판정: 로컬 개발자 사전검증 강화 완료, 문서 승인·사용자 UAT·복구시험·PR 계보 해소 전까지 보류

## 12. 제품화 흐름·검토함 범위 교체 로컬 회귀

### 12.1 발주자 화면 피드백 반영

- 제품 검색은 제품명뿐 아니라 제조업체명도 해석한다. `웨이브앤바이브` 실데이터 검색은 직접 연결 제품 31건을 반환한다.
- 홈의 제품화 검토 흐름은 `제품 개발하기` 2단계와 `적정 제조공장 찾기` 3단계로 구분한다.
- 식재료 단독 사용자 화면은 제거하고 기존 `/ingredients`, `/ingredients/[id]`는 `/substitutes`로 안전 이동한다. 공개 API·DB 계약은 호환성을 위해 유지한다.
- 레시피·대체 식재료·제품·제조시설은 브라우저 검토함에 저장하며, 저장한 제조시설은 비교표에서 공개 근거를 나란히 확인한다.
- 제품 카드의 긴 분류 배지는 27px 높이를 유지하고 하단 정보 영역과 데스크톱 40px·모바일 8px 이상 분리한다.

### 12.2 자동검증 결과

| 검증 | 결과 |
|---|---|
| 신규 `g5-ux-scope-substitution.spec.ts` | 제품화 흐름·업체명 검색·배지·식재료 전환·검토함·모바일 접근성 PASS |
| `g4-core-flow.spec.ts` 교정 | 레시피에서 대체 식재료로 직접 연결되는 승인 흐름 PASS |
| `g5-qa-reconciliation.spec.ts` 교정 | 식재료 레거시 URL 전환·공개 API 호환성 PASS |
| 통합 Playwright 3종 | **70 passed / 20 viewport 조건 skip / 0 failed** |
| VS-4·VS-6 식재료 전환 집중회귀 | **8 passed / 0 failed** |
| 이번 보완 총계 | **78 passed / 20 viewport 조건 skip / 0 failed** |
| 실데이터 화면 | 1440×1000·390×844 가로 넘침 0, 배지 겹침 0, 페이지 오류 0 |
| 정적검사 | lint 0 errors·warning 6, typecheck PASS, production build PASS |

첫 시험에서 확인된 실패는 리다이렉트 대기와 접근성 이름, 시험용 localStorage 반복 초기화 문제였다. 기능 결함으로 오인하지 않고 시험 코드를 교정한 뒤 동일 범위를 재실행해 실패 0건을 확인했다.

### 12.3 승인·배포 경계

- 발주자는 화면 방향과 제품 카드 시각결함 수정 결과를 확인했다.
- 이 확인은 제품화 흐름 보완의 화면검토 근거이며, 기존 DOC-13 사용자 QA 54건 전체나 G5 릴리스·G6 최종 인수를 자동 승인하지 않는다.
- Supabase 쓰기, Git add·commit·push·PR·merge, Vercel Preview·Production 변경은 수행하지 않았다.

판정: **G5_UX_SCOPE_SUBSTITUTION_LOCAL_QA_PASS / USER_SCREEN_REVIEW_CONFIRMED / RELEASE_CANDIDATE_BLOCKED.**

## 13. 제품화 흐름 보완분 커밋 전 감사

### 13.1 감사 후보와 제외 경계

| 구분 | 파일 수 | 처리 |
|---|---:|---|
| 앱·라이브러리·테스트·QA 문서 | 32 | 다음 Git 승인 시 반영 가능한 감사 후보 |
| `.claude/settings.local.json` | 1 | 개인 로컬 설정이므로 제외 |
| `.moai/project/current-slice.md` | 1 | 선행 G5 문서·복구·계보 상태를 포함하므로 이번 기능 커밋과 분리 |
| VS-I Preview UAT 승인 기록 | 1 | 선행 승인 증거로 별도 보존하며 이번 기능 커밋에 자동 혼입하지 않음 |

- 후보 파일의 비밀값 패턴 검사는 0건이다. 테스트에 포함된 `service_role` 문자열은 비공개 필드가 응답에 나타나지 않는지 확인하는 금지어 단언이다.
- `docs/HANDOFF.md`의 로컬 절대경로는 이번 변경 후보가 아니며 현재 커밋에 포함하지 않는다.
- `git diff --check`는 오류 0건이다. 출력된 LF→CRLF 안내는 작업환경 줄바꿈 경고이며 코드 무결성 오류가 아니다.
- 현재 브랜치는 `codex/chg-g6-002-vs-i-preview`이고, 원격 브랜치보다 로컬 커밋 1개가 앞서 있다. 따라서 향후 push 승인은 이 선행 커밋과 이번 후보의 동시 원격 반영을 의미한다.

### 13.2 감사 판정과 다음 승인점

판정: **PRECOMMIT_AUDIT_PASS_WITH_EXCLUSIONS / LOCAL_ONLY / PUSH_APPROVAL_REQUIRED.**

다음 외부 작업은 감사 후보만 별도 커밋한 뒤 기존 Preview 브랜치에 push하여 PR과 Vercel Preview를 갱신하는 것이다. 이 작업은 원격 상태를 바꾸므로 별도 사용자 승인 전 실행하지 않는다. `main`, Vercel Production, Supabase 데이터·스키마는 계속 변경 금지다.

## 14. D-009 스마트 HACCP 데이터 의미 교정

### 14.1 결함과 판정

현재 연결된 308건 원본은 전체 HACCP 인증업체 목록이 아니라 스마트 HACCP 등록업체 자료다. 기존 화면은 `is_haccp`를 `HACCP 인증`, `HACCP 미인증`으로 표시해 원본 범위보다 넓은 의미로 해석될 수 있었다.

- 참값은 `스마트 HACCP 등록`으로 표시한다.
- 거짓값은 일반 HACCP 미인증으로 단정하지 않고 `스마트 HACCP 연결정보 없음`으로 표시한다.
- URL·API·DB 호환성을 위해 `haccp=1`, `is_haccp` 내부 식별자는 유지한다.
- 전체 HACCP 인증 여부는 별도 전체 인증업체 원본을 수집·정합화하기 전까지 제공하지 않는다.

### 14.2 검증

| 검증 | 결과 |
|---|---|
| 오해 가능 레거시 UI 문구 | 0건 |
| lint / typecheck / production build | PASS |
| 읽기 전용 원본 제품·스마트 HACCP 필터 API | HTTP 200 |
| 제품·시설 연결 및 후보 근거 | PASS |
| 1440×1000·390×844 제품 화면 | 가로 넘침 0, 콘솔·페이지 오류 0 |
| 스마트 HACCP 집중 Playwright | 8/8 PASS |

판정: **SMART_HACCP_SEMANTIC_CORRECTION_LOCAL_QA_PASS / PREVIEW_UPDATE_PENDING / PRODUCTION_UNCHANGED.**

## 15. D-009 스마트 HACCP 교정분 커밋 전 감사

### 15.1 후보·제외 경계

| 구분 | 파일 수 | 처리 |
|---|---:|---|
| 앱·라이브러리·E2E | 27 | 스마트 HACCP 의미 교정 커밋 후보 |
| QA 문서 | 1 | 이 감사 기록을 포함한 커밋 후보 |
| `.claude/settings.local.json` | 1 | 개인 로컬 설정이므로 제외 |
| `.moai/project/current-slice.md` | 1 | 선행 게이트 상태를 포함하므로 제외 |
| VS-I Preview UAT 승인 기록 | 1 | 선행 승인 증거이며 이번 교정 커밋에서 제외 |

- 후보 합계는 **28개**이며 변경량은 문서 기록 전 기준 81 additions / 57 deletions다.
- 브랜치는 `codex/chg-g6-002-vs-i-preview`, HEAD와 upstream 차이는 `0 / 0`으로 확인했다.
- 비밀값 패턴과 개인 절대경로 검사는 후보 전체에서 각각 0건이다.
- 오해 가능 레거시 UI 문구는 런타임·시험 후보 27개에서 0건이다. QA 문서에는 결함의 과거 표현을 설명하는 기록만 남긴다.
- `git diff --check` 오류는 0건이다. LF→CRLF 안내는 작업환경 줄바꿈 경고이며 코드 오류가 아니다.

### 15.2 재검증

| 검증 | 결과 |
|---|---|
| ESLint | PASS — 오류 0, 기존·보조파일 경고 6 |
| TypeScript `--noEmit` | PASS |
| Next.js production build | PASS |
| `/api/products`·스마트 HACCP 필터 API | HTTP 200 |
| 제품·시설 연결 원본 집중 E2E | 2/2 PASS |
| 스마트 HACCP 필터·1440×1000·390×844 E2E | 6/6 PASS |
| 집중 회귀 합계 | **8/8 PASS** |

최초 재실행의 접속 거부는 기능 결함이 아니라 테스트 전용 `VSD_BASE_URL`이 이전 로컬 포트 3013을 가리킨 설정 오류였다. 검증 서버 3018로 `PLAYWRIGHT_BASE_URL`과 `VSD_BASE_URL`을 함께 지정해 동일 6건을 재실행했고 전부 통과했다.

### 15.3 감사 판정

판정: **PRECOMMIT_AUDIT_PASS_WITH_EXCLUSIONS / LOCAL_ONLY / PUSH_APPROVAL_REQUIRED.**

Git add·commit·push·PR 갱신, Vercel Preview·Production, Supabase 변경은 수행하지 않았다. 다음 단계는 사용자 승인 후 위 28개 후보만 별도 커밋해 기존 Preview 브랜치에 push하고 PR·Vercel Preview를 갱신하는 것이다.
