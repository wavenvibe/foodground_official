# CHG-G6-002 Approval A: DDL Migration Execution Record

- 승인점: Approval A (DDL Migration 0028-0034)
- 승인일: 2026-08-31
- 상태: **PASS**

---

## 1. 사용자 승인 범위

### 1.1 명시적 허용

- 공식 개발 Supabase 프로젝트에 migration 0028-0034 (DDL/RLS/ACL) 적용
- 적용 후 검증 (migration history, table statistics, Data API read)

### 1.2 명시적 금지

- 데이터 적재 (staging load, public publish)
- Vercel 배포 또는 환경변수 변경
- Git commit/push/PR/merge
- 컴퓨트/디스크 변경 (디스크 리사이즈 외)
- 자격증명 노출 또는 검사

---

## 2. 대상 가드

- linked target이 승인된 공식 개발 프로젝트와 일치함을 확인: **PASS**

---

## 3. 적용된 Migration 세트

| # | Migration | 대상 |
|---|---|---|
| 0028 | products_public | public 스키마, RLS/ACL |
| 0029 | facility_products_public | VIEW (security_invoker) |
| 0030 | haccp_certifications_public | public 스키마, RLS/ACL |
| 0031 | facility_safety_public | public 스키마, RLS/ACL |
| 0032 | manufacturing_profiles_public | public 스키마, RLS/ACL |
| 0033 | private mapping + staging contracts | private/staging 스키마, REVOKE ALL |
| 0034 | load checkpoint | checkpoint 테이블, session lock/resume |

---

## 4. 실행 증거

### 4.1 Pre-Write 검증

- 정확히 7개 pending G6 migration 확인, 다른 pending migration 없음
- Dry-run에서 0028-0034 순서대로 나열 확인

### 4.2 적용 결과

- `db push` 7개 migration 전체 성공 완료
- seed, data-load, publish, Vercel, Git 작업 없음

### 4.3 Post-Write 검증

- 로컬 및 원격 migration 버전 전부 일치 확인
- 원격 테이블 통계 (모두 0행, 빈 테이블 정상):

| 테이블 | 행수 |
|---|---|
| public.products_public | 0 |
| public.haccp_certifications_public | 0 |
| public.facility_safety_public | 0 |
| public.manufacturing_profiles_public | 0 |
| private.company_profile_mapping | 0 |
| private.load_checkpoint | 0 |
| staging.production_log_raw | 0 |
| staging.haccp_cert_raw | 0 |
| staging.sales_suspension_raw | 0 |
| staging.company_profiles_raw | 0 |

- 기존 VS-2 public/staging 행수 변경 없음 확인

### 4.4 Data API 검증

- anon key를 사용한 GET 요청:
  - products_public, facility_products_public VIEW, haccp_certifications_public, facility_safety_public, manufacturing_profiles_public: 빈 SELECT 성공
  - private, staging 스키마: 노출되지 않음 확인

### 4.5 스키마 덤프

- 로컬 Docker 미사용으로 full schema dump **SKIPPED**
- 이는 migration 실패가 아님
- 원격 적용, migration history, 테이블 통계, Data API 읽기, 숨겨진 스키마, 로컬 RLS/ACL 정적 검증이 증거 세트를 구성

---

## 5. 인프라 상태 (사용자 대시보드 UI 증거)

### 5.1 디스크

- 리사이즈 전: 1.65 GB used / 4 GB provisioned
- 리사이즈 후: 8 GB (Pro 포함 할당 이내)
- Spend Cap: 활성화 (초과 과금 차단)
- 디스크 초과 과금 발생 없음
- 예상 여유 공간: ~6.35 GB (>= 2.5 GB 안전 임계값 충족)
- 롤링 디스크 수정 한도: 약 4시간 잔여 시점에서 도달. Approval A/B에 추가 디스크 변경 불필요

### 5.2 컴퓨트

- Nano 컴퓨트, 낮은 CPU, 보통 메모리, 낮은 연결 수
- 컴퓨트 변경 없음 (Micro 적용 주장하지 않음)

### 5.3 백업

- 7개 복원 가능한 일일 물리 백업 확인
- PITR: 비활성
- 복원 테스트: 수행하지 않음

---

## 6. Approval B 경계 정의

### 6.1 Approval B 상태

**미승인 / 미실행**

### 6.2 Approval B 진입 조건

- Approval A 성공 (본 문서로 충족)
- 별도의 사용자 승인 (secure DB credential 입력 포함)
- FOODGROUND_SOURCE_DB 설정 + source 파일 존재
- SUPABASE_DB_URL SecureString 입력

### 6.3 Approval B 범위

- staging 5개 dataset 적재 (chg_g6_002_staging_loader.py)
- 건수 대조 후 사용자 승인 필요
- Approval B는 별도 사용자 승인과 secure DB credential 입력 없이 실행 불가

---

## 7. 최대 안전 무인 범위

Approval A 완료 이후, 별도 사용자 승인 없이 수행 가능한 최대 범위:

1. 문서 마감 (본 문서 등 거버넌스/QA 문서 갱신)
2. 로컬 loader dry-run 및 정적 테스트
3. 정확한 Approval B 운영 체크리스트 작성

Approval B(staging load), Approval C(publish+verify)는 각각 별도의 사용자 승인과 secure DB credential 입력이 필수이다.

---

## 8. 금지 사항 (이 승인 기록에 포함하지 않은 정보)

- 개인 식별 정보
- 프로젝트 ref, 조직명, 프로젝트명
- 비밀키, DSN, 자격증명
- 백업 ID, 정확한 백업 타임스탬프
- 원본 파일 경로, 핑거프린트
- Raw row 데이터
