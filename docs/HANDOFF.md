# 푸드그라운드 프로젝트 인수인계 (HANDOFF)

**작성일**: 2026-04-24
**대상**: Claude Code 오케스트레이터 및 서브 에이전트
**읽기 순서**: 이 문서 → `NORTH_STAR.md` → `PR_CHECKLIST.md`

---

## 1. 프로젝트 개요

**프로젝트명**: 푸드그라운드 (Foodground)
**한 줄 정의**: 식품제조 의뢰자와 제조시설을 잇는 공공데이터 기반 경량 매칭 플랫폼
**최종 목표**: TIPS 과제 성능지표 TTA 공인 시험 통과
  - TTI ≤ 1,000ms (내부 버퍼 ≤ 800ms)
  - Server RAS 5시간 연속 응답 (내부 버퍼 6시간)
**첫 공개 대상**: TIPS 심사위원
**팀 구성**: 비개발자 연구책임자 1명 + Claude (개발자 없음)

---

## 2. 완료된 작업

### 데이터 적재 (SQLite)
| 데이터셋 | 건수 | facility 매칭 | 소스 |
|---|---|---|---|
| `facility` (식품제조가공업) | 94,723 (영업중 30,257) | — | data.go.kr 15044976 CSV |
| `haccp_cert` (HACCP 인증) | 308 | 269 (87.3%) | 스마트HACCP getFoodList |
| `production_log` (품목제조보고) | 1,047,894 | 815,989 (77.9%) | 식품안전나라 C002 |

### 완성된 자산
- 기획서 HTML (색상·기능·와이어프레임 5종 포함)
- 적재 스크립트 3종 (facility·haccp·production)
- 검증 스크립트 `verify.py` (17개 섹션, 쿼리 성능 측정 포함)
- Next.js 16.2.4 스캐폴드 (TypeScript + Tailwind + App Router + Turbopack)

### Task 진행 현황 (21개 중 19개 완료)
완료: #1~#19, #21
진행 대기: #20 (Next.js App Router 스캐폴드 + /healthz) — **현재 이 작업 중**

---

## 3. 파일·폴더 위치 (D 드라이브 자립 상태)

| 자산 | D 드라이브 경로 | 상태 |
|---|---|---|
| **웹 프로젝트 루트** | `D:\0. 업무\foodground\` | Next.js 16.2.4 스캐폴드 |
| 기획서 HTML | `D:\0. 업무\foodground\docs\plan.html` | ✅ 복사 완료 (68KB) |
| SQLite 마이그레이션 | `D:\0. 업무\foodground\migrations\0001_init.sqlite.sql` | ✅ 복사 완료 |
| Python 적재·검증 스크립트 | `D:\0. 업무\foodground\scripts\` | ✅ 복사 완료 (5개 파일) |
| `.env.example` | `D:\0. 업무\foodground\.env.example` | ✅ 복사 완료 |
| `requirements.txt` | `D:\0. 업무\foodground\requirements.txt` | ✅ 재작성 완료 |
| **SQLite DB (381MB)** | `D:\0. 업무\foodground\data\foodground.db` | ⏳ **사용자 수동 복사 필요** |
| PG 마이그레이션 `0001_init.sql` | (미복사) | Phase 3 전까지 보류 |
| `verify_queries.sql` (PG용) | (미복사) | Phase 3 전까지 보류 |

### DB 복사 방법 (사용자 실행)
OneDrive의 큰 파일은 Linux 쪽에서 타임아웃·cloud-only 이슈로 못 읽어옴. Windows cmd에서 직접 실행:
```cmd
copy "C:\Users\rlove\OneDrive\문서\Claude\Projects\TIPS 성능지표\푸드그라운드\data\foodground.db" "D:\0. 업무\foodground\data\foodground.db"
```
완료 후 크기 확인:
```cmd
dir "D:\0. 업무\foodground\data\foodground.db"
```
`381,xxx,xxx bytes` 정도 표시되면 정상.

### `.env` (API 키) 상태
- ✅ `D:\0. 업무\foodground\.env` 생성 완료 (HACCP + MFDS_REPORT 키 포함)
- ✅ `.gitignore` 확인 완료 — git 추적되지 않음
- 내용: `HACCP_SERVICE_KEY`, `MFDS_REPORT_KEY`, `SQLITE_PATH`, `FACILITY_CSV_PATH`
- Phase 3 Supabase 전환 시 `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*` 추가

### 적재 가이드
- `docs/INGEST_GUIDE.md` — 기존 Python 적재 가이드 (원본 C 드라이브 README 사본)
- Next.js 기본 `README.md` 는 루트에 유지 (웹 개발 시작 가이드)

### 원본 C 드라이브에 남아있는 자산 (OneDrive cloud-only로 현재 세션에서 못 옮긴 것)
Phase 3 또는 재적재 필요 시 Windows 네이티브 `copy` 로 가져올 것:

| 파일 | 경로 | 언제 필요? |
|---|---|---|
| `0001_init.sql` (PG 스키마) | `C:\...\푸드그라운드\migrations\` | Supabase 이관 시 |
| `verify_queries.sql` (PG 검증) | `C:\...\푸드그라운드\scripts\` | Supabase 이관 시 |
| `docker-compose.yml` (PG + Redis) | `C:\...\푸드그라운드\` | Supabase 가기 전 로컬 PG 테스트 시 |
| `푸드그라운드_Phase0_공공API_확정.html` | `C:\...\TIPS 성능지표\` | 공공 API 결정 이력 참조 시 |
| `식품_식품제조가공업.csv` (28MB) | `C:\...\TIPS 성능지표\` | facility 재적재 시 |
| `.haccp_api_config.json` | `C:\...\TIPS 성능지표\` | HACCP API 키 원본 (이미 `.env`에 반영됨) |

**사용자 실행 예시** (필요 시):
```cmd
copy "C:\Users\rlove\OneDrive\문서\Claude\Projects\TIPS 성능지표\푸드그라운드\migrations\0001_init.sql" "D:\0. 업무\foodground\migrations\"
copy "C:\Users\rlove\OneDrive\문서\Claude\Projects\TIPS 성능지표\푸드그라운드\docker-compose.yml" "D:\0. 업무\foodground\"
```

---

## 4. 사용자 프로필 & 결정사항

### 희정 (연구책임자)
- 비개발자. 기술 결정은 Claude에 위임.
- UX·사업 관점 검토 및 최종 승인 담당.
- 빠른 진행 선호. 화면 결과물을 일찍 보는 것을 중시.
- TTA 공인 시험 서류·일정은 직접 처리.

### 확정된 결정 (바꾸지 말 것)
- ✅ 이메일 **매직링크** 로그인 (Supabase Auth 내장). 카카오 로그인 **금지** (서드파티 SDK = 번들 오염).
- ✅ **로컬 우선** 개발 → 나중에 Cloudflare + Supabase로 배포.
- ✅ 로컬 개발 중엔 "로그인 모의 버튼"으로 대체. 배포 직전 실 매직링크 연동.
- ✅ 로컬 DB는 **SQLite (better-sqlite3)**, 프로덕션은 **Supabase PostgreSQL**. `DATABASE_URL` 환경변수로 전환.
- ✅ 데이터 이관: 기존 `migrations/0001_init.sqlite.sql` + `0001_init.sql` (PG용) 양쪽 준비됨. 재사용.

---

## 5. 환경

- **OS**: Windows
- **Node.js**: 24.13.1 / **npm**: 11.8.0 (설치 완료)
- **Next.js**: 16.2.4 (설치 완료, `D:\0. 업무\foodground`)
- **기본 개발 서버**: `npm run dev` → `http://localhost:3000` (확인됨)

### 권장 추가 의존성 (첫 작업 때 설치)
```
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

향후 Supabase 전환 시:
```
npm install @supabase/supabase-js
```

---

## 6. 남은 작업 (로드맵)

| 단계 | 기간 | 할 일 |
|---|---|---|
| 1. 로컬 풀스택 | 3~4주 | 기획서 10개 기능 전부 구현. 로그인은 모의 버튼. |
| 2. 이관 준비 | 1주 | 환경변수 정리, DB 마이그레이션 점검, 매직링크 실발송 테스트 |
| 3. 클라우드 배포 | 1주 | GitHub·Supabase·Cloudflare 계정 생성 → 데이터 업로드 → 배포 |
| 4. 내부 TTI/RAS 측정 | 1주 | Lighthouse + 5시간 헬스체크 자체 |
| 5. 최적화 | 1주 | 실패 지점 개선 |
| 6. TTA 공인 시험 | 2~3주 | 서류 → 측정 → 성적서 |

---

## 7. 에이전트 구조 제안

- **오케스트레이터**: 전체 공정, NORTH_STAR 준수 감시, PR 승인
- **서브 에이전트 A — Frontend**: 기획서 와이어프레임 5종 구현
- **서브 에이전트 B — Backend/DB**: API 라우트, DB 추상 레이어, Supabase 이관 스크립트, 매직링크
- **서브 에이전트 C — Perf/QA**: 번들 크기 측정, Lighthouse CI, /healthz + RAS 시뮬레이션

---

## 8. 첫 세션에서 할 일 (권장 순서)

1. 이 문서 + `NORTH_STAR.md` + `PR_CHECKLIST.md` 전부 숙지
2. `docs/plan.html` (기획서) 읽고 디자인 토큰·기능 10개·와이어프레임 5종 내재화
3. **DB 복사 확인**: `data/foodground.db` 존재 여부 (약 381MB). 없으면 사용자에게 3번 섹션의 `copy` 명령 실행 요청.
4. `better-sqlite3` 설치 + `lib/db.ts` 추상 레이어 구축 (SQLite ↔ PG 전환 가능)
   ```
   npm install better-sqlite3
   npm install -D @types/better-sqlite3
   ```
5. `/healthz` 라우트 먼저 구현 (`app/api/healthz/route.ts`, DB ping, 500ms 타임아웃, 503 반환)
6. 홈 화면 (`app/page.tsx`) — `docs/plan.html` 5-1 기준
7. 검색 결과 (`app/search/page.tsx`) — `docs/plan.html` 5-2
8. 업체 상세 (`app/b/[id]/page.tsx`) — `docs/plan.html` 5-3, ISR 설정
9. 관심업체 (`app/saved/page.tsx`) — `docs/plan.html` 5-4
10. 알림 (`app/alerts/page.tsx`) — `docs/plan.html` 5-5
11. 매직링크 로그인 (모의 버튼) — `app/signin/page.tsx`
12. 각 기능 완료 시마다 `PR_CHECKLIST.md` 전수 체크

---

## 9. 중요 맥락 · 사전 경고

### 식약처 API 호출 한도
- 식품안전나라 C002: 일 1,000회 호출 제한. 자정 KST 리셋. 배치 스크립트에만 쓰고, 웹 런타임 경로에서는 **절대 호출 금지**.

### 원본 데이터 이상치
- production_log에 `0212-02-13`, `2103-06-18` 같은 식약처 원본 오기 존재. TIPS 지표 중 "식품표기오류 탐지" 시연 데이터로 활용 가능.

### OneDrive Write 트렁케이션
- `C:\Users\rlove\OneDrive\...` 경로의 파일은 Write tool 사용 시 원본 크기로 잘리는 경우가 있었음. D 드라이브(`D:\0. 업무\foodground\`)는 해당 없음.

### Supabase 이관 시 주의
- SQLite FTS5 → PostgreSQL의 `pg_trgm` 또는 `tsvector`로 전환 필요. 기존 `migrations/0001_init.sql` 참고.
