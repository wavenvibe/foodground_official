# CHG-G6-002 VS-F Data Load Package — QA Evidence

Date: 2026-08-31
Status: PASS (local dry-run + CORRECTION-012 + INDEPENDENT-AUDIT-013 + PY311-CORRECTION-014 complete; remote execution deferred to VS-G after user approval)

## 1. Deliverable Summary

| Deliverable | File | Status |
|---|---|---|
| VIEW migration (0029) | `supabase/migrations/20260830001000_0029_*.sql` | CREATE OR REPLACE VIEW, security_invoker=true |
| Checkpoint migration (0034) | `supabase/migrations/20260830006000_0034_*.sql` | fingerprint/status/resume + resumable-run unique guard |
| Rollback (schema + data) | `supabase/rollback/20260830_0028_0033_*.sql` | DROP VIEW for 0029, DROP TABLE for 0034 |
| Staging loader | `scripts/chg_g6_002_staging_loader.py` | execute_batch, lineage, stable session lock, empty guard, finally unlock, count/invariance verify, TLS |
| Preflight checker | `scripts/chg_g6_002_preflight.py` | DSN validation, VS-2 counts, structured Supabase CLI discovery |
| SQL runner | `scripts/chg_g6_002_sql_runner.py` | Secure SQL executor with URL-parsed DSN validation |
| Publish SQL | `scripts/chg_g6_002_publish.sql` | TRUNCATE+INSERT, NULLIF normalization |
| Verify SQL | `scripts/chg_g6_002_verify.sql` | Row counts, PK, FK, VIEW, mapping, executable RLS/ACL, pg_policies SELECT |
| Publish rollback | `scripts/chg_g6_002_publish_rollback.sql` | Data-only TRUNCATE (not DROP) |
| Secure runner | `scripts/chg_g6_002_run_migration.ps1` | Invoke-SqlRunner, Invoke-SupabaseDbPush, -Approved, $LASTEXITCODE, structured Find-PythonExe/Find-SupabaseCli |
| Unit tests | `scripts/test_chg_g6_002_load_package.py` | 67 tests including behavioral mock tests (6 categories), RLS/pg_policies, structured resolver, all PASS |
| Dry-run validator | `scripts/chg_g6_002_dryrun_validator.py` | 13-section + CORRECTION-012 pattern checks |

## 2. VIEW Contract (0029)

- `facility_products_public` is a VIEW (not TABLE) over `products_public`
- `security_invoker=true` — RLS on `products_public` enforced per caller
- WHERE `facility_mgt_no IS NOT NULL` filters to 815,989 expected rows
- GRANT SELECT to anon, authenticated
- No data duplication; `idx_products_public_facility` partial index reused
- Rollback uses `DROP VIEW IF EXISTS` (not `DROP TABLE`)

## 3. Checkpoint Migration (0034)

- `private.load_checkpoint` table with columns: dataset, ingest_run_id, source_fingerprint, last_source_key, loaded_rows, status
- `status CHECK ('running','completed','failed','cancelled')`
- `PRIMARY KEY (dataset, ingest_run_id)`
- `REVOKE ALL FROM anon, authenticated, PUBLIC` — service_role only
- Index on (dataset, status) for resume queries
- Partial unique index permits only one `running`/`failed` resumable row per dataset
- Stable session-level advisory lock remains held across chunk commits

## 4. Staging Loader Features

- Reads source via `FOODGROUND_SOURCE_DB` env var
- Opens SQLite with `mode=ro` + `PRAGMA query_only=ON`
- SHA-256 source fingerprint for resume safety
- Source size/mtime invariance check before each dataset can be marked completed
- 5 datasets: production_log (1,047,894), haccp_cert (308), sales_suspension (355), company_profiles (308), mapping (308)
- UPSERT SQL templates for all 5 targets
- Resume requires checkpoint fingerprint and lineage dataset/SHA to agree
- Live mode forces TLS and uses DSN-from-process-env only

## 5. Actual-Source Dry-Run Results

### 5.1 Staging Loader --dry-run

```
Source DB fingerprint: 23104bfccc0163fb...
Source DB size: 484,986,880 bytes

  production_log: 1,047,894 rows  [OK]
  haccp_cert: 308 rows  [OK]
  sales_suspension: 355 rows  [OK]
  company_profiles: 308 rows  [OK]
  mapping: 308 rows  [OK]

Source DB invariance: OK
Mismatches: 0
Exit code: 0
```

### 5.2 Preflight --dry-run

```
All 7 migration files: PASS
Rollback DROP VIEW for facility_products_public: PASS
Rollback DROP TABLE for load_checkpoint: PASS
0029 creates VIEW (not TABLE): PASS
0029 has security_invoker: PASS
0034 has source_fingerprint, dataset, REVOKE: PASS
Verdict: PASS (0 errors)
```

### 5.3 Comprehensive Dry-Run Validator (13 sections)

```
Section 1. py_compile: 5/5 scripts PASS
Section 2. SQLite read-only audit: all table counts, column contracts, FK orphans PASS
           facility_products_public VIEW expected rows: 815,989 PASS
Section 3. Mapping distribution: 308 total, 265/4/39 PASS
Section 4. Mapping FK orphan check: 0 orphans PASS
Section 5. exceptions.csv: 43 rows, all needs_review=true PASS
Section 6. Migration static checks: RLS/POLICY/GRANT/REVOKE, forbidden patterns, column contracts PASS
Section 7. VIEW contract (0029): CREATE VIEW, security_invoker, no CREATE TABLE PASS
Section 8. Checkpoint migration (0034): all columns, CHECK, REVOKE, PK PASS
Section 9. Rollback file: DROP VIEW, DROP TABLE, no CASCADE PASS
Section 10. VS-F script deliverables: 6/6 scripts exist with required keywords PASS
Section 11. PowerShell wrapper security: SecureString, finally{}, Process scope PASS
Section 12. Publish SQL: TRUNCATE+INSERT, NULLIF, VIEW auto-reflects PASS
Section 13. No secrets/PII: all migration and script files clean PASS

Verdict: PASS (0 errors)
```

## 6. Data Contract Verification (source-measured expected counts, NOT remote)

These counts are **source-measured expected values** derived from the local
SQLite source DB and CSV files during dry-run. They are NOT the result of
querying the remote Supabase database. Remote verification is deferred to VS-G.

| Dataset | Source-Measured Expected | Status |
|---|---|---|
| products_public | 1,047,894 | Source count verified |
| facility_products_public (VIEW) | 815,989 | Source WHERE filter verified |
| haccp_certifications_public | 308 | Source count verified |
| facility_safety_public | 103 (facility-linked subset of 355) | Source count verified |
| manufacturing_profiles_public | 265 (linked) | Mapping status count verified |
| company_profile_mapping | 308 (265/4/39) | Source distribution verified |

## 7. Security Checks

- No secrets, DSNs, or credentials in any migration or script file
- PowerShell accepts a non-secret URI template, receives the password separately through SecureString, URL-encodes it, and clears process-scoped secrets in finally{}
- Source DB opened read-only (mode=ro + PRAGMA query_only=ON)
- Source size/mtime verified invariant before and after operations
- No public access to private.load_checkpoint (REVOKE ALL)
- VIEW uses security_invoker=true (inherits base table RLS)
- Effective privileges are checked with `has_table_privilege`/`has_schema_privilege`; bad RLS/ACL rolls back before COMMIT

## 8. Remote Operations

**0 remote operations executed.** All validation was local dry-run only.

## 9. Approval Point A — Pre-Deployment Checklist

Before VS-G remote execution, the user should verify on the Supabase dashboard:

1. Database storage capacity remaining (1,047,894 products + staging = ~2x storage)
2. Connection pool limits for batch UPSERT operations
3. VS-2 tables (7) are present and untouched
4. No conflicting objects in public/private/staging schemas
5. Linked target matches the approved official Supabase project

## 10. CORRECTION-012 — Codex Direct Completion Results

Date: 2026-08-30
Status: PASS (Claude bridge disabled; local package completed and independently revalidated by Codex)

### 10.1 Defects Corrected (A-I)

| ID | Category | Fix Summary |
|---|---|---|
| A | DSN security | `sql_runner.py` with URL-parsed `validate_dsn()`; pooler/direct forms only; password-bypass rejection |
| B | Migration path | `Invoke-SupabaseDbPush` via Supabase CLI `db push`; `find_supabase_cli()` in preflight |
| C | Bulk operations | `execute_batch` from `psycopg2.extras` replacing row-by-row insert |
| D | Data lineage | `_create_lineage_record` called BEFORE `_create_checkpoint` in `run_live` (FK ordering) |
| E | Advisory locks | Stable SHA-derived `pg_try_advisory_lock` held for the full dataset load; explicit unlock + resumable-row unique index |
| F | Count verification | `_verify_target_count()` called BEFORE `"completed"` status in `run_live` |
| G | VS-2 expected counts | `VS2_EXPECTED_COUNTS` dict with 7 exact values in preflight; per-table live verification |
| H | RLS/ACL verification | Executable PL/pgSQL using `relrowsecurity`, `has_table_privilege`, `has_schema_privilege`; pre-COMMIT guard included |
| I | Test coverage | 40 unit tests including mock cursor behavior for lock, resume, checkpoint and count guards |
| J | Transport/input safety | TLS required in all Python DB connections; URI template and hidden password are handled separately |

### 10.2 New/Modified Files

| File | Action |
|---|---|
| `scripts/chg_g6_002_sql_runner.py` | NEW — secure SQL executor with DSN validation |
| `scripts/chg_g6_002_staging_loader.py` | REWRITE — bulk ops, lineage, advisory locks, count verify |
| `scripts/chg_g6_002_preflight.py` | REWRITE — DSN validation, VS-2 counts, Supabase CLI discovery |
| `scripts/chg_g6_002_run_migration.ps1` | REWRITE — Invoke-SqlRunner, Invoke-SupabaseDbPush, -Approved, $LASTEXITCODE |
| `scripts/chg_g6_002_verify.sql` | EDIT §7 — executable RLS/ACL PL/pgSQL blocks |
| `scripts/test_chg_g6_002_load_package.py` | NEW — 40 tests including behavior-level checkpoint guards |
| `scripts/chg_g6_002_dryrun_validator.py` | EDIT — new script/pattern checks |

### 10.3 Test Results

```
python -m unittest -v scripts/test_chg_g6_002_load_package.py
Ran 40 tests
OK
```

### 10.4 Dry-Run Validator Results (post-correction)

```
python scripts/chg_g6_002_dryrun_validator.py
Verdict: PASS (0 errors)
```

## 11. INDEPENDENT-AUDIT-013 — Claude Code Independent Audit

Date: 2026-08-31
Status: PASS (6 audit categories addressed, 67 tests, all validations green)

### 11.1 Audit Findings and Corrections

| # | Category | Finding | Correction |
|---|---|---|---|
| 1 | Stale-row guard | Fresh load did not verify target empty before UPSERT | Added `_assert_target_empty()` before lineage/checkpoint in fresh (non-resume) path |
| 2 | Advisory lock unlock | `_release_advisory_lock` only called on success path | Wrapped per-dataset processing in `try/finally` — unlock attempted on every exit path |
| 3 | Behavioral tests | 40 tests were mostly string-existence checks | Added 27 mock-based behavioral tests covering 6 categories (empty guard, chunk flow, failure, resume lineage, count guard, lock lifecycle) |
| 4 | RLS pg_policies | `has_table_privilege` checked but `pg_policies` not queried | Added `pg_policies` SELECT policy verification + VIEW existence to both publish.sql and verify.sql |
| 5 | PowerShell resolvers | `Find-SupabaseCli` returned concatenated `"npx supabase"` string | Restructured to `@{ExePath; PrefixArgs}`. Added `Find-PythonExe` resolver. URI template scheme validated. |
| 6 | Python CLI resolver | `find_supabase_cli()` in preflight also returned concatenated string | Restructured to `{"exe", "prefix_args"}` dict |

### 11.2 Modified Files

| File | Change |
|---|---|
| `scripts/chg_g6_002_staging_loader.py` | `_assert_target_empty()` + per-dataset `try/finally` unlock |
| `scripts/chg_g6_002_preflight.py` | `find_supabase_cli()` returns structured dict |
| `scripts/chg_g6_002_run_migration.ps1` | `Find-PythonExe`, structured `Find-SupabaseCli`, URI scheme guard |
| `scripts/chg_g6_002_publish.sql` | pg_policies SELECT policy check + VIEW existence guard |
| `scripts/chg_g6_002_verify.sql` | pg_policies SELECT policy check (section 7c) + VIEW grant |
| `scripts/test_chg_g6_002_load_package.py` | 67 tests (was 40): +27 behavioral mock tests |
| `scripts/chg_g6_002_dryrun_validator.py` | Updated keyword checks for new patterns |
| `docs/qa/chg-g6-002-vs-f-data-load-package.md` | Updated test count, deliverable descriptions, added section 11 |

### 11.3 Validation Results

| Check | Result |
|---|---|
| py_compile (5 scripts) | PASS |
| unittest (67 tests) | PASS |
| PowerShell AST parse | PASS |
| Dry-run validator (13 sections) | PASS (0 errors) |
| Preflight --dry-run | PASS (0 errors) |
| git diff --check | PASS |
| Secret/path scan | PASS (0 findings) |

## 12. PY311-CORRECTION-014 — Python 3.11 Compatibility Fix

Date: 2026-08-31
Status: PASS (all 9 checks pass on Python 3.11.7)

### 12.1 Root Cause

`scripts/chg_g6_002_preflight.py` lines 263 and 435 used nested double-quote
f-strings (`f"...{dict["key"]}..."`), a syntax valid only in Python 3.12+
(PEP 701). Python 3.11 raises `SyntaxError` on compile.

### 12.2 Fix Applied

Extracted dict lookups to local variables before the f-string on both lines
(dry-run path line 263, live path line 435). No other VS-F scripts had the
same pattern.

### 12.3 Validation (all via `C:\Program Files\Python311\python.exe`, Python 3.11.7)

| # | Check | Result |
|---|---|---|
| 1 | py_compile (7 scripts incl. test) | PASS |
| 2 | unittest (67 tests) | PASS (Ran 67 tests in 0.039s) |
| 3 | Actual-source SQLite dry-run (mode=ro, PRAGMA query_only) | PASS: facility=94,723; production_log=1,047,894; haccp_cert=308; sales_suspension=355; VIEW rows=815,989; 0 FK orphans; size/mtime invariant |
| 4 | Preflight --dry-run | PASS (0 errors) |
| 5 | Comprehensive dry-run validator (13 sections) | PASS (0 errors) |
| 6 | PowerShell AST parse | PASS (0 parse errors) |
| 7 | git diff --check | PASS (exit 0) |
| 8 | Document-register check | PASS (QA doc exists) |
| 9 | Secret/personal-path scan (21 files) | PASS (0 findings) |

### 12.4 Source DB Aggregate Invariants (no raw rows or source path disclosed)

| Table | Count | FK Orphans | Linked Rows |
|---|---|---|---|
| facility | 94,723 | n/a | n/a |
| production_log | 1,047,894 | 0 | 815,989 (facility-linked VIEW) |
| haccp_cert | 308 | 0 | 269 |
| sales_suspension | 355 | 0 | 103 |

Column contracts verified for production_log (10 cols), haccp_cert (9 cols),
sales_suspension (14 cols). Source DB opened read-only; size/mtime invariant.

## 13. Known Limits

- GIN index (pg_trgm) for text search is deferred to VS-G
- Approval A migration과 Approval B staging load는 별도 사용자 승인으로 실행 완료
- Approval C publish와 최종 verify는 실행하지 않았으며 별도 승인 전 금지
- sales_suspension has 355 source rows but only 103 with facility links
- Mapping boundary: 4 ambiguous + 39 unlinked require manual review
- Source SQLite DB not available in git (gitignored); dry-run validator gracefully skips SQLite checks when absent

## 14. Approval B Remote Execution Evidence

Status: **DATA_LOAD_PASS / APPROVAL_C_BLOCKED**

| Check | Result |
|---|---|
| Official linked target | PASS |
| Migration 0028-0034 local/remote match | PASS |
| production_log staging count | 1,047,894 PASS |
| haccp_cert staging count | 308 PASS |
| sales_suspension staging count | 355 PASS |
| company_profiles staging count | 308 PASS |
| private mapping count | 308 PASS |
| checkpoint 5 completed + loaded_rows | PASS |
| checkpoint/lineage consistency | PASS |
| post-load source invariance | PASS |
| G6 public domain objects | 5 objects, 0 rows PASS |
| existing VS-2 public counts | unchanged PASS |
| Vercel / Git | no operation |

### 14.1 PUBLIC-LINEAGE-001

Anon Data API read-only verification found five staging lineage metadata rows in the existing `public.data_lineage_public` view. Each has `publish_version IS NULL`. No staging raw row or G6 public domain row was exposed, but this violates a strict no-public-change interpretation.

Approval C is blocked until a separately approved migration makes publication state explicit and excludes unpublished lineage from anon access. No DDL, lineage mutation, grant change, public publish, Vercel, or Git operation was performed as part of this finding.

### 14.2 Local corrective package status

`PUBLIC-LINEAGE-001`의 로컬 보완 패키지는 VS-H에서 준비됐다. Migration 0035는 `publish_version IS NOT NULL`인 lineage만 공개하고, 게시·데이터 롤백·사후검증 SQL은 현재 staging 5종의 run ID, 고정 기대 건수, completed checkpoint, lineage `(id, dataset_name)`을 교차검증한다.

로컬 검증은 py_compile PASS, 단위 테스트 93건 PASS, dry-run validator 0 오류, git diff 오류 0건이다. 이 보완은 원격 미적용 상태이며 Approval C 차단은 유지한다. 다음 원격 작업은 migration 0035 적용과 anon 미게시 lineage 0건 확인이며 별도 사용자 승인이 필요하다.
