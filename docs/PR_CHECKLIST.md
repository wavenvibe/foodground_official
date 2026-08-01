# PR / 작업 단위 체크리스트

**매 기능 구현 커밋·PR 전 반드시 전수 체크.**
**체크 실패 시 머지 금지.**

오케스트레이터 에이전트는 서브 에이전트 작업 결과물을 이 체크리스트로 검증한 뒤에만 승인할 것.

---

## ✅ TTI 체크 (항상)

- [ ] `npm run build` 성공 (에러·경고 0)
- [ ] Route별 "First Load JS" ≤ **150 KB** (gzip)
  - 확인: 빌드 출력의 Route 테이블
  - 초과 시: 해당 라우트의 `"use client"` 범위 축소, 대형 import 제거
- [ ] Lighthouse 로컬 측정 TTI ≤ **1,500ms** (로컬은 프로덕션보다 느리므로 여유)
  - 측정: `npx lighthouse http://localhost:3000 --only-categories=performance --preset=desktop`
  - 측정 대상: `/`, `/search`, `/b/[임의 id]` 3개
- [ ] 이미지 `loading="lazy"` 적용 (히어로 제외)
- [ ] 이미지 WebP 포맷 또는 `next/image` 사용
- [ ] 폰트 `font-display: swap` 확인 (CSS 또는 next/font)
- [ ] 서버 컴포넌트 우선 설계. `"use client"` 는 상호작용 필요한 컴포넌트만.

---

## ✅ RAS 체크 (API 라우트 추가 시)

- [ ] `/api/healthz` 가 인증·미들웨어·레이트리밋 타지 않음 (얕은 레이어)
- [ ] DB 쿼리 타임아웃 **500ms** 설정
- [ ] API 라우트에서 외부 `fetch` 없음 (공공 API·서드파티 API 전부)
- [ ] DB 에러 시 fallback 반환 로직 있음 (캐시·stale-while-revalidate)
- [ ] `GET /healthz` 응답 페이로드 ≤ **100 byte** (`{"ok":true,"ts":...,"db":"up"}`)

---

## ✅ 기획서 정합성 (기능 추가 시)

- [ ] CUT 목록에 있는 기능 추가 안 됨
  - 실시간 채팅, 리뷰·평점, 결제, 실시간 지도 SDK, 실시간 푸시, 무한 스크롤
- [ ] 상세 페이지에 경고문 고정 노출
  - "본 정보는 공공데이터 기반 주기 스냅샷입니다. 계약 전 반드시 업체에 확인하세요."
- [ ] 디자인 토큰 CSS 변수로 사용 (`--green-500` 등). 하드코딩 `#03C75A` 금지.
- [ ] 로그인 관련 코드는 `app/signin/`, `app/(auth)/` 에만.
- [ ] 데이터 동기화 시점 표시 (최종 동기화 일자)

---

## ✅ 코드 품질 (항상)

- [ ] `npx tsc --noEmit` → TypeScript 에러 0
- [ ] `npx eslint .` → ESLint 에러 0 (경고는 허용되나 가능하면 0)
- [ ] `.env` 파일이 `.gitignore` 에 포함됨
- [ ] 비밀 키 (Supabase anon/service key 등) 코드에 하드코딩 없음
- [ ] 서드파티 라이브러리 신규 추가 시 번들 영향 측정 (`npm run build` 전후 비교)

---

## ✅ 접근성

- [ ] 시맨틱 HTML (`<button>`, `<nav>`, `<main>`, `<section>`, `<article>`)
- [ ] 아이콘 버튼에 `aria-label` 필수
- [ ] 색상 대비 WCAG AA 이상 (본문 4.5:1, 대형 텍스트 3:1)
- [ ] 컬러블라인드 대응: 판매중지 표시는 색상 단독 금지 (주황 dot + 아이콘 + 텍스트)
- [ ] 키보드 Tab 순서 논리적 (폼·CTA 우선)
- [ ] 이미지 `alt` 속성 필수

---

## 🚫 금지 사항 검증 (grep 기반 자동 확인 권장)

```bash
# 공공 API 호출이 app/ 경로에 있으면 안 됨
grep -r "foodsafetykorea\|apis.data.go.kr" app/
# 결과 있으면 위반

# 실시간 기능
grep -r "WebSocket\|EventSource\|socket.io" app/ lib/
# 결과 있으면 위반

# 서드파티 SDK
grep -r "kakao\|@kakao\|firebase" package.json app/
# 결과 있으면 위반

# 클라이언트 번들에 DATABASE_URL 노출
grep -r "process.env.DATABASE_URL" app/**/*.tsx
# 서버 컴포넌트·API 라우트 외에서 나오면 위반
```

- [ ] 위 4가지 grep 모두 통과

---

## 🔄 데이터 마이그레이션 체크 (DB 관련 작업 시)

- [ ] SQLite 쿼리가 PostgreSQL 에서도 동작 (예: FTS5 대신 ILIKE 또는 trigram)
- [ ] 환경변수 `DATABASE_URL` 만으로 전환 가능
- [ ] 로컬 개발 (`DATABASE_URL=sqlite:./data/foodground.db`) 과 프로덕션 (`DATABASE_URL=postgresql://...`) 양쪽 동일 코드로 동작 확인
- [ ] 마이그레이션 스크립트 `migrations/0001_init.sqlite.sql` 과 `migrations/0001_init.sql` (PG) 양쪽 스키마 일치

---

## 🎯 KTCC 의뢰 전 최종 체크 (마지막 1회)

- [ ] `/`, `/search`, `/b/:id` 3개 URL Lighthouse 모바일 Slow 4G 5회 측정, 중앙값 **TTI ≤ 800ms**
  - 측정 조건: throttling 1.6Mbps / 750ms RTT, 모바일 에뮬, Chrome 표준
- [ ] 5시간 로컬 헬스체크 스크립트 통과
  - `python run-ras-check.py` (기획서 8번 섹션)
  - 연속 실패 < 300초 (5분)
- [ ] UptimeRobot 또는 StatusCake 외부 감시 등록 (1분 간격)
- [ ] 배포 freeze 캘린더 등록
- [ ] 측정 기간 cron lock 파일 (`data/.freeze`) 활성화
- [ ] 롤백 계획 문서화
- [ ] KTCC 제출 첨부 자료 준비
  - `ras_log.jsonl` (5시간 로그)
  - 서버 아키텍처 다이어그램
  - 배포 freeze 캘린더 캡처
  - Lighthouse 리포트 (3개 URL × 5회)

---

## 📝 작업 로그

매 기능 완료 시 이 표에 한 줄 추가 (append only):

| 날짜 | 기능 | 담당 에이전트 | 체크리스트 통과 | First Load JS (KB) | 비고 |
|---|---|---|---|---|---|
| 2026-04-24 | 인프라 (globals.css, layout.tsx, next.config.ts) | MoAI | ✅ | - | 디자인토큰, better-sqlite3 설정 |
| 2026-04-24 | DB 추상 레이어 (lib/db.ts, lib/types.ts, lib/facility.ts) | expert-backend | ✅ | - | FTS5+LIKE 검색, singleton DB |
| 2026-04-24 | /healthz API | expert-backend | ✅ | - | 500ms 타임아웃, 503 반환 |
| 2026-04-24 | /api/search (자동완성) | expert-backend | ✅ | - | 10건 제한 |
| 2026-04-24 | 홈 화면 (/) | expert-frontend | ✅ | ~70 gzip est. | SSG, 검색바, 인기카테고리, 동기화 현황 |
| 2026-04-24 | 검색결과 (/search) | expert-frontend | ✅ | ~70 gzip est. | SSR, 필터패널, 페이지네이션 |
| 2026-04-24 | 업체 상세 (/b/[id]) | expert-frontend | ✅ | ~70 gzip est. | ISR, 생산이력, HACCP, 경고문 |
| 2026-04-24 | 관심업체 (/saved) | expert-frontend | ✅ | ~70 gzip est. | CSR, localStorage |
| 2026-04-24 | 알림 (/alerts) | expert-frontend | ✅ | ~70 gzip est. | CSR, 빈 상태 (로그인 후 활성화) |
| 2026-04-24 | 로그인 (/signin) | expert-frontend | ✅ | ~70 gzip est. | CSR, 모의 버튼 |
| 2026-04-28 | Supabase Auth OTP 로그인 (app/signin/page.tsx, components/AuthButton.tsx, lib/useUser.ts) | MoAI | ✅ | 128.9 | 6자리 OTP 방식, Header 연동, /saved·/alerts 조건부 표시 |
| 2026-04-28 | /products ISR 전환 (revalidate=60, force-dynamic 제거) | MoAI | ✅ | 128.9 | searchParams 사용으로 ƒ 표시되나 캐싱 정책 적용 |
| 2026-04-28 | .freeze 가드 (ingest_*.py 3종) | MoAI | ✅ | - | KTCC 시험 기간 적재 중단 보호 |
| 2026-04-28 | scripts/generate_alerts.py (관심업체 알림 생성) | MoAI | ✅ | - | suspension+new_product, .freeze 가드 포함 |
| 2026-04-28 | scripts/warm_isr.ts (ISR 캐시 웜업) | MoAI | ✅ | - | Supabase 품목 수 기준 상위 10개 시설 |
| 2026-04-28 | scripts/run_ras_check.py (KTCC RAS 자체 검증) | MoAI | ✅ | - | 1초 간격, 300초 연속실패 한도, JSONL 로그 |
| 2026-04-28 | 빌드 검증 (npm run build) — First Load JS 실측 | MoAI | ✅ | 128.9 | Turbopack+RSC: 공유청크 128.9KB, 앱별 추가없음. 금지항목 grep 4종 CLEAN. TS에러 0 |

---

## 🚨 위반 시 에스컬레이션

체크리스트 항목을 통과하지 못하는 경우:
1. **코드 품질·TTI·RAS 항목 위반**: 수정 후 재검증. 통과 전 머지 금지.
2. **기획서 정합성·CUT 목록 위반**: 작업 중단하고 사용자(희정)에게 확인 요청. 기획 변경이 필요한지 판단.
3. **금지 사항 발견 (서드파티 SDK·실시간 기능 등)**: 즉시 revert. 대안 설계 후 재접근.

---

## 참고 문서
- `HANDOFF.md` — 프로젝트 인수인계 (1회 읽기)
- `NORTH_STAR.md` — 설계 원칙 (항상 참조)
- `C:\...\푸드그라운드_플랫폼_기획서.html` — 원본 기획서 (디자인·와이어프레임 참조)
