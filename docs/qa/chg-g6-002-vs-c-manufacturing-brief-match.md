# CHG-G6-002 VS-C 제품화 브리프·근거형 공동제조 후보 QA

- 상태: PASS
- 기준일: 2026-08-30
- 실행환경: `foodground_official` 로컬 production build + 원본 SQLite 읽기 전용 연결
- 작업지시서: `.moai/project/work-orders/CHG-G6-002-G4-VS-C-MANUFACTURING-BRIEF-MATCH-v0.1.md`

## 1. 구현 결과

제품 또는 레시피에서 시작한 맥락을 제품화 브리프, 공동제조 후보, 실제 시설 근거 상세와 문의 문안까지 전달했다. 제품유형은 사용자 확인을 필수로 하고, 선택한 지역·CCP·가열·살균 조건을 각 후보의 공개 근거와 항목별로 비교한다.

구현 경로:

- `/manufacturing-brief`
- `/manufacturing-candidates`
- `/api/manufacturing/candidates`
- 제품 상세·레시피 상세의 `제품화 브리프 작성`
- 후보의 `업체 제품·HACCP 근거 검증`
- 시설 상세의 `PRODUCTIZATION CONTEXT`

## 2. 후보 모수·경계 검증

| 항목 | 결과 |
|---|---:|
| 전체 제조 프로필 | 308 |
| 직접 시설 연결·공개 후보 모수 | 265 |
| ambiguous | 4 |
| unlinked | 39 |
| 공개 후보에서 제외한 검토대상 | 43 |

- 제품유형은 NFKC·공백 표준화 후 정확 일치만 허용했다.
- 검토대상 43개는 후보 응답에 0건 포함됐다.
- 시설 기본정보는 `facility_mgt_no` 직접키로 원본 SQLite를 조회했다.
- 과거 XGBoost·F1, 임의 확률, AI 추천점수는 런타임에 사용·표시하지 않았다.

## 3. 실제 데이터 판정

| 입력 | 품목 일치 | 전체 충족 | 추가 확인 | 확인 내용 |
|---|---:|---:|---:|---|
| 과자 | 46 | 46 | 0 | 제품유형+시설·HACCP 직접연결 2/2 |
| 과자 + 경상북도 + CCP-S01 | 46 | 5 | 41 | 경동한과·배반유과 등 4/4 충족 |
| 과자 + CCP-S16 + 살균 필요 | 46 | 0 | 46 | 미충족 조건을 숨기지 않고 표시 |

후보 카드에는 제품유형, 시설·HACCP 직접연결, 희망지역, 각 필수 CCP, 가열·살균 조건을 `충족/미충족/미확인`으로 표시한다. 전체 충족 후보를 먼저 정렬하고 상위 12개를 화면에 표시하며 전체 품목 일치·충족·추가확인 건수는 별도로 유지한다.

## 4. 브라우저 QA

명령:

```text
npx playwright test e2e/chg-g6-002-vs-c.spec.ts --reporter=list
```

결과: **4 passed, 0 failed**

- desktop 1440×1000
- mobile 390×844
- 제품 `버터그린밀` → 제품화 브리프 → 과자·경상북도·CCP-S01 → 후보 → 경동한과 시설 상세
- 선택 맥락·제품유형·지역·필수 CCP 유지
- 실제 생산제품·HACCP·CCP 섹션 표시
- 콘솔 오류 0, 페이지 오류 0, 가로 넘침 0

스크린샷:

- `output/playwright/chg-g6-002-vs-c/desktop-brief.png`
- `output/playwright/chg-g6-002-vs-c/desktop-candidates.png`
- `output/playwright/chg-g6-002-vs-c/desktop-facility-context.png`
- `output/playwright/chg-g6-002-vs-c/mobile-brief.png`
- `output/playwright/chg-g6-002-vs-c/mobile-candidates.png`
- `output/playwright/chg-g6-002-vs-c/mobile-facility-context.png`

## 5. 정적 게이트

| 검사 | 결과 |
|---|---|
| `npm run lint` | PASS, 오류 0·기존 경고 5 |
| `npx tsc --noEmit` | PASS, 오류 0 |
| `npm run build` | PASS, 신규 라우트 포함 |

## 6. 발견·교정 사항

1. UTF-8 BOM이 있는 프로필 CSV의 첫 헤더가 달라져 308개가 모두 제외되는 문제를 발견하고 BOM 제거 파서를 적용했다.
2. 시설 상세가 로컬 원본 근거를 확보한 뒤에도 원격 공개조회 응답을 기다리던 지연을 교정했다. 읽기 전용 원본 근거가 있으면 이를 우선하고, 원본이 없을 때 기존 공개 Supabase 경로를 사용한다.
3. 문의문안이 시설 근거보다 먼저 보이던 순서를 생산제품·HACCP·CCP·안전정보 검증 뒤로 이동했다.
4. 후보 46개 전체를 한 화면에 길게 표시하지 않고 판정 우선순위 상위 12개와 전체 건수를 분리했다.

## 7. 변경 없음

- 기존·신규 Supabase 원격 변경·적재 없음
- Vercel Preview·Production·환경변수 변경 없음
- Git commit·push·PR·merge·브랜치 변경 없음
- 원본 SQLite·F1 자료 변경 없음
- 개인 설정·Claude 훅·예약작업 변경 없음
