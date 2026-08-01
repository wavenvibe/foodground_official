# 푸드그라운드 NORTH STAR — 설계 원칙 (항상 참조)

**모든 기능 구현·설계 결정 전에 이 문서를 먼저 확인할 것.**
**이 원칙과 충돌하는 요청은 중단하고 사용자에게 확인 요청.**

---

## 🎯 최상위 목표

| 지표 | 목표 | 내부 버퍼 | 측정기관 |
|---|---|---|---|
| **TTI** (Time to Interactive) | ≤ 1,000 ms | ≤ 800 ms | TTA |
| **Server RAS** (5시간 무중단) | 5분 연속 무응답 없음 | 6시간 무중단 | TTA |

**이 두 지표 달성 실패 = TIPS 과제 리스크.**
모든 구현 결정의 평가 기준은 "이 결정이 TTI와 RAS에 유리한가?"

---

## 🛑 절대 원칙 (예외 없음)

1. **사용자 요청 경로에서 공공 API 런타임 호출 금지**
   - 모든 공공데이터는 배치(cron) 스크립트가 DB에 미리 적재.
   - 화면은 DB만 조회. `fetch('https://apis.data.go.kr/...')` 같은 코드가 `app/` 아래 들어가면 위반.

2. **초기 JS 번들 ≤ 150KB (gzip)**
   - `next build` 결과의 "First Load JS" 컬럼이 150KB 초과하면 빌드 실패 처리.
   - 라우트별 코드스플릿 필수.

3. **서드파티 SDK 도입 금지**
   - 지도 SDK (Kakao/Naver), 카카오 로그인, Google Analytics, Hotjar, 결제 PG SDK 전부 금지.
   - 이 원칙과 충돌하는 기능 요청이 오면 대안 제시 (Static Map 이미지, 서버 로그 기반 분석 등).

4. **모든 화면은 자체 DB 스냅샷만 조회**
   - 실시간 외부 호출 없음. 캐시 미스 시에도 DB로만 폴백.

5. **측정 기간 freeze**
   - TTA 의뢰 중에는 배포·점검·DB 마이그레이션·cron 실행 전부 금지.
   - `.freeze` 락 파일 메커니즘 구현.

6. **실시간 기능 배제**
   - WebSocket, Server-Sent Events, Firebase Realtime DB 전부 금지.
   - 알림은 배치에서 생성, 방문 시 pull 방식 Bell 배지.

---

## 🚫 CUT 기능 목록 (절대 추가 금지)

기획서에서 이미 삭제된 기능들. 요청이 와도 거절하고 대체안 제시:

| 삭제된 기능 | 대체안 |
|---|---|
| 실시간 채팅·쪽지·1:1 문의 | `mailto:` / `tel:` 링크로 종결 |
| 리뷰·평점·추천 랭킹 | 공공데이터 기반 사실만 노출 (HACCP 인증, 판매중지 이력) |
| 결제·계약 체결 | 플랫폼 외부에서 처리 |
| 실시간 지도 (SDK 풀뷰) | Static Map 이미지 1장 (CDN 캐시) |
| 실시간 푸시 알림 | Bell 배지 pull 방식 |
| 무한 스크롤 | 페이지네이션 |
| 자동완성 (무제한) | 300ms debounce + 결과 10건 제한 |

---

## ✅ 구현 기능 10개 (이것만 한다)

| # | 기능 | 렌더링 | 경로 |
|---|---|---|---|
| 1 | 제조시설 검색 (지역·업종·HACCP·판매중지 필터) | SSR + Edge Cache 60s | `/search` |
| 2 | 업체 상세 (생산이력·HACCP·판매중지) | ISR | `/b/[id]` |
| 3 | 관심업체 저장 (비로그인=localStorage, 로그인=DB) | CSR | `/saved` |
| 4 | 관심업체 변경 알림 (배치 생성, Bell 배지) | CSR | `/alerts` |
| 5 | 메일·전화 연결 | 정적 링크 | 상세 내 |
| 6 | 매직링크 로그인 (로컬은 모의 버튼) | CSR | `/signin` |
| 7 | `/healthz` (Server RAS 측정용) | Edge Function | `/api/healthz` |
| 8 | 데이터 동기화 시점 + 경고문 고정 노출 | 정적 | 전 페이지 |
| 9 | 자동완성 검색 (300ms debounce + 10건) | CSR | 검색바 내 |
| 10 | Static Map 썸네일 1장 | 정적 이미지 | 상세 내 |

### 렌더링 전략 근거
- **메인 `/`**: SSG (완전 정적). ATF에 히어로·검색바·필터칩만.
- **상세 `/b/[id]`**: ISR (revalidate = 월 1회 배치 주기). CDN이 대부분 흡수.
- **검색결과 `/search`**: SSR + Edge Cache 60s. 동일 쿼리는 엣지에서 응답.
- **관심·알림·로그인**: CSR + 인증. **TTA 측정 URL에서 제외** → TTI 영향 없음.

---

## ⚠️ 함정 5가지 (구현 시 반드시 자체 검증)

### 1. debounce 누락
```typescript
// ❌ 매 키 입력마다 서버 호출
onChange={(e) => fetch(`/api/search?q=${e.target.value}`)}

// ✅ 300ms debounce
const debounced = useDebouncedCallback((v) => fetch(`/api/search?q=${v}`), 300)
```

### 2. 초기 JS 번들 초과
- `next.config.ts` 에 bundle analyzer 설정.
- `lucide-react`, `date-fns` 같은 범용 라이브러리는 **항상 named import** (`import { Search } from 'lucide-react'`).
- 서버 컴포넌트 우선, 클라이언트 컴포넌트는 꼭 필요한 곳만 `"use client"`.

### 3. 검색 필터 조합 폭발
- 시도 17 × 업종 6 × HACCP 2 × 판매중지 2 × 페이지 N = 캐시 키 수천 개.
- 대응: 주요 조합 (전체·경기도·HACCP만 등 10개)만 `revalidate` 짧게, 나머지는 DB 응답 그대로 + 60s 엣지 캐시.

### 4. 로그인 SDK가 메인에 실림
- `app/page.tsx` 에 `@supabase/auth-helpers-nextjs` 임포트 금지.
- 로그인 관련 코드는 `app/signin/`, `app/(auth)/*` 에만.

### 5. 측정 중 cron 배치 실행
- 배치 스크립트 시작 시 `data/.freeze` 파일 존재 확인.
- TTA 의뢰 기간 동안 이 파일을 `touch` 해서 배치 자동 종료.

---

## 🎨 디자인 토큰 (기획서 색상)

```css
:root {
  /* Green scale (브랜드) */
  --green-900: #1E3A26;   /* 가장 진한 녹색, 헤더·h1 */
  --green-700: #295137;   /* 서브 헤더·strong 텍스트 */
  --green-500: #03C75A;   /* CTA 버튼·배지·활성 상태 */
  --green-300: #55D78F;
  --green-100: #E5EDE5;   /* 카드 배경 (강조) */
  --green-50:  #ECF7ED;   /* 코드 배경 */

  /* Neutrals */
  --bg:     #F5F6F1;  /* 전체 페이지 배경 */
  --paper:  #FFFFFF;  /* 카드·박스 배경 */
  --ink:    #22312A;  /* 본문 텍스트 */
  --ink-2:  #45524B;  /* 보조 텍스트 (설명·메타) */
  --rule:   #D9DED4;  /* 경계선 */

  /* Warn (경고·판매중지) */
  --warn:    #C75A03;  /* 경고 아이콘·주황 dot */
  --warn-bg: #FBEBDC;  /* 경고 박스 배경 */
}
```

**규칙**:
- CSS 변수를 통해서만 사용. Tailwind `bg-[#03C75A]` 같은 하드코딩 금지.
- `tailwind.config.ts` 의 `theme.extend.colors` 에 이 토큰을 매핑.
- 폰트: Pretendard 서브셋 woff2 + `font-display: swap`. 시스템 폰트 fallback.

---

## 🧰 아키텍처

### 스택
- **프론트·백**: Next.js 16.2.4 App Router + TypeScript + Tailwind
- **DB (로컬)**: SQLite via `better-sqlite3`
- **DB (프로덕션)**: Supabase PostgreSQL
- **인증**: Supabase Auth (매직링크). 로컬은 모의 버튼.
- **호스팅**: Cloudflare Pages (정적 + Edge Functions)
- **CDN**: Cloudflare (서울 엣지)

### DB 추상 레이어 (`lib/db.ts`)
- 환경변수 `DATABASE_URL` 로 SQLite ↔ PostgreSQL 전환.
- 쿼리는 양쪽 호환 문법만 사용 (FTS5 대신 LIKE + trigram).
- 마이그레이션은 `migrations/` 양쪽 버전 유지.

### 폴더 구조 (권장)
```
D:\0. 업무\foodground\
├─ app/
│  ├─ page.tsx                  # 메인 /
│  ├─ search/page.tsx           # 검색결과
│  ├─ b/[id]/page.tsx           # 업체 상세 (ISR)
│  ├─ saved/page.tsx            # 관심업체
│  ├─ alerts/page.tsx           # 알림
│  ├─ signin/page.tsx           # 로그인 (별도 번들)
│  └─ api/
│     ├─ healthz/route.ts       # Server RAS 측정용
│     └─ search/route.ts        # 자동완성용
├─ lib/
│  ├─ db.ts                     # SQLite/PG 추상 레이어
│  ├─ types.ts                  # facility·haccp·production 타입
│  └─ facility.ts               # 검색·조회 쿼리
├─ components/                  # 재사용 컴포넌트
├─ data/
│  └─ foodground.db             # SQLite (gitignore)
├─ migrations/                  # C:\...에서 복사
├─ public/
├─ docs/                        # 이 문서들
└─ next.config.ts
```
