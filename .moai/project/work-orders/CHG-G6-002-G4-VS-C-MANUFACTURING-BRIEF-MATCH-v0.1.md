# CHG-G6-002 G4 VS-C 제품화 브리프·근거형 공동제조 후보 v0.1

## 1. 목표

실제 제품 또는 레시피에서 시작한 선택 맥락을 `제품화 브리프 → 제조요건 → 공동제조 후보 → 시설 근거 상세`까지 유지한다. 후보는 과거 F1 모델 점수나 임의 추천점수가 아니라, 308개 제조 프로필 중 시설키가 직접 연결된 265개에 대해 제품유형·CCP·지역·HACCP 근거를 항목별로 판정한다.

## 2. 권위 기준

1. `.moai/project/approvals/CHG-G6-002-DOCUMENT-GATE-APPROVAL.md`
2. `docs/design/chg-g6-002-integration-gate-1/`
3. `docs/qa/chg-g6-002-vs-a-asset-mapping.md`
4. `docs/qa/chg-g6-002-vs-b-product-facility-evidence.md`
5. `03_공동제조 매칭 정확도(F1 SCORE)/03_테스트데이터셋/company_profiles.csv`
6. `data/derived/chg-g6-002/company_profile_facility_mapping.csv`
7. 기존 Foodground SQLite — `FOODGROUND_SOURCE_DB`, 읽기 전용

## 3. 입력 계약

- 시작 맥락: `product` 또는 `recipe`, 식별자, 표시명
- 필수 확인값: 제품유형 1개
- 선택값: 희망지역 1개, 필수 CCP 복수, 가열공정 필요, 살균공정 필요
- 제품 카테고리는 초기값으로 전달할 수 있으나 사용자가 브리프에서 확인한다.
- 레시피는 제품유형을 자동 추정하지 않고 사용자가 직접 선택한다.

## 4. 후보 계약

- `linked`이고 `needs_review=false`인 265개 프로필만 후보 모수로 사용한다.
- `ambiguous` 4개와 `unlinked` 39개는 공개 후보에서 제외한다.
- 제품유형은 표준화 후 정확 일치만 허용한다.
- 각 활성 조건을 `충족`, `미충족`, `미확인`으로 표시한다.
- 후보 정렬은 전체 충족 → 추가 확인 → 충족 근거 수 → 업체명 순이다.
- 결과에는 임의 확률·AI 추천·과거 F1을 표시하지 않는다.
- 시설키로 실제 시설 기본정보를 읽기 전용 조회하고 시설 상세로 연결한다.

## 5. 화면·API

- `/manufacturing-brief`: 시작 맥락과 제조요건 입력
- `/manufacturing-candidates`: 브리프 고정 요약, 후보 근거 비교, 시설 상세 연결
- `/api/manufacturing/candidates`: 동일 규칙의 구조화 결과
- 제품 상세와 레시피 상세에서 브리프로 진입한다.
- Header와 홈에서 `공동제조` 진입점을 제공한다.
- 시설 상세에서 전달된 제품화 맥락과 요건을 다시 표시한다.

## 6. 검증

- 308 = linked 265 + ambiguous 4 + unlinked 39 불변 확인
- 검토대상 43개 공개 후보 0건
- 실제 품목·CCP·지역 조건의 충족/미충족 판정 확인
- 제품/레시피 → 브리프 → 후보 → 시설 상세 맥락 보존
- 1440×1000·390×844, 콘솔·페이지 오류와 가로 넘침 0건
- lint, typecheck, build, 기존 핵심 흐름 회귀

## 7. 금지

- 원격 Supabase·Vercel·Git 변경
- 원본 SQLite·성능평가 자료 수정
- 검토대상 43개 자동 확정
- 제품유형 자동 추정, 문자열 유사만으로 시설 연결
- F1·AI·확률을 런타임 추천점수로 오표시
- 비공개 원본 컬럼·키·개인 절대경로 노출
