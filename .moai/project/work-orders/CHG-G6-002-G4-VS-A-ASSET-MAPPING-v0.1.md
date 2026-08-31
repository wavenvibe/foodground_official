# CHG-G6-002 G4 VS-A 자산·매핑 구현 작업지시서 v0.1

## 1. 목표

본판 화면 구현 전에 기존 Foodground의 제품·업체·HACCP·판매중지와 TIPS 공동제조 프로필을 가짜 연결 없이 재현 가능한 로컬 데이터계약으로 고정한다.

이번 슬라이스의 결과는 화면이 아니라 다음 슬라이스가 신뢰할 수 있는 `mapping registry + 공개 projection 계약 + dry-run 검증기 + migration 초안`이다.

## 2. 권위 기준

1. `.moai/project/approvals/CHG-G6-002-DOCUMENT-GATE-APPROVAL.md`
2. 루트 `00_프로젝트관리/푸드그라운드_CHG-G6-002_DATA-GATE_판정_v0.1.md`
3. 루트 `02_문서/00_최신리비전_CHG-G6-002/03_설계기술/`
4. `docs/design/chg-g6-002-integration-gate-1/asset-parity-matrix.md`
5. 원본 `D:/0. 업무/foodground/data/foodground.db` — SQLite `mode=ro`
6. `03_공동제조 매칭 정확도(F1 SCORE)/03_테스트데이터셋/company_profiles.csv` — 읽기 전용

충돌 시 사용자 승인과 더 보수적인 데이터·보안·미연결 처리 기준을 우선한다.

## 3. 기대 기준값

| 자산 | 기준값 |
|---|---:|
| facility | 94,723 |
| production_log | 1,047,894 |
| 고유 report_no | 1,047,894 |
| 제품 시설 직접연결 | 815,989 |
| 제품 시설 미연결 | 231,905 |
| haccp_cert | 308 |
| HACCP 시설 직접연결 | 269행·261시설 |
| company_profiles | 308 |
| 단일시설 프로필 | 265 |
| 복수시설 프로필 | 4 |
| 시설 미연결 프로필 | 39 |
| sales_suspension | 355 |
| 판매중지 시설 직접연결 | 103 |

실측값이 다르면 코드를 기준값에 맞추지 말고 원인과 실제값을 보고하고 중단한다.

## 4. 구현 산출물

### 4.1 감사·매핑 코드

- `scripts/chg_g6_002_audit_assets.py`
  - 모든 SQLite 연결은 `mode=ro`
  - 표·컬럼·건수·고유키·시설 FK 고아를 검사
  - 자격증명·개별 민감값을 출력하지 않음
- `scripts/chg_g6_002_build_profile_mapping.py`
  - `company_profile → haccp_cert → facility` 매핑 생성
  - 결과상태: `linked`, `ambiguous`, `unlinked`
  - 방법·근거·후보수·검토필요 여부 포함
  - 이름만 같다고 확정하지 않고 이름+지역과 실제 facility key 후보를 사용

### 4.2 로컬 파생 산출물

- `data/derived/chg-g6-002/company_profile_facility_mapping.csv`
  - 308행
  - linked 265, ambiguous 4, unlinked 39 기대
  - 원본 raw payload·주소·비밀정보 미포함
- `data/derived/chg-g6-002/mapping_summary.json`
  - 건수·원본 해시·생성규칙 버전·예외 집계
- `data/derived/chg-g6-002/mapping_exceptions.csv`
  - ambiguous·unlinked 43행만
  - 수동검토 전 운영 후보 사용 금지 표시

대용량 production_log·원본 DB·모델 pkl·원본 시험 CSV는 복사하거나 커밋 후보로 만들지 않는다.

### 4.3 데이터계약·migration 초안

- public:
  - `products_public`
  - `facility_products_public`
  - `haccp_certifications_public`
  - `facility_safety_public`
  - `manufacturing_profiles_public`
- private:
  - `company_profile_mapping`
- staging:
  - 원본별 적재 테이블

로컬 migration SQL은 작성할 수 있으나 실행하지 않는다. 기존 migration을 수정하지 말고 새 timestamp 파일로 추가한다.

필수 원칙:

- `products_public`: 전건 경량검색 projection, 시설키 없는 행 허용
- `facility_products_public`: 시설키 직접연결 제품만
- HACCP 공개: raw_payload 제외
- 안전정보 공개: 시설키 직접연결 103건만
- 제조프로필 공개: 승인 mapping 완료 행만
- private/staging: anon·authenticated 접근 금지
- service-role을 공개 런타임 조회에 사용 금지
- rollback은 이번 신규 객체만 명시적으로 제거하거나 권한을 원복

### 4.4 로더·dry-run

- 원본을 읽는 모든 로더는 read-only source URI를 사용한다.
- `--dry-run`에서 전체 건수·예외·FK·NULL·고유키를 전수검사한다.
- DB 자격증명이나 `SUPABASE_DB_URL`이 없어도 dry-run은 완료돼야 한다.
- 원격 연결이 있어도 이번 작업에서는 INSERT·DDL을 실행하지 않는다.

### 4.5 검증

- Python `py_compile`
- 감사 스크립트 실제 원본 실행
- mapping 308행·265/4/39 분포 검사
- 제품·HACCP·판매중지 기준값 및 FK 고아 0 검사
- migration 정적검사: 트랜잭션·RLS·ACL·rollback·금지문구
- 비밀정보·절대 사용자경로·원본 대용량 파일의 Git 포함 여부 검사

## 5. QA 증빙

`docs/qa/chg-g6-002-vs-a-asset-mapping.md`에 다음을 기록한다.

1. 원본 경로와 read-only 증거
2. 실제 건수·키·고아·예외
3. mapping 규칙과 265/4/39 분포
4. 공개 projection 필드·제외 필드
5. migration·rollback 파일 목록
6. 검증 명령과 결과
7. 다음 VS-B 진입조건

개별 업체명·주소의 불필요한 나열은 금지한다.

## 6. 완료 기준

- 모든 기대 건수가 실측과 일치
- 308개 프로필이 중복 없이 정확히 한 상태로 분류
- ambiguous·unlinked가 공개 후보에서 제외됨을 시험으로 확인
- 대용량 원본 복사 없음
- 원격 변경 없음
- QA 증빙 완료

## 7. 이번 작업 금지

- Next.js 화면·내비게이션 구현
- 대체 식재료 UI 변경
- 원격 Supabase 변경·적재
- Vercel 배포
- commit·push·PR·merge
- 원본 DB·F1 자료 변경
- `.claude/settings.local.json`, 브리지 루프, 훅·전역설정 변경
- 과거 F1을 런타임 정확도로 표시

완료 후 VS-B 진입조건과 차단사항을 보고하고 중단한다.
