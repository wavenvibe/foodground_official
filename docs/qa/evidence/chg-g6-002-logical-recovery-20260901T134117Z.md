# CHG-G6-002 논리 복구훈련 증거

- 실행 ID: `20260901T134117Z`
- 원본: 승인된 공식 신규 Supabase 프로젝트(읽기 전용)
- 원본 스냅샷 UTC: `2026-09-01T13:41:30.078Z`
- 원본 PostgreSQL: `170006`
- 복원 대상: 로컬 WSL PostgreSQL 17 임시 데이터베이스
- 스키마: `public`, `private`, `staging`
- 아카이브 크기: `112,081,507 bytes`
- 아카이브 manifest SHA-256: `0fdb8a8d6cb5366bd40cdb6182bd614c88558244e8ea14907754d4c62f24655d`

## 실행 결과

| 단계 | 결과 |
|---|---|
| 원격 원본 건수 조회 | PASS — 읽기 전용 |
| PostgreSQL 17 논리 백업 | PASS — 146초 |
| 로컬 임시 DB 복원 | PASS — 13초 |
| 원본·복원본 비교 | PASS — 17개 객체 건수 일치 |
| Approval C 재검증 | PASS — 2초 |
| 로컬 복원 시작→검증 완료 | 15초 |
| 전체 실행 | 173초 |
| 임시 데이터 정리 | PASS — 아카이브·복원 DB 삭제 |

## 게시 데이터 검증

| 객체 | 복원 건수 |
|---|---:|
| `public.products_public` | 1,047,894 |
| `public.facility_products_public` VIEW | 815,989 |
| `public.haccp_certifications_public` | 308 |
| `public.facility_safety_public` | 103 |
| `public.manufacturing_profiles_public` | 265 |
| `private.company_profile_mapping` | 308 |

다음 검증도 모두 통과했다.

- PK 중복 0
- FK 고아 0
- VIEW 건수·필터 일관성
- mapping 분포 `linked=265`, `ambiguous=4`, `unlinked=39`
- 비공개 컬럼 제외
- 4개 public 테이블 RLS 활성화
- anon/authenticated SELECT-only ACL
- staging/private 스키마 접근 차단
- `pg_policies`와 VIEW grant 검증
- lineage checkpoint 5건과 공개 lineage 5건 일치
- `recipe_ingredients.amount_gram IS NULL` 확인 이상치 1건 보존

## 보안·불변성

- DB 비밀번호·URI·키는 보고서에 기록하지 않았다.
- 공식 신규 Supabase에는 SELECT와 `pg_dump`만 수행했다.
- 공식 신규 Supabase DDL·DML·migration·복원은 수행하지 않았다.
- Git·Vercel·Production·기존 Foodground는 변경하지 않았다.
- 로컬 임시 DB·아카이브·비밀번호 버퍼는 실행 종료 시 제거했다.

## 해석 경계

이번 결과는 최신 공식 DB 애플리케이션 스키마의 논리 현재상태 복원이다. Supabase 예약 물리 백업 시점 복원이나 Point-in-Time Recovery 검증이 아니며, Storage API 객체 본문을 포함하지 않는다. 측정된 15초는 로컬 논리 복원 후 SQL 검증 완료까지의 시간으로 Production 장애복구 RTO 보장값이 아니다.

## 실행 후 runner 재검증

커밋 전 감사에서 비밀값 탐지기의 변수명 오탐을 발견해 secret transport 변수명과 `PGPASSWORD` export 표현만 교정했다. 비밀값 탐지기를 완화하지 않았다. 교정 후 다음을 다시 통과했다.

- Windows PowerShell→WSL 파일 SHA-256 round trip
- UTF-8 secret pipe와 Base64 decode
- 로컬 PostgreSQL 17 dump/restore 자기시험
- Bash syntax
- Python 단위시험 109/109
- 통합 dry-run validator 0 errors
