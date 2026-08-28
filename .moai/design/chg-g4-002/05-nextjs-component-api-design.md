# 05. Next.js component and API design

- Status: REVIEW READY
- Gate: G3-07
- Change ID: CHG-G4-002
- Application code edits: PROHIBITED UNTIL USER APPROVAL

## 1. 실제 코드 구조 감사

### 1.1 런타임 스택 (package.json 기반)

- **Next.js 16** App Router (App Router 전용 — Pages Router 없음)
- React 19
- TypeScript
- Tailwind CSS 4 (CSS 변수 기반)
- Supabase JS client

### 1.2 현재 코드 구조 (감사 결과)

```
app/
  page.tsx                      — 홈 (Codex 수정됨, 동결)
  globals.css                   — 글로벌 스타일 (동결)
  b/[id]/page.tsx               — 구 시설 상세 (동결)
  components/SearchForm.tsx     — 검색 폼 컴포넌트 (동결)
  search/page.tsx               — 구 검색 결과 (동결)
  api/search/facilities/        — 구 API 라우트 (동결)
  facilities/                   — 신규 프로토타입 라우트 (동결)

components/
  FacilityCardItem.tsx          — 시설 카드 (동결)
  Header.tsx                    — 헤더 (동결)
  StatePanel.tsx                — 상태 패널 (동결, 미추적)
  facilities/                   — 시설 컴포넌트 (동결, 미추적)

lib/
  facilities.ts                 — 시설 데이터 유틸 (동결)
  supabase-public-server.ts     — Supabase 서버 클라이언트 (동결)

supabase/                       — 구 migration 파일 (동결)
```

**처리 결정**: 모든 Codex 프로토타입 파일은 동결 상태다. G3 승인 후 아래 설계를 기반으로 신규 구현하거나 선택적으로 병합한다.

> **Next.js 16 주의사항**: App Router의 Server/Client 컴포넌트 경계, searchParams API, cache/revalidation 방식은 학습 데이터와 다를 수 있다. 구현 전 `node_modules/next/dist/docs/` 로컬 문서를 반드시 확인한다.

## 2. 라우트·렌더링 경계

| 라우트 | 목적 | Server/Client 경계 | 데이터 접근 | cache·revalidation | 호환 정책 |
|---|---|---|---|---|---|
| / | 홈·진입 | Server Component | 없음 | static | — |
| /facilities | 시설 목록 | Server Component (검색/필터 params) + Client (필터 UI) | Supabase anon (서버) | revalidate 3600 | /search → /facilities redirect |
| /facilities/[id] | 시설 상세 | Server Component | Supabase anon (서버) | revalidate 3600 | /b/[id] → /facilities/[id] redirect |
| /recipes | 레시피 목록 | Server Component + Client 필터 | Supabase anon (서버) | revalidate 3600 | — |
| /recipes/[id] | 레시피 상세 | Server Component | Supabase anon (서버) | revalidate 3600 | — |
| /ingredients | 식재료 목록 | Server Component + Client 필터 | Supabase anon (서버) | revalidate 3600 | — |
| /ingredients/[id] | 식재료 상세 | Server Component | Supabase anon (서버) | revalidate 3600 | — |
| /substitutes | 대체 식재료 | Client Component (검색 인터랙티브) | API Route → Supabase (서버 경유) | no-store | — |
| /label-guide | 법령안내 (조건부) | Server Component | 정적 콘텐츠 | static | 자료 미제공 시 비노출 |
| /api/facilities | 시설 API | Route Handler (서버) | Supabase 서버 anon 클라이언트 + RLS | no-store | — |
| /api/substitutes | 대체 식재료 API | Route Handler (서버) | Supabase 서버 anon 클라이언트 + RLS | no-store | — |

**Server/Client 원칙**:
- 기본은 Server Component로 렌더링 (초기 로드 성능, SEO)
- 인터랙티브 필터·검색·상태 관리만 Client Component로 분리
- **공개 런타임 anon 클라이언트**: Route Handler 포함 모든 서버 사이드 공개 조회는 `SUPABASE_ANON_KEY` 사용 + RLS. service-role은 브라우저 번들·Route Handler 런타임에 절대 사용 금지 (B-06)
- service-role은 VS-2 migration·적재·관리 작업 전용 (서버 CLI 전용 환경변수)

## 3. 컴포넌트 계약

### 3.1 공통 레이아웃

| 컴포넌트 | 타입 | Props | 역할 |
|---|---|---|---|
| RootLayout | Server | children | HTML shell, 폰트, 글로벌 CSS |
| Header | Client | currentPath | 네비게이션, 현재 라우트 강조 |
| StatePanel | Client | state, message, children, onRetry? | 8개 상태 통합 패널 |
| Pagination | Client | total, page, pageSize, onPageChange | 페이지네이션 |

### 3.2 시설 관련 컴포넌트

| 컴포넌트 | 타입 | Props | 역할 |
|---|---|---|---|
| FacilityList | Server | facilities[], meta | 시설 목록 (카드 그리드) |
| FacilityCard | Server | facility | 시설 카드 (이름·지역·업종·HACCP) |
| FacilityFilter | Client | filters, onChange | 지역·업종·HACCP·상태 필터 |
| FacilityDetail | Server | facility | 시설 상세 (공개 필드: mgt_no, name, region, business_type, is_haccp, status, tel, homepage; product_types는 Q-06 해소 후 조건부 추가) |
| ContactButton | Client | facilityName, tel?, homepage? | 문의문안 복사 기본 + tel/homepage 보조 표시. email 없으므로 mailto 기본 비활성 (B-06) |

### 3.3 대체 식재료 컴포넌트

| 컴포넌트 | 타입 | Props | 역할 |
|---|---|---|---|
| SubstituteSearch | Client | — | 기준 식재료 검색 입력 |
| SubstituteCandidateList | Client | candidates[] | 대체 후보 목록 (순위·지표) |
| SimilarityBar | Client | value, label | 유사도 지표 시각화 (바 차트) |
| NutritionTable | Client | source, target | 영양 비교 테이블 |
| MatchTypeBadge | Client | matchType | 'exact'/'substring'/'fuzzy'/'synonym'/'none' 5가지 매칭상태 배지 |
| ProvenanceBadge | Client | basisDate, matchType | 계보·기준일 배지 |
| LimitationNotice | Server | — | 한계 고지 (항상 표시, static) |

### 3.4 조건부 법령안내 컴포넌트

| 컴포넌트 | 타입 | Props | 역할 |
|---|---|---|---|
| LabelGuideSearch | Client | — | 정적 콘텐츠 키워드 검색 |
| LabelGuideFAQ | Server | faqItems[] | FAQ 목록 |
| LegalDisclaimerBanner | Server | basisDate | 기준일·면책고지 (항상 표시) |

## 4. 서버 API 설계

### 4.1 GET /api/facilities

```
요청: GET /api/facilities?q=&region_sido=&business_type=&is_haccp=&status=&page=1&pageSize=20&sort=relevance
검증:
  - q: 100자 이내, sanitize
  - pageSize: 1~50, 기본 20
  - sort: allowlist ['relevance', 'name', 'region']
  - 나머지 필터: allowlist 값 검증

응답 200:
  { data: Facility[], meta: { total, page, pageSize, hasMore }, traceId }

응답 400:
  { error: { code: 'FG_INVALID_INPUT', message: '...', retryable: false }, traceId }

응답 503:
  { error: { code: 'FG_DATA_UNAVAILABLE', message: '...', retryable: true, fallback: 'retry' }, traceId }
```

### 4.2 GET /api/facilities/[id]

```
요청: GET /api/facilities/[id]
검증: id = mgt_no (TEXT, URL-encoded) — UUID 형식 검증 불가, 길이·허용문자 검증으로 대체 (B-07)

응답 200: { data: FacilityDetail, traceId }
응답 404: { error: { code: 'FG_NOT_FOUND', message: '...', retryable: false }, traceId }
```

### 4.3 GET /api/substitutes

```
요청: GET /api/substitutes?ingredient=&page=1&pageSize=20
검증:
  - ingredient: 필수, 100자 이내
  - pageSize: 최대 20 (대체 후보 전용)

응답 200: { data: SubstituteCandidate[], meta: {...}, traceId }
응답 200 (no-candidate): { data: [], meta: { total: 0 }, warning: 'FG_NO_CANDIDATE', traceId }
```

### 4.4 보안 원칙 (B-06)

- **공개 런타임**: Route Handler 포함 모든 서버 사이드는 `SUPABASE_ANON_KEY` + RLS 사용. service-role을 Route Handler에서 사용하지 않는다.
- **service-role 범위**: VS-2 migration·적재 CLI 전용. 브라우저 번들과 Route Handler 런타임에 포함 금지.
- 클라이언트에 SQL, 테이블명, provider URL, stack trace 노출 금지
- 입력값 sanitize: PostgREST 필터 조합 전 allowlist 검증
- 이메일 주소 추정·수집 금지 (원본에 email 컬럼 없음)
- rate limiting: Vercel Edge 또는 미들웨어 수준 (구현 단계에서 확정)

## 5. 교차 흐름과 URL 상태

### 5.1 대체 후보 → 공동제조 조건 전달

```
/substitutes?ingredient=설탕 → 후보 선택
  → /facilities?business_type=제과제빵 (URL param 전달; Q-06 미결정)
       ※ product_types URL 파라미터: Q-06 해소 후 조건부 추가 → /facilities?business_type=제과제빵&product_types=과자류
       ※ Q-06 미해소 시 업종·지역·HACCP·영업상태 파라미터로 동작
```

### 5.2 검색·필터·정렬·페이지 상태 유지

- URL searchParams로 상태 유지 (새로고침·공유 가능)
- 뒤로가기 시 이전 검색 결과 복원 (Next.js App Router 기본 동작 활용)

### 5.3 잘못된 파라미터 처리

- 허용 값 외 filter 파라미터: 무시 (FG_INVALID_INPUT 미반환, 빈 필터로 처리)
- 범위 초과 page: FG_INVALID_INPUT 반환
- 없는 id: 404 not-found 상태

## 6. 문의 흐름과 ContactButton (B-06)

### 6.1 ContactButton 기본 동작 (이메일 없음 → 복사 기본)

원본 facility 테이블에 email 컬럼이 없으므로 문의문안 복사가 기본 동작이다.

```typescript
// ContactButton: 문의문안 복사 기본 + tel/homepage 보조
const inquiryText = `안녕하세요, ${facilityName} 담당자님.\n공동제조 관련 문의드립니다.\n`;

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(inquiryText);
    setFeedback('복사되었습니다'); // 1초 후 복원
  } catch {
    // 복사 실패 → 텍스트 영역 선택 유도
    textareaRef.current?.select();
  }
}
```

### 6.2 보조 연락 정보 표시

```
tel이 있으면 → 전화번호 표시 (tel: 링크)
homepage가 있으면 → 홈페이지 링크 표시
```

### 6.3 별도 승인 이메일 확보 시 (추후 활성화)

```typescript
// 별도 이메일 소스 확보 + 이용권한·공개범위·mgt_no 연결 확인 후 활성화
const subject = encodeURIComponent(`[공동제조 문의] ${facilityName}`);
const body = encodeURIComponent(inquiryText);
const mailtoUrl = `mailto:${approvedEmail}?subject=${subject}&body=${body}`;
window.location.href = mailtoUrl;
// 메일앱 미지원 시 → 복사 fallback
```

### 6.4 금지 표현

- "발송 완료" → 사용 금지 (메일 앱을 열 뿐, 실제 발송은 사용자가 확인 후 실행)
- "메일 전송" → "메일 앱 열기" 또는 "문의 초안 열기"로 대체
- 이메일 주소 추정·수집 금지 (원본에 email 컬럼 없음 — 별도 승인 소스 없이 mailto 비활성)

## 7. 디자인 토큰과 반응형

### 7.1 색상 토큰 (g3-03-option2 방향)

| 토큰 | 값 | 용도 |
|---|---|---|
| --color-canvas | #F1F1EE | 페이지 배경 |
| --color-slate | #31394D | 주요 텍스트 |
| --color-point-green | #03C75A | CTA, 강조 포인트 (절제) |
| --color-surface | #FFFFFF | 카드, 패널 배경 |
| --color-ink | #20242C | 제목, 강조 텍스트 |
| --color-muted | #667085 | 보조 텍스트, 메타 정보 |
| --color-rule | #D7DBE1 | 구분선 |

**그린 사용 원칙**: 페이지 전체 장식 채우기 금지. CTA 버튼, 강조 배지, 액티브 상태 등 포인트 용도에만 사용.

### 7.2 반응형 레이아웃

| 화면 | 너비 | 시설 목록 | 필터 |
|---|---|---|---|
| 모바일 | 390px | 1컬럼 카드 | 하단 시트 또는 드롭다운 |
| 데스크톱 | 1440px | 3~4컬럼 그리드 | 좌측 패널 240px |

390px 레이아웃:
- 가로 스크롤 없음
- 텍스트 클리핑 없음 (overflow ellipsis + max-width 적용)
- 터치 타깃 최소 44x44px

## 8. 기존 프로토타입 처리

| 파일/폴더 | 처리 결정 | 근거 |
|---|---|---|
| app/b/[id]/page.tsx | redirect → /facilities/[id] | 호환 경로 유지 |
| app/search/page.tsx | redirect → /facilities | 호환 경로 유지 |
| app/page.tsx | 신규 설계로 교체 (G3 승인 후) | 홈 구조 변경 필요 |
| app/components/SearchForm.tsx | 선택적 병합 (G3 승인 후 검토) | 재사용 가능 컴포넌트 |
| app/facilities/ | 신규 라우트 구현에 활용 (G3 승인 후) | 구조 참조 |
| app/api/search/facilities/ | 신규 API 설계로 교체 | 현재 설계와 다름 |
| components/FacilityCardItem.tsx | 선택적 병합 (G3 승인 후 검토) | 재사용 가능 |
| components/StatePanel.tsx | 선택적 병합 (G3 승인 후 검토) | 8개 상태 구현 |
| lib/supabase-public-server.ts | 교체 (새 프로젝트 env var 반영) | 환경변수 신규 설정 필요 |
| supabase/ | 참조만 — Codex 가설 마이그레이션 | 실제 migration은 VS-2에서 신규 작성 |

## 완료 확인

- [x] 실제 코드와 Next.js 16 문서 기반 설계
- [x] Server/Client·cache·error 경계 정의
- [x] 컴포넌트·API·URL 상태 계약 정의
- [x] 공개 런타임: Route Handler + Server Component 모두 anon 클라이언트 + RLS (service-role 공개 런타임 금지) (B-06)
- [x] ContactButton: 복사 기본, tel/homepage 보조, 별도 이메일 확보 시 mailto 활성화 (B-06)
- [x] facilities ID: mgt_no TEXT — UUID 검증 제거 (B-07)
- [x] 금지 표현 목록 명시 (발송완료, 이메일 추정·수집)
- [x] 기존 프로토타입 처리 결정 (동결 → G3 승인 후 선택적 병합)
