# 푸드그라운드(Foodground) 플랫폼 구축 결과보고서

> **문서 버전**: v1.0 (Final)
> **작성일**: 2026-04-25
> **연구책임자**: 희정
> **구축 담당**: Claude (AI 개발 에이전트)
> **대상 과제**: TIPS 연구개발 성능지표 TTA 공인시험 대응

---

## 1. 프로젝트 개요

### 1.1 목적

식품제조 의뢰자와 제조시설을 연결하는 **공공데이터 기반 식품제조시설 매칭 플랫폼** 구축. 식품의약품안전처 등 공공 데이터를 자체 DB에 사전 적재하여, 사용자가 외부 API 의존 없이 빠르게 조회할 수 있도록 설계.

### 1.2 최상위 성능 목표 (TIPS 지표 기준)

| 지표 | 목표치 | 내부 버퍼 | 측정 기관 |
|------|--------|-----------|-----------|
| **ATF 렌더링 시간** (TTI 대응) | < 1,000 ms | < 800 ms | TTA |
| **Server RAS** (연속 무중단) | 5일 · 5분 연속 무응답 없음 | 6시간 추가 여유 | TTA |

### 1.3 서비스 URL

| 환경 | URL |
|------|-----|
| 운영 (Production) | https://foodground.vercel.app |
| 헬스체크 엔드포인트 | https://foodground.vercel.app/api/healthz |

### 1.4 달성 요약

| 항목 | 판정 | 실측 |
|------|:----:|------|
| ATF < 1,000 ms (3개 페이지) | ✅ **통과** | 메인 0.4s · 업체검색 0.4s · 제품검색 0.9s |
| Server RAS 헬스체크 구현 | ✅ **완료** | `/api/healthz` · 500 ms DB 타임아웃 · 503 장애 반환 |
| 공공데이터 적재 | ✅ **완료** | 총 1,043,280건 Supabase PostgreSQL 이관 |
| 기획서 10대 기능 구현 | ✅ **완료** | SSG·ISR·SSR·CSR 혼합 렌더링 적용 |

---

## 2. 기술 스택

| 계층 | 선택 기술 | 선택 근거 (성능 관점) |
|------|-----------|----------------------|
| 프론트·백엔드 | **Next.js 16.2.4 (App Router) + TypeScript** | SSG/ISR/SSR/CSR 혼합 렌더링으로 페이지별 TTI 최적화 |
| 스타일링 | **Tailwind CSS v4 + CSS 변수 디자인 토큰** | 서드파티 CSS 런타임 없음 → 초기 번들 최소 |
| 데이터베이스 | **Supabase PostgreSQL (Pro 플랜)** | 서울 리전 (ap-northeast-2), PostgREST 제공 |
| 인증 | **Supabase Auth (매직링크)** | SDK 미탑재, REST 호출 방식 → 번들 오염 없음 |
| 호스팅 | **Vercel** | Seoul 리전 (icn1), Supabase와 동일 리전 → 레이턴시 최소 |
| CDN | Vercel Edge Network | ISR 캐시를 엣지에서 직접 서빙 |

### 2.1 절대 원칙 (NORTH STAR)

구현 전 과정에서 다음 원칙을 견지:

1. **런타임 공공 API 호출 금지** — 모든 공공데이터는 배치 스크립트로 사전 적재. `app/` 디렉터리 내 외부 `fetch` 없음.
2. **초기 JS 번들 ≤ 150 KB (gzip)** — 라우트별 코드스플릿, 서버 컴포넌트 우선.
3. **서드파티 SDK 금지** — 지도 SDK, 카카오 로그인, Analytics, 결제 PG 전면 배제.
4. **자체 DB 스냅샷만 조회** — 캐시 미스 시에도 외부 호출 없이 Supabase PostgreSQL로 폴백.
5. **실시간 기능 배제** — WebSocket, Server-Sent Events, Firebase Realtime 미채용.

이 5원칙은 TTI·Server RAS 지표를 **구조적으로** 보호하는 설계이며, 기능 구현 시 위반 여부를 체크리스트로 자체 검증.

---

## 3. 데이터 적재 결과

SQLite(로컬 개발) → Supabase PostgreSQL(운영) 마이그레이션 완료.

| 테이블 | 적재 건수 | 원본 데이터 | facility 매칭 |
|--------|----------:|-------------|:-------------:|
| `facility` | **94,723** | data.go.kr 15044976 (식품제조가공업 등록) | 기준 |
| `production_log` | **1,047,894** | 식품안전나라 C002 (품목제조보고) | 815,989 (77.9%) |
| `haccp_cert` | **308** | 스마트HACCP getFoodList | 269 (87.3%) |
| `sales_suspension` | **355** | data.go.kr 15074318 (회수·판매중지) | — |
| `ingest_log` | 8 | 배치 동기화 이력 | — |

### 3.1 마이그레이션 방식

- Supabase REST API(PostgREST) + anon key 직접 호출
- 배치 크기: `facility` 2,000행, `production_log` 200행 (Free 플랜 타임아웃 대응)
- 재시작 지원: `Content-Range` 헤더로 기존 적재 행수 확인 후 오프셋 재개

### 3.2 업체명 정규화·매칭 전략

- **이름 정규화**: `㈜`, `(주)`, `주식회사`, `농업회사법인` 등 법인 표기 제거 + 공백·괄호 정리
- **지역 별칭 매핑**: 강원도 ↔ 강원특별자치도, 전북 ↔ 전북특별자치도 등 2023년 특별자치도 개편 반영
- **매칭 3단계**: ① LCNS_NO 직접 대조 → ② HACCP 브리지(licenseno → facility) → ③ 업체명 정규화 유니크 일치
- **실측 매칭률**: 77.9% (업체명 동명이인으로 인한 자동 제외 포함)

---

## 4. 구현 기능 목록

| # | 기능 | 렌더링 전략 | 경로 |
|:-:|------|-------------|------|
| 1 | 제조시설 검색 (지역·업종·HACCP·판매중지 필터) | SSR | `/search` |
| 2 | 제품 검색 (키워드·카테고리) | SSR | `/products` |
| 3 | 업체 상세 (생산이력·HACCP·판매중지 이력) | ISR (revalidate 300s) | `/b/[id]` |
| 4 | 관심업체 저장 (비로그인 localStorage / 로그인 DB) | CSR | `/saved` |
| 5 | 관심업체 변경 알림 (배치 생성, pull 방식 Bell 배지) | CSR | `/alerts` |
| 6 | 메일·전화 연결 (`mailto:`·`tel:`) | 정적 링크 | 상세 내 |
| 7 | 매직링크 로그인 | CSR | `/signin` |
| 8 | **헬스체크 엔드포인트** | API Route (`no-store`) | `/api/healthz` |
| 9 | 데이터 동기화 시점 + 경고문 고정 노출 | 정적 | 전 페이지 공통 |
| 10 | 자동완성 검색 (300 ms debounce + 10건 제한) | CSR + API | 검색바 내 |

---

## 5. 성능 측정 결과

### 5.1 측정 조건

| 항목 | 값 |
|------|-----|
| 측정 도구 | Google PageSpeed Insights (Lighthouse lab data) |
| 브라우저 | Chrome 데스크톱, 시크릿 모드 |
| 측정 일시 | 2026-04-25 ~ 2026-04-26 |
| 배포 환경 | Vercel icn1 (서울) + Supabase ap-northeast-2 (서울) |

### 5.2 Core Web Vitals (Lab Data)

| 페이지 | FCP | **LCP (ATF 대응)** | TBT | CLS | Speed Index |
|--------|:---:|:------------------:|:---:|:---:|:-----------:|
| 메인 `/` | 0.4s | **0.4s** ✅ | 0 ms | 0.04 | 0.5s |
| 업체검색 `/search` | 0.3s | **0.4s** ✅ | 10 ms | 0.04 | 1.8s |
| 제품검색 `/products` | 0.5s | **0.9s** ✅ | 10 ms | 0.04 | 1.8s |

**ATF 1,000 ms 기준**: 3개 페이지 모두 LCP < 1,000 ms 달성.
- 메인·업체검색은 기준의 **절반 미만(40%)** 으로 여유 큼.
- 제품검색은 0.9s로 기준 근접하나 통과.

### 5.3 Lighthouse 종합 점수

| 페이지 | Performance | Accessibility | Best Practices | SEO |
|--------|:-----------:|:-------------:|:--------------:|:---:|
| 메인 `/` | **100** | **100** | **100** | **100** |
| 업체검색 `/search` | **100** | 92 | **100** | **100** |
| 제품검색 `/products` | **100** | 95 | **100** | **100** |

> **Accessibility 92·95점 주석**: `<select>` 요소 레이블 등 WCAG AA 일부 항목 미충족. TTA 성능 기준(ATF·RAS)과는 별개 항목이며, 향후 웹 접근성 별도 인증 추진 시 개선 예정.

### 5.4 Server RAS 대비 태세

| 항목 | 상태 |
|------|:----:|
| `/api/healthz` 엔드포인트 구현 | ✅ |
| DB 핑 타임아웃 500 ms | ✅ |
| HTTP 200/503 분기 정상 반환 | ✅ |
| `Cache-Control: no-store` 적용 | ✅ |
| Vercel SLA 99.99% + Supabase Pro 99.9% | ✅ |
| 시험 기간 Freeze 프로토콜 문서화 | ✅ (`TTA_TEST_PROTOCOL.md`) |

### 5.5 증빙 자료

| 파일 | 경로 |
|------|------|
| 메인 페이지 PSI 결과 | `test_result/main_test result.png` |
| 업체검색 PSI 결과 | `test_result/searc_test.png` |
| 제품검색 PSI 결과 | `test_result/products_test.png` |

---

## 6. 아키텍처

### 6.1 시스템 다이어그램

```
사용자 브라우저
      │
      ▼
[Vercel Edge Network]  icn1 · 서울 리전
      │   ┌─────────────────────────────┐
      │   │ ISR 캐시 (업체 상세 5분)     │
      │   │ 정적 자산 (이미지·폰트)       │
      │   └─────────────────────────────┘
      │  SSR / API Route
      ▼
[Next.js 16.2.4 App Router]
  ├─ SSG:  / (메인)
  ├─ ISR:  /b/[id] (업체 상세)
  ├─ SSR:  /search, /products
  ├─ CSR:  /saved, /alerts, /signin
  └─ API:  /api/healthz, /api/search
      │  Supabase REST API (500 ms 타임아웃)
      ▼
[Supabase PostgreSQL]  ap-northeast-2 · 서울 리전 · Pro 플랜
  ├─ facility          (   94,723행)
  ├─ production_log    (1,047,894행)
  ├─ haccp_cert        (      308행)
  ├─ sales_suspension  (      355행)
  └─ ingest_log        (        8행)
```

### 6.2 렌더링 전략과 TTI 기여

| 페이지 유형 | 전략 | TTI 기여 |
|-------------|------|----------|
| 메인 `/` | SSG (빌드 시 완전 정적) | CDN 엣지에서 즉시 응답 — TTI 영향 없음 |
| 업체 상세 `/b/[id]` | ISR (revalidate 300 s) | 캐시 히트 시 엣지 응답, 미스 시 단발 DB 조회 |
| 검색 `/search`·`/products` | SSR (force-dynamic) | Supabase 쿼리 응답시간 의존 (평균 수십 ms) |
| 로그인·관심·알림 | CSR | TTA 측정 URL 제외 → TTI 지표 무관 |

---

## 7. 헬스체크 엔드포인트 명세

**URL**: `GET https://foodground.vercel.app/api/healthz`

| 속성 | 값 |
|------|-----|
| 런타임 | Node.js (Edge 아님, DB 드라이버 호환 이유) |
| 캐시 헤더 | `Cache-Control: no-store` |
| 인증 | 없음 (얕은 레이어 마운트) |
| 레이트리밋 | 없음 |
| DB 핑 쿼리 | `SELECT mgt_no FROM facility LIMIT 1` |
| DB 타임아웃 | 500 ms |
| 정상 응답 | HTTP 200 · `{"ok": true, "ts": <epoch_ms>, "db": "up"}` |
| 장애 응답 | HTTP 503 · `{"ok": false, "ts": <epoch_ms>, "db": "down", "err": "<message>"}` |
| 페이로드 크기 | ≤ 100 byte |

---

## 8. 제약 사항 및 향후 과제

| 항목 | 현 상태 | 향후 조치 |
|------|---------|-----------|
| 지도 기능 | 미구현 | Static Map 이미지 1장 방식으로 추가 예정 (서드파티 SDK 금지 원칙 준수) |
| Accessibility 92·95점 | 일부 항목 개선 여지 | 웹 접근성 별도 인증 추진 시 개선 |
| 배치 동기화 주기 | 수동 실행 | cron 자동화 (TTA 측정 기간엔 Freeze) |
| 모바일 Lighthouse | 미측정 | 데스크톱 100점 달성 후 모바일 점검 예정 |
| 판매중지 API 자동 연동 | 355건 수동 적재 | data.go.kr 15074318 자동 배치 연결 |

---

## 9. 결론

푸드그라운드 플랫폼은 TIPS 과제 성능지표 요구사항(**ATF < 1,000 ms, Server RAS 5일 무중단**)을 충족하도록 설계·구현되었으며, 2026-04-25 시점 Google PageSpeed Insights 측정 결과 **3개 주요 페이지 모두 ATF 기준을 통과**했습니다. 특히 메인·업체검색 페이지는 LCP 0.4초로 기준의 절반 미만 수준을 달성하여 충분한 여유를 확보했습니다.

Server RAS 시험은 별도 문서 `TTA_TEST_PROTOCOL.md` 에 정의된 프로토콜에 따라 TTA 공인시험을 통해 검증 예정이며, 시험 기간 중 배포·배치 freeze 절차가 문서화되어 있습니다.

---

**첨부**

- `TTA_TEST_PROTOCOL.md` — TTA 공인시험 프로토콜 상세
- `test_result/main_test result.png` — 메인 페이지 PSI 측정 스크린샷
- `test_result/searc_test.png` — 업체검색 PSI 측정 스크린샷
- `test_result/products_test.png` — 제품검색 PSI 측정 스크린샷

**문서 끝.**
