# 01. Scope and source audit

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002
- Audit Date: 2026-08-24
- Rev: v0.2 (B-01·B-03·B-05 반영)

## 1. 감사 목적

현재 20,000,000원 범위, 실제 저장소 상태, 기존 분석 산출물과 최신 요구사항의 일치 여부를 확인한다. 기존 자산과 신규 개발가치를 분리하며 어떠한 원본도 변경하지 않는다.

## 2. 감사 시점 working tree (실측)

### 2.1 git status 실제 출력

```
Branch: codex/g1-baseline

Changes not staged for commit (17개 파일 수정됨):
  modified:   .moai/config/sections/db.yaml
  modified:   .moai/config/sections/project.yaml
  modified:   .moai/config/sections/quality.yaml
  modified:   .moai/config/sections/workflow.yaml
  modified:   .moai/project/brand/brand-voice.md
  modified:   .moai/project/brand/target-audience.md
  modified:   .moai/project/brand/visual-identity.md
  modified:   AGENTS.md
  modified:   CLAUDE.md
  modified:   app/b/[id]/page.tsx
  modified:   app/components/SearchForm.tsx
  modified:   app/globals.css
  modified:   app/page.tsx
  modified:   app/search/page.tsx
  modified:   components/FacilityCardItem.tsx
  modified:   components/Header.tsx
  modified:   next.config.ts

Untracked files:
  .claude/commands/foodground/
  .claude/rules/foodground/
  .moai/design/chg-g4-002/
  .moai/project/architecture.md
  .moai/project/current-slice.md
  .moai/project/product.md
  .moai/project/quality-gates.md
  .moai/project/work-orders/
  05-checks/
  START_CHG_G4_002.md, START_CHG_G4_002_v0.2.md, START_G3_07_v0.3.md, START_HERE_G3_DESIGN.md
  app/api/search/facilities/
  app/facilities/
  components/StatePanel.tsx
  components/facilities/
  docs/architecture/
  docs/design/
  lib/facilities.ts
  lib/supabase-public-server.ts
  output/
  supabase/
```

### 2.2 Working tree 파일 분류

| 분류 | 파일/폴더 | 처리 방침 |
|---|---|---|
| MoAI 구성 변경 | .moai/config/sections/*.yaml, AGENTS.md, CLAUDE.md | 보존 — G3 프로젝트 설정 |
| 브랜드 자료 | .moai/project/brand/*.md | 보존 — 사용자 승인 방향 |
| Codex VS-1A 프로토타입 (staged/unstaged) | app/b/[id]/page.tsx, app/components/SearchForm.tsx, app/globals.css, app/page.tsx, app/search/page.tsx, components/FacilityCardItem.tsx, components/Header.tsx, next.config.ts | **동결** — 미승인 프로토타입. 아키텍처 가설 검토 입력으로만 사용. G3 승인 전 구현물로 취급 금지 |
| Codex 미추적 프로토타입 | app/api/search/facilities/, app/facilities/, components/facilities/, lib/facilities.ts, lib/supabase-public-server.ts | **동결** — 동일 이유 |
| G3-07 설계 산출물 | .moai/design/chg-g4-002/ | 보존 — 현재 작성 중 |
| 프로젝트 문서 | .moai/project/*.md, .moai/project/work-orders/ | 보존 — 설계 참조 |
| G3 검증 스크립트 | 05-checks/ | 보존 — 유효성 검사기 |
| 기타 | START_*.md, output/, supabase/, docs/ | 보존 — 작업 이력 |

**보존 원칙**: 감사 전후 어떤 파일도 삭제·수정하지 않았다. Codex 프로토타입은 아키텍처 가설 검토 입력이며, 사용자 G3 승인 후에만 수정 가능하다.

## 3. 권위자료 확인 (B-01 정정)

> **B-01 정정**: DOC-09 v0.4는 WBS·진척관리표이며 화면정의서가 아니다. DOC-04 v0.5는 견적서·산출내역서이며 WBS가 아니다. v0.3 작업지시서가 가리키는 DOC-09·DOC-04 inspect 파일은 실제로 존재하지 않는다. XLSX 원본을 VS-1 감사 시 직접 읽거나 검증 가능한 새 inspect 근거를 생성해 사용한다.

| 우선순위 | 자료 | 실제 버전 | 실제 역할 | 확인 결과 | 충돌·조치 |
|---:|---|---|---|---|---|
| 1 | CHG-G4-002 변경기록 (ADM-08) | v0.5 | 변경요청서·계약 요약 | 20,000,000원(VAT포함), 2.85 MM, 추가유료비 0원, 완료기한 2026-08-20 확인 | 이전 40M 범위는 무효 — v0.3 work order가 권위자료 |
| 2 | DOC-07 v0.7 요구사항정의서 | v0.7 | 요구사항 정의 (SSOT) | 총 106건: 승인 56건, 조건부 4건, 보류 46건 | 보류 46건 현재 인수 제외 |
| 3 | DOC-08 v0.5 기능RFP | v0.5 | 기능 RFP | 60개 RFP 항목, PASS/DEFERRED 분리 확인 | OCR·Auth·게시판 전체 DEFERRED |
| 4 | DOC-09 v0.4 **WBS·진척관리표** | v0.4 | **WBS·진척관리표** (화면정의서 아님) | 공수·진척 참조 — XLSX 원본 VS-1에서 직접 확인 예정 | inspect 파일 없음 — VS-1 직접 읽기 |
| 5 | DOC-04 v0.5 **견적서·산출내역서** | v0.5 | **견적서·산출내역서** (WBS 아님) | 공수 배분 참조 — XLSX 원본 VS-1에서 직접 확인 예정 | inspect 파일 없음 — VS-1 직접 읽기 |
| 6 | ADM-08 v0.5 변경요청서 | v0.5 | CHG-G4-002 확정 내용 | 확정 내용 위에 기술 | SSOT |
| 7 | 기존 분석 폴더 (final_output) | 2026-08-18 생성 | 사전계산 결과 자산 | 읽기 전용 완료, 구조 확인 | 직접 서비스 경로 제공 금지 |
| 8 | Codex 프로토타입 코드 | N/A | 아키텍처 가설 검토 입력 | VS-1A 동결 프로토타입 | 승인 전 구현물로 취급 금지 |

## 4. 현재·조건부·후속 범위 판정

### 4.1 현재 범위 (KRW 20M, 2.85 MM)

| 기능 영역 | 화면·라우트 | API/DB | 시험 |
|---|---|---|---|
| 공개 제조시설 탐색 | /facilities, /facilities/[id] | public.facilities 읽기 | 검색·필터·정렬·페이지·390/1440 |
| 공개 레시피 탐색 | /recipes, /recipes/[id] | public.recipes 읽기 | 검색·필터·정렬·페이지 |
| 공개 식재료 탐색 | /ingredients, /ingredients/[id] | public.ingredients 읽기 | 검색·필터 |
| 대체 식재료 추천 | /substitutes | public.substitute_pairs 읽기 | 6지표·영양·매칭방법 배지·no-candidate |
| 공동제조 조건 필터 (FG-FUN-032~035) | /facilities (업종·제품유형 필터) | public.facilities 필터 | 필수·선택조건 필터 |
| 문의 문안 복사·연락정보 표시 | /facilities/[id] | 클라이언트 전용 | 복사 fallback·tel/homepage 표시 |
| 조건부 법령안내 | /label-guide (승인자료 제공 시) | 정적 콘텐츠 | 자료 미제공 시 비노출 |
| 공통 QA·배포·인계 | 전 화면 | 전체 | 보안·성능·회귀·UAT |

### 4.2 후속 범위 (별도 승인 필요 — 현재 구현객체 없음)

| 기능 | 이유 |
|---|---|
| 제품 공시 전체 이관 (1,047,894건) | CHG-G4-002 명시 제외 |
| OCR / 이미지 인식 | 현재 범위 외 |
| RAG/LLM 생성 답변 | 현재 범위 외 |
| Auth · 회원가입 · 즐겨찾기 · 프로젝트 | 현재 범위 외 |
| 공동구매 게시판 · 비밀 문의 | 현재 범위 외 |
| Python 파이프라인 재실행 · 실시간 재분석 | 현재 범위 외 |
| 이전 TIPS 성과 수치 재현 | 현재 범위 외 — 별도 승인 필요, 내부 측정 참고만 |
| 데이터·서비스 상태 조회 (FG-FUN-042) | 보류 요구사항 (DOC-07 v0.7 정식명) |
| 기존 배치 알림 (FG-FUN-044) | 보류 요구사항 (DOC-07 v0.7 정식명) |
| 게시물·문의 처리현황 (FG-FUN-060) | 보류 요구사항 (DOC-07 v0.7 정식명) |
| 후보 저장·재조회 (FG-FUN-031) | 보류 요구사항 (DOC-07 v0.7 정식명) |

## 5. 기존 분석 자산 감사 (읽기 전용)

### 5.1 final_output 폴더 구조

경로: `C:\Users\rlove\OneDrive\바탕 화면\업무\웨이브앤바이브\1. 연도별프로젝트_2026\2603 빅데이터 분석 활용 지원사업 (고도화)\최종결과물_260818\final_output`

```
final_output/
├── README.md              (1,949 bytes, 2026-08-18)
├── dashboard_app.py       (17,160 bytes, 2026-08-18) — Streamlit 로컬 대시보드
├── dashboard_logic.py     (2,371 bytes, 2026-08-18)
├── data_pipeline.py       (14,969 bytes, 2026-08-18) — 분석 파이프라인 실행기
├── pipeline_config.py     (346 bytes, 2026-08-18)
├── requirements.txt       (97 bytes, 2026-08-18) — Python 패키지
├── run_pipeline.py        (1,959 bytes, 2026-08-18)
├── analysis_outputs/      — 사전계산 분석 결과 (food_pair_similarities.csv 등)
├── dashboard_data/        — 대시보드 데이터
├── raw_data/              — 원본 입력 데이터
└── reference_data/        — 참조 데이터
```

### 5.2 자산 기준선

| 자산 | 기준선 건수 | 소스 폴더 |
|---|---:|---|
| 분석 대상 레시피 | **69,406** | analysis_outputs/ (final_output 파이프라인 기준) |
| 레시피-식재료 연결 행 | **553,763** | analysis_outputs/ |
| 표준 식재료 (기준 식품) | **686** | reference_data/ |
| 사전계산 식품 쌍 (대체 후보) | **234,955** | analysis_outputs/ |
| 고유 입력명 총 관측 | 23,806개 | ingredient_matching.csv |
| 매칭 성공 (완전일치+포함일치+철자유사+동의어) | **12,582 / 23,806 = 52.85% (전체 매칭 성공률)** | ingredient_matching.csv |

> **B-03 정정**: 52.85%는 **완전일치율이 아니라 전체 매칭 성공률**이다. 세부 매칭방법별 분포는 03-data-contract에 기록한다.

### 5.3 Python 파이프라인 구성요소 처리 방침

| 파일 | 역할 | 웹 서비스 포함 여부 |
|---|---|---|
| data_pipeline.py | 원본 데이터 수집·전처리·분석 실행 | 제외 (서버 실행 금지) |
| dashboard_app.py | Streamlit 로컬 대시보드 | 제외 (공개 서비스 외) |
| dashboard_logic.py | 대시보드 비즈니스 로직 | 제외 |
| pipeline_config.py | 파이프라인 설정 | 제외 |
| run_pipeline.py | 파이프라인 진입점 | 제외 |
| requirements.txt | Python 패키지 목록 | 제외 |
| README.md | 사용 설명 | 참조만 |
| analysis_outputs/ | **사전계산 결과** → Supabase 적재 | **VS-2에서 스테이징 후 승인 적재** |

**결론**: final_output 폴더는 읽기 전용 자산이다. 웹 서비스는 analysis_outputs/의 사전계산 결과를 Supabase에 적재 후 공개 읽기로만 제공한다.

## 6. 런타임 마스터 데이터 기준선

| 데이터셋 | 런타임 건수 | 역사적 TIPS 기준 | 혼용 금지 이유 |
|---|---:|---:|---|
| 레시피 | 70,165 | 25,000 | 로컬 테스트 환경 차이 |
| 식재료 | 18,933 | 3,000 | 동일 |
| 제조시설 | 94,723 | 76,000 | 동일 |
| **소계** | **183,821** | **104,000** | 런타임과 TIPS 기준 절대 혼용 금지 |

## 7. 신규 Supabase 프로젝트 상태 (B-05 반영)

| 항목 | 확인값 |
|---|---|
| 프로젝트 ID | `glczrbadvfgmblmkpgfj` |
| 상태 | **Healthy** |
| 리전 | **Mumbai** (ap-south-1) |
| 컴퓨트 | **nano** |
| public 테이블·뷰 | **0개** |
| Auth 사용자 | **0명** |
| Data API (PostgREST) | **활성** |

> Mumbai→서울 지연 실측은 G5 배포 시 Vercel Analytics로 측정한다. 추가 비용 없이 현재 프로젝트를 사용하는 것이 승인 기준선이다.

## 8. 범위 충돌 목록

| 충돌 항목 | 위치 | 처리 |
|---|---|---|
| 이전 40M KRW 범위 언급 | 일부 Codex 문서 | v0.3 work order가 권위자료 — 무효 |
| Auth·저장·즐겨찾기 언급 | 일부 Codex 설계안 | 현재 범위 외 — 구현객체 없음 |
| 제품 1,047,894건 전체 이관 | 일부 Codex 문서 | 현재 범위 외 — 별도 승인 필요 |
| 이전 TIPS 성과 재현 표현 | 일부 문서 | 내부 참조만 — 사용자 화면 노출 금지 |
| OCR / RAG / LLM 기능 | 일부 Codex 설계 | 현재 범위 외 |
| Python Streamlit 서비스 | final_output/dashboard_app.py | 현재 웹 서비스에 포함 안 됨 |
| FG-FUN-042·044·060 보류 | 06-qa 구 버전 | 보류로 재분류 완료 |
| FG-FUN-031 보류 | 06-qa 구 버전 | 보류로 재분류 완료 |

## 9. 설계 사용 가능 자산 결론

| 상태 | 자산 |
|---|---|
| 즉시 사용 가능 | DOC-07 요구사항 (56+4건), DOC-08 RFP, ADM-08 범위, final_output/analysis_outputs/ 사전계산 결과 |
| 승인 후 사용 | analysis_outputs/ Supabase 적재 (VS-2 원격 승인), Codex 프로토타입 코드 (G3 승인 후) |
| 사용 불가 | Python 파이프라인 직접 서비스, 기존 Auth/게시판 코드 |
| VS-1 확인 필요 | DOC-09·DOC-04 XLSX 원본 내용, food_pair_similarities.csv 실제 컬럼명, ingredient_matching.csv 매칭방법 분포 |

## 완료 확인

- [x] 원본 변경 0건
- [x] 기존 working tree 전후 대조 (git status 실측 기록)
- [x] 기준선 수량 근거 (69,406 / 553,763 / 234,955 확인)
- [x] 기존 자산과 신규 개발가치 분리
- [x] 범위 충돌과 미결정 항목 기록
- [x] B-01: DOC-09·DOC-04 실제 역할 정정
- [x] B-03: 52.85% = 전체 매칭 성공률 (완전일치율 아님) 정정
- [x] B-05: 신규 Supabase 확인 사실 반영 (Healthy·Mumbai·nano)
