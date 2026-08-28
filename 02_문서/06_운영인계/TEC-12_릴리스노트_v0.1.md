# TEC-12 릴리스노트 v0.1

**문서 ID**: TEC-12
**버전**: v0.1
**작성일**: 2026-08-29
**작성자**: Claude Code + MoAI (wavenvibe)
**변경기준**: CHG-G4-002
**상태**: 기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요

---

## 1. 릴리스 개요

| 항목 | 값 |
|------|-----|
| 릴리스명 | Foodground 공식 웹사이트 초기 운영 배포 |
| 배포 대상 | `https://foodground-official.vercel.app` |
| 배포 일시 | 2026-08-28T14:02:58Z |
| Git 저장소 | `wavenvibe/foodground_official` |
| 운영 브랜치 | `main` |
| 배포 Git SHA | `68963ef82798aa3219ddf8e2344f0a4eab73c63f` |
| Vercel 배포 ID | `dpl_5G666iP5aBn53B46cUJemn6r1B2a` |
| Supabase 프로젝트 | `glczrbadvfgmblmkpgfj` (신규 격리 프로젝트, ap-south-1) |

---

## 2. 구현 범위 (CHG-G4-002 승인 기능)

### 2.1 공개 탐색

| 기능 | 경로 | 비고 |
|------|------|------|
| 레시피 목록 | `/recipes` | 전체 70,165건, 카테고리 필터 |
| 레시피 상세 | `/recipes/[id]` | 재료·카테고리·인분 표시 |
| 식재료 목록 | `/ingredients` | 전체 18,933건 |
| 식재료 상세 | `/ingredients/[id]` | 식재료 정보 |
| 시설 목록 | `/facilities` | 94,723건, 키워드·지역·HACCP·영업상태 필터 |
| 시설 상세 | `/facilities/[id]` | 상세 정보·ContactButton·FG-FUN-034 |

### 2.2 대체 식재료

| 기능 | 경로 | 비고 |
|------|------|------|
| 대체 식재료 검색 | `/substitutes` | 사전산출 234,955쌍, exact/substring 매칭 |
| 6가지 유사도 지표 | — | 영양소·에너지·단백질·지방·탄수화물·칼로리 기반 |

### 2.3 기타

| 기능 | 비고 |
|------|------|
| FG-FUN-034: 필터 조건 근거 패널 | 시설 목록 → 상세 이동 시 필터 컨텍스트 표시 |
| ContactButton | 문의문안 복사 + tel/homepage 연결 |
| 반응형 | 1440px (데스크톱) / 390px (모바일) |
| 오류·빈 결과·not-found 상태 | FG_* 에러 코드, retryable, fallback |

---

## 3. 데이터 현황

| 테이블 | 건수 |
|--------|------|
| 레시피 | 70,165 |
| 식재료 | 18,932 (NULL name 1건 제외) |
| 제조시설 | 94,723 |
| 식품 표준 | 686 |
| 대체 식재료 쌍 | 234,955 |
| 식재료명 매칭 | 23,806 (고유명 매칭률 52.85%) |

---

## 4. 운영 QA 결과

| 항목 | 결과 |
|------|------|
| Playwright E2E (운영환경) | ✅ 19 passed, 5 skipped, 0 failed |
| HTTP 상태 (16개 경로) | ✅ 모두 200/307 정상 |
| 비공개 컬럼 미노출 | ✅ |
| SQL·stack trace 에러 미노출 | ✅ |
| 반응형 가로 넘침 | ✅ 없음 |
| 콘솔 에러 | ✅ 0건 (favicon 제외) |
| 기존 `foodground.vercel.app` 무변경 | ✅ HTTP 200 확인 |
| ESLint | ✅ 0 errors (warning 5건은 기존 것) |
| TypeScript | ✅ 0 errors |
| Next.js Build | ✅ Compiled successfully |

---

## 5. 기술 스택

| 항목 | 버전 |
|------|------|
| Next.js | 16 (App Router) |
| React | 19 |
| TypeScript | — |
| Tailwind CSS | 4 |
| Supabase | PostgreSQL (RLS 활성화) |
| Vercel | Hobby 플랜 |

---

## 6. 보안

- 서비스롤 키: 런타임 미노출 (서버 전용 파일에만 사용)
- API: 비공개 컬럼 (road_addr, coord_x, coord_y, suspension_count) 필터링 확인
- RLS: anon 읽기 전용, private/staging 스키마 접근 불가
- `.env.local`: git 미추적

---

## 7. 알려진 제한·이슈

| 이슈 | 처리 |
|------|------|
| npm audit 취약점 8건 (1 low, 7 high) | 런타임 직접 공격 경로 없음 확인. 다음 릴리스 시 fix 권장 |
| 고유명 매칭률 52.85% | substring 매칭에 출처 정보 표시 구현됨 |
| Auth·로그인·저장 기능 | 현재 범위 제외 (후속 CHG-G6) |
| Product filing 1,047,894건 마이그레이션 | 현재 범위 제외 (후속 CHG-G6) |

---

## 8. 상태 판정

| 항목 | 상태 |
|------|------|
| Git merge (PR #1) | ✅ 완료 |
| Vercel 운영 배포 | ✅ 완료 |
| 기술 스모크 QA | ✅ 완료 |
| 사용자 UAT | ⏸ 미승인 |
| G6-GATE 최종 인수 | ⏸ 미완료 |
| **종합** | **기술 배포 완료 / 사용자 품질 재검토 및 안정화 필요** |

사용자가 현재 화면·서비스 완성도에 부적합 의견을 제시함.
G6-GATE 최종 인수 완료로 표시하지 않음.
새 기능 및 디자인 개선은 후속 CHG-G6 변경작업으로 분리한다.

---

## 9. 증빙 문서

| 문서 | 경로 |
|------|------|
| 운영 배포 QA | `docs/qa/vs6-production-deployment.md` |
| 릴리스 준비 상태 | `docs/qa/vs6-release-readiness.md` |
| 통합 QA 증거 | `docs/qa/vs6-integration-evidence.md` |
| 보안 체크 | `docs/qa/vs6-security-check.md` |
| 스크린샷 | `docs/qa/evidence/vs6-production/` (14개) |

---

*이 문서는 CHG-G4-002 G4 구현 단계 VS-6 완료 증빙으로 작성되었습니다.*
