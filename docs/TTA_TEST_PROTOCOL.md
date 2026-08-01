# TTA 공인 시험 프로토콜

> **문서 버전**: v1.0 (Final)
> **작성일**: 2026-04-25
> **대상 시험**: TTA Server RAS · 웹 성능(ATF) 공인시험
> **서비스 URL**: https://foodground.vercel.app
> **서비스명**: 푸드그라운드(Foodground) — 공공데이터 기반 식품제조시설 매칭 플랫폼

---

## 1. 시험 개요

### 1.1 시험 항목

| 항목 | 시험 방법 | 목표값 | 평가 도구 |
|------|-----------|--------|-----------|
| **Server RAS** (가용성·신뢰성·서비스성) | 헬스체크 엔드포인트 1초 간격 요청, 5일 연속 구동, 5분 연속 무응답 없음 | **정상** | TTA 자체 측정 장비 |
| **ATF 렌더링 성능** | Above-The-Fold 영역 주요 콘텐츠 완전 로드 시간 | **< 1,000 ms** | Google PageSpeed Insights (Lighthouse lab data) |

### 1.2 대응 표준

- ATF 측정은 Core Web Vitals **LCP (Largest Contentful Paint)** 지표와 일치.
- TTA 권고 측정 방법(Google PSI 기반 Lab Data)을 적용하여 객관성 확보.

---

## 2. Server RAS 시험 프로토콜

### 2.1 시험 정의

> **"서비스 서버에 1초 간격으로 요청을 보내고, 응답을 받을 시와 5일간 서버 종료 없이 구동하는지 확인. 5분간 응답이 없을 시 서버 응답 없음으로 간주."**

### 2.2 측정 대상 엔드포인트

```
GET https://foodground.vercel.app/api/healthz
```

**응답 명세**

| 구분 | HTTP 상태 | Body (JSON) |
|------|:---------:|-------------|
| 정상 | 200 | `{"ok": true, "ts": <epoch_ms>, "db": "up"}` |
| 장애 | 503 | `{"ok": false, "ts": <epoch_ms>, "db": "down", "err": "<message>"}` |

| 속성 | 값 |
|------|-----|
| 요청 메서드 | `GET` |
| 캐시 헤더 | `Cache-Control: no-store` (매 요청 신규 처리 보장) |
| DB 핑 타임아웃 | 500 ms |
| 정상 판정 조건 | HTTP 200 AND `"ok": true` |
| 페이로드 크기 | ≤ 100 byte |
| 인증·레이트리밋 | 없음 (얕은 레이어에서 즉시 응답) |

### 2.3 인프라 SLA 현황

| 구성 요소 | 플랜 | SLA | 리전 |
|-----------|------|-----|------|
| Vercel (호스팅·엣지) | 배포 환경 | 99.99% | 서울 (icn1) |
| Supabase PostgreSQL | Pro | 99.9% | 서울 (ap-northeast-2) |

> Supabase Pro 정기 점검은 통상 수 분 이내로 수행되며, 본 시험의 5분 무응답 기준을 초과하지 않는 범위 내에서 처리됨.

### 2.4 시험 기간 Freeze 프로토콜

#### 시험 시작 전 필수 작업

1. **배포 중단** — 시험 기간 중 `git push` 및 Vercel 재배포 금지. 인스턴스 교체 과정에서 일시적 응답 지연 발생 가능.
2. **배치 cron 중단** — DB 동기화 스크립트 실행 금지. 대용량 INSERT로 헬스체크 응답 지연 가능.
3. **Supabase 점검 일정 사전 확인** — [https://status.supabase.com](https://status.supabase.com) 에서 ap-northeast-2 리전 예정 점검 일정 확인. 시험 기간과 겹칠 경우 TTA 담당자와 일정 조율.
4. **사전 연속 구동 확인** — 시험 시작 24시간 전부터 헬스체크 URL에 수동 접근하여 정상 응답 확인.

#### 시험 진행 중 금지 사항

| 금지 행위 | 사유 |
|-----------|------|
| `git push` · Vercel 재배포 | 인스턴스 교체 중 응답 공백 |
| DB 마이그레이션 | 테이블 잠금으로 헬스체크 쿼리 블로킹 |
| 배치 동기화 스크립트 실행 | DB 부하 집중 |
| Supabase 설정 변경 | 연결 초기화 발생 |

### 2.5 장애 시 대응 절차

1. HTTP 503 또는 무응답 감지 시 → [https://status.supabase.com](https://status.supabase.com), [https://www.vercel-status.com](https://www.vercel-status.com) 에서 인프라 상태 확인
2. 인프라 장애가 확인되면 TTA 담당자에게 즉시 통보하여 측정 일시 정지 협의
3. 원인 해소 후 TTA와 재시험 또는 측정 재개 협의

---

## 3. ATF 성능 시험 프로토콜

### 3.1 시험 정의

> **"주요 이벤트 발생 시점에서부터 사용자 인터페이스의 스크롤 없이 볼 수 있는 부분(ATF)의 콘텐츠 응답 및 로드 속도가 1,000 ms 미만인지 확인."**

대응 Core Web Vitals 지표: **LCP (Largest Contentful Paint)**

### 3.2 측정 대상 URL

| # | 페이지 | URL | 측정 여부 |
|:-:|--------|-----|:---------:|
| 1 | 메인 | https://foodground.vercel.app | ✅ 필수 |
| 2 | 업체검색 | https://foodground.vercel.app/search | ✅ 필수 |
| 3 | 제품검색 | https://foodground.vercel.app/products | ✅ 필수 |
| 4 | 업체상세 | https://foodground.vercel.app/b/{mgt_no} | ✅ 필수 |
| 5 | 로그인·관심·알림 | `/signin`, `/saved`, `/alerts` | ⬜ 측정 제외 (인증 필요) |

**업체상세 테스트용 샘플 URL**:
```
https://foodground.vercel.app/b/1471932174
```

### 3.3 측정 방법 (Google PageSpeed Insights)

**권장 도구**: Google PageSpeed Insights (PSI) — `https://pagespeed.web.dev`

**측정 절차**

1. Chrome 브라우저 **시크릿 모드** 실행 (캐시·확장 프로그램 영향 배제)
2. 데스크톱 모드 선택
3. VPN 비활성화 (네트워크 경로 왜곡 방지)
4. 각 측정 대상 URL을 순서대로 PSI에 입력
5. **"Lab Data"** 섹션의 **LCP** 수치 확인
6. 동일 URL 3회 반복 측정 후 중앙값 채택

> **참고**: 신규 서비스로 Chrome User Experience Report(CrUX) 실사용자 데이터가 축적되지 않아 Lab Data(Lighthouse 측정값)를 기준으로 판정합니다.

### 3.4 실측 결과 (2026-04-25)

**측정 조건**: Chrome 데스크톱, 시크릿 모드, Google PSI, 서울 리전 배포 상태

#### Core Web Vitals (Lab Data)

| 페이지 | FCP | **LCP** | TBT | CLS | Speed Index | ATF 1,000 ms 기준 |
|--------|:---:|:-------:|:---:|:---:|:-----------:|:-----------------:|
| 메인 `/` | 0.4s | **0.4s** | 0 ms | 0.04 | 0.5s | ✅ **통과** |
| 업체검색 `/search` | 0.3s | **0.4s** | 10 ms | 0.04 | 1.8s | ✅ **통과** |
| 제품검색 `/products` | 0.5s | **0.9s** | 10 ms | 0.04 | 1.8s | ✅ **통과** |

#### Lighthouse 점수

| 페이지 | Performance | Accessibility | Best Practices | SEO |
|--------|:-----------:|:-------------:|:--------------:|:---:|
| 메인 `/` | **100** | **100** | **100** | **100** |
| 업체검색 `/search` | **100** | 92 | **100** | **100** |
| 제품검색 `/products` | **100** | 95 | **100** | **100** |

> **판정**: 3개 페이지 모두 LCP < 1,000 ms 달성. Lighthouse Performance 100점(lab 기준 LCP < 1,200 ms 대응)으로 TTA ATF 기준을 안정적으로 상회.

### 3.5 증빙 스크린샷

본 프로토콜 서류와 함께 제출되는 PSI 측정 결과 스크린샷 3건:

| 파일명 | 대상 페이지 | 측정 시각 |
|--------|-------------|-----------|
| `test_result/main_test result.png` | 메인 `/` | 2026-04-25 |
| `test_result/searc_test.png` | 업체검색 `/search` | 2026-04-26 00:14 |
| `test_result/products_test.png` | 제품검색 `/products` | 2026-04-26 00:16 |

---

## 4. 인프라 구성 다이어그램

```
[TTA 측정 장비]
      │  GET /api/healthz  (1초 간격)
      ▼
[Vercel Edge Network]
  icn1 · 서울 리전
      │
      ▼
[Next.js API Route]
  /api/healthz (runtime: nodejs)
  Cache-Control: no-store
      │  Supabase REST API  (500 ms 타임아웃)
      ▼
[Supabase PostgreSQL]
  ap-northeast-2 · 서울 리전
  Pro 플랜 (SLA 99.9%)
  SELECT mgt_no FROM facility LIMIT 1
```

**이중화·여유**: Vercel Edge ↔ Supabase 모두 서울 리전으로 왕복 네트워크 레이턴시 최소화(< 10 ms 추정). Vercel 99.99% + Supabase 99.9% SLA 조합으로 시험 기간 5일(120 시간) 기준 허용 다운타임 > 7분.

---

## 5. 제출 자료 체크리스트

### 5.1 Server RAS

- [ ] 헬스체크 엔드포인트 URL: `https://foodground.vercel.app/api/healthz`
- [ ] 정상 응답 스크린샷 (JSON 응답 포함)
- [ ] Vercel 대시보드 배포 이력 캡처 (시험 기간 중 무배포 확인)
- [ ] Supabase 점검 일정 확인 화면 (`status.supabase.com`)
- [ ] 인프라 SLA 증명 (Vercel / Supabase 플랜 확인)

### 5.2 ATF 성능

- [x] Google PSI 측정 결과 스크린샷 3건 (`test_result/*.png`)
- [x] LCP 수치 표기 (모두 < 1,000 ms 확인)
- [x] Lighthouse 점수 스크린샷 (Performance 100점 확인)
- [ ] 업체상세 `/b/{mgt_no}` 페이지 추가 측정 (TTA 공식 시험 전 완료 예정)

---

## 6. 문의 및 비상 연락

| 구성 요소 | 상태 페이지 | 문의처 |
|-----------|-------------|--------|
| Vercel | https://www.vercel-status.com | Vercel Support |
| Supabase | https://status.supabase.com | Supabase Support |
| 서비스 담당 | — | 연구책임자 (희정) |

---

**문서 끝.**
