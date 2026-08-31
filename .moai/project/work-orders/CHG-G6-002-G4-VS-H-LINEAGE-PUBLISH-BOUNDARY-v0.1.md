# CHG-G6-002 G4 VS-H PUBLIC-LINEAGE-001 경계 수정 v0.1

## 1. 목표

결함 PUBLIC-LINEAGE-001 수정: 미게시 staging lineage 5건이 `public.data_lineage_public` VIEW를 통해 anon 사용자에게 노출되는 경계 결함을 해소한다.

수정 계약:
1. 미게시(publish_version IS NULL) lineage 행은 public VIEW에 절대 노출되지 않는다.
2. CHG-G6-002 5건은 public 도메인 테이블 게시와 동일한 원자 트랜잭션에서만 가시화된다.
3. data rollback은 해당 5건의 publish marker를 원자적으로 해제한다.
4. 기존 VS-2 lineage 행은 변경 없이 유지된다.

## 2. 결함 근본 원인

Migration 0020 (`20260825001000_0020_vs2_init_schemas.sql`)이 `public.data_lineage_public` VIEW를 `WHERE publish_version IS NOT NULL` 필터 없이 생성하여, staging 적재 시 생성된 lineage 행이 즉시 public으로 노출됨.

## 3. 산출물

### A. Migration 0035 (스키마 수정)

- `supabase/migrations/20260831000000_0035_g6_002_lineage_publish_boundary.sql`
- `CREATE OR REPLACE VIEW public.data_lineage_public` + `WHERE publish_version IS NOT NULL`
- 동일 5개 안전 컬럼, security_invoker 미사용 (definer 접근 필요), GRANT SELECT 유지

### B. Migration 0035 Rollback

- `supabase/rollback/20260831_0035_g6_002_lineage_publish_boundary_rollback.sql`
- 스키마 전용 rollback: 필터 없는 원래 VIEW 복원
- PUBLIC-LINEAGE-001 재개 경고 포함

### C. Publish SQL (lineage marker 설정)

- `scripts/chg_g6_002_publish.sql` 섹션 5 추가
- temp table `_chg_g6_runs`로 5개 checkpoint run ID 수집
- 검증: 정확히 5개 completed checkpoint, loaded_rows 일치
- `publish_version = 'chg-g6-002-v1'` bounded UPDATE
- `data_lineage_public` ACL guard 추가 (섹션 7)

### D. Publish Rollback SQL (lineage marker 해제)

- `scripts/chg_g6_002_publish_rollback.sql` 섹션 2 추가
- 5개 run ID의 publish_version NULL 설정
- VIEW를 통한 비가시성 검증

### E. Verify SQL (lineage 검증)

- `scripts/chg_g6_002_verify.sql` 섹션 8 추가
- 5개 checkpoint → 5개 lineage 행 매핑 검증
- publish_version = 'chg-g6-002-v1' 검증
- VIEW 필터 정의 검증 (pg_views)
- `data_lineage_public` ACL guard 추가 (섹션 7b)

### F. 정적 검증기 + 테스트

- `scripts/chg_g6_002_dryrun_validator.py`: 0035 migration/rollback 검증, lineage 키워드 검증
- `scripts/test_chg_g6_002_load_package.py`: lineage 경계·bounded run·권한·policy catalog 구조 테스트 보강, 전체 109건 PASS

## 4. 로컬 검증 명령

```bash
python -m py_compile scripts/chg_g6_002_dryrun_validator.py
python -m py_compile scripts/test_chg_g6_002_load_package.py
python scripts/chg_g6_002_dryrun_validator.py
python -m pytest scripts/test_chg_g6_002_load_package.py -v
```

## 5. 원격 확인 완료

- [x] `supabase db push` migration 0035·0036 적용
- [x] 원격 anon 경계와 VIEW 필터 작동 확인
- [x] public 5종 원자 게시 및 publish 후 lineage 5건 가시성 확인
- [x] 게시 후 SQL verify: 건수·PK·FK·VIEW·RLS·ACL·`pg_policies` 전 항목 PASS

## 6. 금지 사항

- Approval C publish 재실행 및 게시 데이터 수동 수정 금지
- 기존 VS-2 lineage 행 변경 금지
- publish_version 이외의 private.data_lineage 컬럼 변경 금지
