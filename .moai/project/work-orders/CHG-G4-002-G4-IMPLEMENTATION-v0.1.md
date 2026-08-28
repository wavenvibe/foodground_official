# CHG-G4-002 G4 구현 작업지시서 v0.1

## 1. 작업 목적

G3-07 설계 사용자 승인 완료 후 G4 구현 단계를 관리한다.
VS별 구현·원격 승인점·배포 진행상태를 추적한다.

## 2. 현재 게이트

Gate: G4 구현

## 3. VS 진행 상태

| VS | 내용 | 상태 |
|---|---|---|
| VS-1 | 읽기 전용 감사 (분석 폴더·요구사항 추출·충돌목록) | ✅ 완료 |
| VS-2 | 로컬 migration·데이터 적재 준비 | ✅ 완료 |
| VS-3 | 공개탐색 로컬 구현·검증 (시설·레시피·식재료 목록·상세) | ✅ 완료 |
| VS-4 | 대체 식재료 검색·후보순위 | ✅ 완료 2026-08-28 |
| VS-5 | 시설 상세·ContactButton | ✅ 완료 2026-08-28 |
| VS-6 | QA·배포·인계 | ✅ 기술 배포 완료 2026-08-28 / 사용자 UAT 미승인 |

## 4. 원격 승인점 상태

| 승인점 | 내용 | 상태 |
|---|---|---|
| A | Supabase 원격 로그인 + migration 적용 | ✅ 완료 2026-08-26 |
| B | Supabase 원격 staging 데이터 적재 | ✅ 완료 2026-08-27 |
| C | Supabase RLS·공개 읽기 검증 | ✅ 완료 2026-08-28 |

## 5. 외부 환경 승인 상태

| 항목 | 상태 |
|---|---|
| Vercel 배포 | ✅ 완료 2026-08-28 (dpl_5G666iP5aBn53B46cUJemn6r1B2a) |
| commit·push | ✅ 완료 2026-08-28 (PR #1, SHA: 68963ef) |
| 원격 Supabase migration 실행 | ✅ 완료 (승인점 A 2026-08-26) |

## 6. 고정 제약

- 신규 Supabase 프로젝트: `glczrbadvfgmblmkpgfj` (Mumbai, ap-south-1)
- service-role 키: VS-2 migration 전용, 공개 런타임 절대 사용 금지
- 기존 유료 Supabase·`wavenvibe/foodground`·`foodground.vercel.app`: 읽기 전용 참조, 쓰기 금지
- commit·push·PR·Vercel 배포: 사용자 명시적 요청 시에만 실행

## 7. 권위 문서 우선순위

1. 사용자 확정 KRW 20,000,000 범위
2. G3-07 승인 설계 9종 (`.moai/design/chg-g4-002/`)
3. `.moai/project/approvals/G3-07-APPROVAL.md`
4. `.moai/project/product.md`, `architecture.md`, `quality-gates.md`
5. 본 지시서
6. 기존 CHG-G4-002-SUBSTITUTE-INTEGRATION-v0.3.md (참조용, 현재 권위 문서 아님)

## 8. 승인점 A 완료 증빙 (2026-08-26)

- `supabase link --project-ref glczrbadvfgmblmkpgfj` 완료
- `supabase db push --dry-run` → migration 10개 예상 목록 일치 확인
- `supabase db push` → 10개 migration 원격 적용 완료
- 검증:
  - public 테이블 7개 생성 (RLS 모두 활성화)
  - private.data_lineage 1개, staging 테이블 7개 생성
  - 전 테이블 0건 (데이터 미적재 상태 정상)
  - anon/authenticated → private·staging 접근 권한 없음
  - facilities anon SELECT: 승인 11컬럼만 노출

## 9. 승인점 B 완료 증빙 (2026-08-27)

### staging 적재 결과

| 테이블 | 원본 건수 | 적재 건수 | 비고 |
|---|---|---|---|
| staging.standard_foods | 686 | 686 | - |
| staging.substitute_pairs | 234,955 | 234,955 | - |
| staging.ingredient_name_match | 23,806 | 23,806 | - |
| staging.recipes | 70,165 | 70,165 | - |
| staging.ingredients | 18,933 | 18,932 | ingredient_id=1124336 NULL name 제외 1건 |
| staging.recipe_ingredients | 679,457 | 679,457 | amount_gram 이상치 NULL 처리 1건 (recipe_id=6936777, ingredient_id=1119343, sort_order=8, 원값=1,040,500,665.0) |
| staging.facilities | 94,723 | 94,723 | - |

### 데이터 품질 처리 이력

- **is_seasoning 타입 오류**: SQLite INTEGER 0/1 → PostgreSQL BOOLEAN 충돌. `bool()` 명시 변환으로 해결.
- **is_haccp 타입 오류**: 동일 패턴. `bool()` 명시 변환으로 해결.
- **amount_gram 이상치**: NUMERIC(10,2) 최대값(99,999,999.99) 초과 1건 확인. 관계 행은 유지하고 amount_gram만 NULL로 저장. 전수검사 결과 해당 1건 외 동일 이상치 없음.
- **ingredients reject**: NULL name 1건(ingredient_id=1124336)만 제외. 해당 ingredient_id에 recipe_ingredients 참조 0건 확인(2026-08-25 감사 결과).

### 검증 결과

- `vs2_validate.py --mode staging`: PASS
- public 7개 테이블 합계: 0건 (staging→public 게시 미실행 확인)
- 원본 SQLite DB 변경 없음 (mode=ro 연결 전용)

### ingest_run_id

각 적재 스크립트가 `private.data_lineage`에 UUID를 기록함. 실행 시점의 터미널 출력에서 확인 가능. 추후 `SELECT * FROM private.data_lineage ORDER BY created_at;`으로 재조회 가능.

## 10. VS-6 운영배포 완료 (2026-08-28~29)

| 항목 | 결과 |
|---|---|
| PR #1 merge (codex/g1-baseline → main) | ✅ 완료 (SHA: 68963ef82798aa3219ddf8e2344f0a4eab73c63f) |
| Vercel 운영 배포 (foodground-official.vercel.app) | ✅ 완료 (READY, dpl_5G666iP5aBn53B46cUJemn6r1B2a) |
| 운영 스모크 QA (Playwright E2E 19/19) | ✅ 완료 2026-08-29 |
| ESLint 0 errors | ✅ |
| TypeScript 0 errors | ✅ |
| Next.js build | ✅ Compiled successfully |
| 사용자 UAT | ⏸ 미승인 |
| G6-GATE 최종 인수 | ⏸ 미완료 |
| 종합 판정 | 기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요 |

증빙 문서:
- `docs/qa/vs6-production-deployment.md`
- `docs/qa/vs6-release-readiness.md`
- `docs/qa/vs6-integration-evidence.md`
- `02_문서/06_운영인계/TEC-12_릴리스노트_v0.1.md`

다음 작업: CHG-G6 (후속 품질 개선·기능 추가)
