# CHG-G6-002 Approval B: Staging Load Execution Record

- 승인점: Approval B (staging 5종 적재)
- 상태: **DATA_LOAD_PASS / APPROVAL_C_BLOCKED**
- 기준선: `CHG-G6-002 v0.1`

## 1. 사용자 승인 범위

### 허용

- 공식 신규 Supabase의 staging 5종 적재
- 정확한 행수, checkpoint, lineage, 원본 불변성 검증
- 기존 public 및 신규 G6 public 도메인 객체 무변경 검증

### 금지

- public 도메인 데이터 게시
- Approval C 실행
- Vercel 변경
- Git commit, push, PR, merge
- 레거시 Git, Vercel, Supabase 변경

## 2. 실행 전 가드

- 공식 신규 프로젝트 linked target 일치: PASS
- migration 0028-0034 local/remote 일치: PASS
- 신규 staging 4개 테이블과 private mapping 0행: PASS
- `private.load_checkpoint` 0행: PASS
- 원본 5종 건수 및 source invariance: PASS
- G6 public 도메인 객체 0행: PASS

## 3. 적재 결과

| dataset | 대상 | 행수 | checkpoint |
|---|---|---:|---|
| production_log | staging.production_log_raw | 1,047,894 | completed |
| haccp_cert | staging.haccp_cert_raw | 308 | completed |
| sales_suspension | staging.sales_suspension_raw | 355 | completed |
| company_profiles | staging.company_profiles_raw | 308 | completed |
| mapping | private.company_profile_mapping | 308 | completed |

- checkpoint 5개 모두 `completed` 및 expected `loaded_rows` 일치: PASS
- checkpoint와 private lineage의 dataset, fingerprint, row_count 일치: PASS
- 적재 후 원본 5종 건수 및 source invariance 재검증: PASS
- 자격증명은 Process scope에서만 사용하고 실행·검증 종료 후 제거: PASS

## 4. Public 무게시 검증

다음 G6 public 도메인 객체는 모두 0행이다.

- public.products_public
- public.facility_products_public
- public.haccp_certifications_public
- public.facility_safety_public
- public.manufacturing_profiles_public

기존 VS-2 public 7개 테이블의 정확한 행수도 변경되지 않았다.

## 5. 발견된 경계 결함

### PUBLIC-LINEAGE-001

기존 `public.data_lineage_public` 뷰는 `private.data_lineage` 전체를 필터 없이 조회한다. Approval B가 만든 staging lineage 5건은 `publish_version IS NULL` 상태인데도 anon Data API에서 조회된다.

- G6 public 도메인 데이터 게시: 실행하지 않음, 0행 유지
- staging/private 원문 행 노출: 확인되지 않음
- 공개된 항목: dataset_name, basis_date, publish_version, ingest_run_at 등 기존 뷰의 제한된 lineage 메타데이터
- 판정: 적재 데이터 자체는 PASS이나 엄격한 public 무변경 경계에는 결함

이번 승인 범위에서는 뷰 DDL 변경, lineage 수정·삭제, grant 변경을 수행하지 않았다.

## 6. 다음 게이트

Approval C는 **BLOCKED**다. 다음 작업은 별도 승인 아래 수행해야 한다.

1. `public.data_lineage_public`이 게시 완료 lineage만 노출하도록 하는 보완 계약 설계
2. publish 시점에만 공개 상태를 부여하는 방식 확정
3. 신규 migration 및 rollback 정적 검증
4. 별도 DDL 적용 승인
5. anon Data API에서 미게시 lineage 0건 확인

이 보완이 완료되기 전 public publish, Approval C, Vercel, Git 작업을 진행하지 않는다.

## 7. 비밀정보·원본 보호

- DB 비밀번호, DSN, 키를 기록하지 않음
- 원본 파일 경로·fingerprint·raw row를 기록하지 않음
- 원본은 read-only로 열었고 적재 후 불변성을 재확인함
