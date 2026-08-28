# 09. G3-07 design review request

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002
- Approval status: PENDING USER

## 1. 검토 요청 요약

### 1.1 감사 핵심 결과

이번 G3-07 설계에서 확인된 핵심 사실은 다음과 같습니다.

| 항목 | 감사 결과 |
|---|---|
| 기존 분석 자산 | 234,955 대체 식재료 쌍, 69,406 레시피, 686 표준 식재료 — 이미 존재하는 사전계산 결과 |
| 런타임 마스터 | 제조시설 94,723건 / 레시피 70,165건 / 식재료 18,933건 (역사적 TIPS 10만4천건과 절대 혼용 금지) |
| 총 매칭 성공률 | 고유 입력명 23,806건 중 12,582건 매칭 성공 = **52.85%** (완전일치 488·포함일치 11,764·철자유사 295·동의어 35; 미매칭 11,224). 52.85%는 완전일치율이 아닌 전체 매칭 성공률임 |
| 시설 이메일 컬럼 | 원본 facility 테이블에 email 컬럼 없음 (감사 확인). 연락정보: tel + homepage만 존재. 기본 문의 방식은 문의문안 복사 (ContactButton) |
| Codex 프로토타입 | 17개 수정 파일 + 다수 미추적 파일 존재 → 동결 처리, G3 승인 후 선택적 병합 |
| 신규 Supabase | 프로젝트 ID `glczrbadvfgmblmkpgfj` 확인됨. 지역: Mumbai (ap-south-1), 상태: Healthy, 플랜: nano, 공개 테이블 0개 (B-05) |
| 환경 분리 | 기존 유료 Supabase, `wavenvibe/foodground`, `foodground.vercel.app`은 읽기 전용 참조 |

### 1.2 권고 아키텍처 요약

- **데이터**: 기존 `final_output/analysis_outputs/` 사전계산 결과를 신규 Supabase `glczrbadvfgmblmkpgfj`로 이관 (VS-2)
- **서버**: Next.js 16 App Router + Supabase anon 키 (공개 런타임 전용) / service-role 키는 VS-2 migration 전용 (공개 런타임 절대 사용 금지)
- **UI**: 제조시설·레시피·식재료 목록·상세, 대체 식재료 검색, 공동제조 조건 연동, mailto 초안
- **매칭 표시**: 5가지 매칭방법(완전·포함·철자·동의어·미매칭) 배지 의무화 + 면책고지 항상 표시
- **문의**: 원본 email 컬럼 없음 → ContactButton(문의문안 복사) 기본; tel·homepage 보조; 별도 승인 이메일 확보 시에만 mailto 활성화. "발송 완료" 표현 완전 금지

### 1.3 기존 가설에서 변경한 주요 항목

| 가설 (Codex 프로토타입) | 설계 결정 | 근거 |
|---|---|---|
| `/api/search/facilities` | `/api/facilities` (신규 설계) | API 구조 일관성 |
| 구 Supabase 연결 | 신규 프로젝트 `glczrbadvfgmblmkpgfj` 전용 | 환경 분리 원칙 |
| 클라이언트 직접 Supabase 쿼리 | API Route 경유 (공개 런타임 anon+RLS 전용) | 보안 |
| 이메일 표시 | 원본 테이블에 email 컬럼 없음 → ContactButton 복사 기본값 확정 (B-06) | 원본 데이터 감사 결과 |
| /label-guide 항상 노출 | 사용자 승인 자료 제공 시에만 활성화 | 미승인 법령 정보 위험 |

### 1.4 구현 순서 (요약)

VS-1 (감사·계약 확정, FG-DAT-001/003~011) → VS-2 (Supabase 적재, 사용자 원격 승인 3회, FG-OPS-001~010) → VS-3 (공개 탐색, FG-FUN-001~005·008~012·032~035·NFR-001~010) → VS-4 (대체 식재료 FG-FUN-026~030) → VS-5 (시설 상세·ContactButton FG-FUN-059) → VS-6 (QA·배포·인계)

> FG-FUN-031·042·044·060은 현재 범위 제외 (보류)

---

## 2. 범위 확인

| 범위 구분 | 항목 | 계약 정합성 |
|---|---|---|
| **현재 (20M KRW / 2.85 MM)** | 공개 시설·레시피·식재료 탐색 (VS-3) | ✅ 포함 |
| | 대체 식재료 추천 + 6개 지표 + 매칭 배지 (VS-4) | ✅ 포함 |
| | 시설 상세 + ContactButton 문의문안 복사 + tel/homepage 표시 (VS-5) | ✅ 포함 |
| | 브라우저 mailto 초안 (별도 승인 이메일 확보 시, VS-5) | ✅ 조건부 포함 |
| | FG-FUN-031(후보 저장·재조회)·FG-FUN-042(데이터·서비스 상태 조회)·FG-FUN-044(기존 배치 알림)·FG-FUN-060(게시물·문의 처리현황) | ❌ 보류 (DOC-07 v0.7 정식명) — 현재 범위 외 |
| | Supabase schema·migration·RLS (VS-2) | ✅ 포함 |
| | QA·보안·반응형·배포·인계 (VS-6) | ✅ 포함 |
| **조건부 (자료 제공 시)** | 법령안내 `/label-guide` 정적 검색·FAQ (VS-6) | ✅ 조건부 포함 |
| **후속 (현재 미포함)** | Auth·저장·프로젝트 관리 | ❌ 현재 범위 외 |
| | 제품 1,047,894건 전건 이관 | ❌ 현재 범위 외 |
| | OCR·RAG/LLM·Python Streamlit 서빙 | ❌ 현재 범위 외 |
| | 그룹 구매·비밀 문의·실시간 채팅 | ❌ 현재 범위 외 |
| | 역사적 TIPS 점수 재달성 | ❌ 별도 승인 필요 |

**계약 적합성**: 추가 현금지출 0원 / KRW 20,000,000 (VAT 포함) 범위 내 / 2.40-3.30 MM 계획 범위 내

---

## 3. 권고 결정과 대안

| 승인 ID | 쟁점 | 권고안 | 대안 | 비용·일정·품질 영향 | 미승인 시 안전한 기본값 |
|---|---|---|---|---|---|
| APPROVAL-01 | 공개 데이터 접근 방식 | RLS + anon 키 (PostgREST 직접 지원) | 공개 뷰 별도 생성 | 권고안 = 단순·빠름. 대안 = 민감 필드 통제 확실하나 추가 DDL 관리 필요 | RLS + anon 키 (기본) |
| APPROVAL-02 | 대체 식재료 쿼리 경로 | API Route 서버 경유 (공개 런타임: anon+RLS 전용; service-role은 VS-2 migration 전용) | 클라이언트 직접 Supabase 쿼리 | 권고안 = 보안 강화, 입력 sanitize 가능. 대안 = 구현 단순화하나 service-role 키 노출 위험 | API Route (기본) |
| APPROVAL-03 | 시설 연락정보 표시 방식 | **RESOLVED**: 원본 테이블에 email 컬럼 없음. ContactButton(문의문안 복사) 기본 + tel·homepage 보조. 별도 승인 이메일 소스 확보 시에만 mailto 활성화 | — | 원본 데이터 감사로 확정 (B-06) | ContactButton 복사 기본값 |
| APPROVAL-04 | partial-match 표시 방식 | "부분 일치" 배지 + 계보 고지 별도 표시 | 단일 결과로 합산 (구분 없음) | 권고안 = 52.85% 위험 투명 공시. 대안 = 사용자 혼동 위험 증가 | 배지 구분 표시 (기본) |
| APPROVAL-05 | /label-guide 활성화 조건 | 승인된 정적 자료 제공 시에만 활성화 | 자료 없어도 "준비 중" 표시 | 권고안 = 미승인 법령 위험 없음. 대안 = 빈 화면 노출, 사용자 오해 위험 | **비노출** (기본, Q-02 답변 필요) |
| APPROVAL-06 | 호환 경로 처리 | /b/[id] → /facilities/[id], /search → /facilities redirect | 기존 경로 동일 구현 유지 | 권고안 = 신규 라우트 구조 통일. 대안 = 코드 중복, 유지보수 부담 | redirect 처리 (기본) |
| APPROVAL-07 | 데이터 기준일 표시 | 화면에 "기준일: 2026-08-18" 항상 표시 | 숨김 | 권고안 = 사전계산 데이터 투명성 보장. 대안 = 사용자 신뢰 저하 가능 | 기준일 표시 (기본) |

---

## 4. 사용자 제공·확인 필요자료

### 4.1 데이터 이용권한 (Q-04 — 구현 선행 조건)

**질문**: `final_output/analysis_outputs/` 데이터를 신규 Supabase에 적재할 권한이 있습니까?

- 권고: 빅데이터 지원사업 계약 내 웹 서비스 목적 사용으로 판단되나 계약서 재확인 권고
- 미확인 시: VS-2 원격 실행 보류

### 4.2 시설 연락정보 (Q-01 — FG-FUN-059 mailto 활성화 조건)

**결론 (B-06)**: 원본 facility 테이블에 email 컬럼 없음 — ContactButton(문의문안 복사) + tel·homepage 조건부 표시가 기본값으로 확정됨.

**FG-FUN-059 mailto 활성화 조건 (사용자 선택 필요)**:

- **선택 1**: 승인된 외부 이메일 소스(별도 계약·공개 연락처 DB 등) 확보 시 → DOC-07 기존 요구사항대로 mailto 브라우저 메일초안 구현. **DOC-07 변경 불필요** (기존 요구사항이 이미 이메일 소스 확보를 전제로 작성됨).
- **선택 2**: 이메일 소스 확보 계획 없이 복사 전용으로 최종 확정 시 → **ADM-08 변경등록 + DOC-07 새 리비전 필요**. 완료 후 ContactButton 복사 전용으로 구현.

### 4.3 조건부 법령안내 자료 제공 여부 (Q-02 — VS-6 진입 전)

**질문**: `/label-guide` 화면에 표시할 승인된 정적 법령 자료를 제공할 수 있습니까?

- 권고: 승인된 날짜 있는 정적 자료 제공 시 활성화
- 미제공 시: `/label-guide` 메뉴 및 라우트 완전 비노출

### 4.4 신규 Supabase 프로젝트 정보 확인 (Q-03 — RESOLVED)

**결론 (B-05)**: `glczrbadvfgmblmkpgfj` 프로젝트 지역 Mumbai (ap-south-1) 확인됨. Healthy 상태, nano 플랜, 공개 테이블 0개. 한국 사용자 대상 지연 모니터링 권장하나 VS-2 진행 차단 사유 아님.

### 4.5 Vercel 배포 대상 소유권 확인 (Q-05)

**질문**: 신규 Vercel 프로젝트 배포 대상 조직/소유자는 `wavenvibe`가 맞습니까?

- 권고: `wavenvibe` 조직 확인
- 미확인 시: VS-6 배포 전 확인 필요

### 4.6 원격 작업 사전 승인 (VS-2)

VS-2 실행 시 사용자 명시적 승인이 3회 필요합니다. 설계 승인과 별개입니다.

| 승인점 | 내용 | 비가역성 |
|---|---|---|
| 승인점 A | 신규 Supabase `glczrbadvfgmblmkpgfj` 스키마 생성 실행 | rollback: DROP TABLE |
| 승인점 B | staging 적재 완료 후 건수·키·표본 대조 확인 | rollback: TRUNCATE staging |
| 승인점 C | public 권한·RLS·인덱스 활성화 실행 | rollback: 각 테이블별 REVOKE SELECT (예: REVOKE SELECT ON TABLE public.facilities FROM anon) |

---

## 4-B. B-10~B-17 반영 위치 요약 (Codex 독립검토 v0.2)

| 차단사항 | 내용 | 반영 파일 | 반영 내용 |
|---|---|---|---|
| B-10 | DOC-07 요구사항 의미로 추적표 재작성 | 06-qa-acceptance-trace.md | 60건 전체를 g3-07-current-requirements.json ID·상태·정식명으로 재작성. FG-FUN-006·007 승인 행 제거. FG-FUN-042·044·060 허위 의미 연결 제거 |
| B-11 | 공동제조 핵심범위 복원 (FG-FUN-032~035) | 06-qa-acceptance-trace.md, 02-user-flow-and-screen-states.md | FG-FUN-032(매칭조건 입력)·033(후보 필터·순위)·034(일치·미충족 근거)·035(시설 상세 연결) 각 행에 화면·API·데이터·합격기준 복원 |
| B-12 | 대체 식재료 데이터계약 실제 산출물과 일치 | 03-data-contract-and-lineage.md | 정렬 기준 필드를 승인된 최종유사도(score_final)로 교체. 1단계 가중치 명시(영양성분 0.60·재료구분 0.15·식품군 0.15·조리상태 0.10). false mapping 제거 |
| B-13 | product_types 파생근거 확정 | 07-risks-decisions-open-items.md | product_types 원본 컬럼 없음 — Q-06 미결정사항 추가. VS-1 읽기 전용 감사 후 사용자 확인 필요 |
| B-14 | Supabase·rollback 설계 정합화 | 03-data-contract-and-lineage.md, 04-supabase-schema-migration-rls.md, 08-implementation-slices.md | private.data_lineage로 스키마 통일. 안전하지 않은 일괄 rollback 표현 제거. 구체적 객체별 REVOKE 문법으로 교체 |
| B-15 | Next.js·화면상태 일관성 | 02-user-flow-and-screen-states.md, 05-nextjs-component-api-design.md | 공개 API anon 키+RLS 전용. label-guide 자료 미제공 시 404/비노출(준비 중 표현 제거). FG-FUN-042·044·060 허위 연결 제거 |
| B-16 | 연락기능 데이터 선행조건 명시 | 03-data-contract-and-lineage.md, 05-nextjs-component-api-design.md | 기존 facility 원본에 email 컬럼 없음 재확인. 현재 tel·homepage·문의문안 복사까지만 구현. 별도 승인 이메일 소스 확보 시에만 mailto 활성화 조건 명시 |
| B-17 | MoAI Stop 훅 설치 불일치 | 07-risks-decisions-open-items.md | R-11 추가. sync-phase-quality-gate.sh·handle-stop-goal.sh 미존재 — 비차단 오류이나 품질게이트·목표상태 자동 동기화 미수행 기록 |

---

## 5. 설계 검증 결과

- **9종 파일**: 01~09 전원 Status: REVIEW READY, 미완성 마커 0건 잔여
- **`node 05-checks/validate-g3-07.mjs --mode=final`**: 이 파일 작성 후 즉시 실행 예정 (결과는 섹션 8 선언 직전 확인)
- **승인 56건·조건부 4건 추적**: 06-qa-acceptance-trace.md에 전건 추적 완료, 보류 46건 분리 기록
- **기존 working tree 전후 대조**: 01-scope-and-source-audit.md 기록 — 17개 수정 파일(동결), 신규 설계 파일 추가됨, 앱 코드 미변경 확인
- **앱 코드·SQL·데이터·원격 Supabase·Vercel 변경**: 0건 — 설계 문서만 작성됨
- **commit·push·PR·tag**: 0건 — 사용자 명시적 요청 없이 수행하지 않음

---

## 6. 승인 체크

- [ ] 현재 기능범위와 조건부 법령안내 경계를 승인한다.
- [ ] 데이터계약·계보·exact/substring 표시방식을 승인한다.
- [ ] Supabase schema·migration·공개권한·rollback 설계를 승인한다. 원격 실행승인은 별도다.
- [ ] Next.js 라우트·컴포넌트·API·상태 설계를 승인한다.
- [ ] QA·인수기준과 VS-1~6 구현순서를 승인한다.
- [ ] 미결정사항의 권고안 또는 별도 답변을 확정한다.

---

## 7. 승인 후 첫 작업

사용자 G3 설계 승인 후 **VS-1** 부터 시작합니다.

**VS-1에서 허용되는 작업**:
- `final_output/analysis_outputs/` 파일 목록·헤더·건수·키 확인 (읽기 전용)
- 6개 지표 실제 필드명 확인 → `03-data-contract-and-lineage.md` 업데이트
- substitute_pairs 234,955건 및 레시피·식재료·시설 원본 건수 대조
- fixture 100건 생성 (QA용 표본, 로컬 전용)
- 데이터 이용 계약 확인 (Q-04)
- tel·homepage 필드 공개 범위 사용자 확인 (email 컬럼 없음 확인됨 — Q-01 대체)

**VS-1에서 금지되는 작업**:
- 원격 Supabase 접근 또는 변경
- 앱 코드 수정
- commit·push·PR

**VS-2 이후**: VS-1 완료 및 사용자 확인 후 별도 지시에 따릅니다. 각 VS는 사용자 확인 없이 자동으로 다음 VS로 진행하지 않습니다.

---

## Claude 중단 선언

이 파일(`09-review-request.md`) 작성과 `node 05-checks/validate-g3-07.mjs --mode=final` 검증 실행 후 Claude는 여기서 멈춥니다.

사용자의 G3 설계 명시적 승인 전 다음 작업을 수행하지 않았으며 앞으로도 수행하지 않습니다:

- `/foodground:chg-g4-002-run` 또는 구현 명령 실행
- 애플리케이션 코드 (`app/`, `components/`, `lib/`) 수정
- Supabase migration 파일 생성 또는 원격 실행
- 데이터 적재 또는 CSV/JSON import
- 원격 Supabase(`glczrbadvfgmblmkpgfj`) 스키마·데이터·권한 변경
- Vercel 배포 또는 환경변수 설정
- `git commit`, `git push`, PR 생성, 태그 추가

G3-07 설계 단계 완료. 사용자의 검토와 승인을 기다립니다.
