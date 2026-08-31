# QA Evidence — CHG-G6-002 VS-I Supabase Runtime Wiring

**Status:** COMPLETE — independent production-runtime QA PASS
**Change:** CHG-G6-002-G4-VS-I-A-SNAPSHOT-SINGLE-SOURCE-028E2 (predecessors: 028B·028C·028D)
**Predecessor QA:** chg-g6-002-vs-h-lineage-publish-boundary.md

---

## 1. Scope

VS-I-A hardens the Supabase runtime boundary introduced in 028A. 028D replaces the 30-request category keyset loop with a static aggregate snapshot.

| # | Finding | Fix | Change |
|---|---------|-----|--------|
| 1 | Partial Supabase config (one var set) silently fell back to SQLite | `isPartialSupabaseConfig()` added — fail-closed immediately | 028B |
| 2 | HACCP/safety subquery errors returned `[]` instead of `FG_DATA_UNAVAILABLE` | All sub-query errors now bubble as `FG_DATA_UNAVAILABLE` | 028B |
| 3 | Product category dropdown returned `[]` on Supabase path | PostgREST keyset loop implemented with process-memory cache | 028B |
| 4 | `excludedReviewCount` returned `0` on Supabase path | Returns 43 (documented baseline per VS-C QA evidence) | 028B |
| 5 | Unused `randomUUID` import in `supabase-source.ts` | Import removed | 028B |
| 6 | Work order claimed `facility_products_public` VIEW, actual code uses `products_public` + `facility_mgt_no` index | Work order corrected | 028B |
| 7 | VS-I tests accepted 404/422/500 as success and used no dynamic IDs | Tests rewritten: 19 tests, real IDs, exact status assertions, page screenshots | 028B |
| 8 | `/api/products` with `reported_at DESC` order + exact count → PG 57014 timeout at ~3.9s on 1M rows | Replace `count:"exact"` → `count:"planned"`; order by PK `report_no ASC`; add `totalIsEstimate:true` to meta | 028C |
| 9 | Free-text `q` used unindexed `%ILIKE%` OR over 1M rows | Replace with `textSearch("product_name", q, {config:"simple",type:"plain"})` using GIN index; measured ~1.76s for 김치 | 028C |
| 10 | Facility-product preview also ordered by `reported_at DESC` | Changed to `report_no ASC` (PK, indexed) for the 12-row preview query | 028C |
| 11 | UI claimed "최근 신고순" and "업체명으로 검색" when behavior was indexed PK order and product-name-only FTS | Copy updated: "약 N건 · 품목보고번호순"; placeholder "제품명으로 검색..."; empty-state updated | 028C |
| 12 | Stale comment `excludedReviewCount = 0` in supabase-source.ts block header | Updated to correctly state 43 and the rationale | 028C |
| 13 | Category keyset loop fires 30 sequential Supabase HTTP requests; measured ~7.75s first-load latency; alphabetical order (low business value) | Replace with checked-in rank-by-count aggregate JSON; zero runtime Supabase round-trips; remove unused `escapeIlike` | 028D·028E2 |

### 028D aggregate snapshot provenance

| Field | Value |
|---|---|
| Artifact | `data/derived/chg-g6-002/product_category_top30.json` |
| `source_db_sha256` | `23104bfccc0163fb2c17c3a89739ba1e05d713b841babe66d5b8b9a6666a7444` |
| `total_source_rows` | 1,047,894 |
| `generated_at` | 2026-08-31 |
| `change_id` | CHG-G6-002-G4-VS-I-A-CATEGORY-SNAPSHOT-CLEANUP-028D |
| Source query | `SELECT category, COUNT(*) n FROM production_log WHERE category IS NOT NULL AND length(trim(category)) > 0 GROUP BY category ORDER BY n DESC, category ASC LIMIT 30` |
| Safety | Aggregate counts only — no individual product, facility, manufacturer, or personal data |
| UI exposure | Names only; server-only adapter imports and validates the JSON, while counts and source hash are not rendered |

Rank-1 category: **소스** (141,933 filings). Rank-12: **과자**. Rank-17: **김치**.

### 028C measured read-only timings (official Supabase, anon key, no DDL)

| Query | Method | Result | Latency |
|-------|--------|--------|---------|
| Full projection + `reported_at DESC` + exact count | Before fix | HTTP 500 / PG 57014 | ~3.9s |
| `report_no ASC` + `count:planned` | After fix | HTTP 206 | ~0.46s |
| HACCP inner join + `report_no ASC` + planned count | After fix | HTTP 206 | ~0.63s |
| `product_name plfts(simple)` for 김치 + PK order + planned count | After fix | HTTP 206 | ~1.76s |

---

## 2. Files Changed

| File | Change |
|------|--------|
| `lib/supabase-source.ts` | 028B: fail-closed evidence reads. 028C: planned count, indexed search/order. 028D/028E2: zero-network category JSON import and integrity validation |
| `lib/source-db.ts` | 028B: `isPartialSupabaseConfig()` + partial-config guard; pass limit to category. 028C: `totalIsEstimate?: boolean` added to `ProductSearchResult.meta` |
| `app/products/page.tsx` | 028C: result count displays "약 N건 · 품목보고번호순" when `totalIsEstimate`; empty-state wording updated |
| `app/products/ProductSearchForm.tsx` | 028C: placeholder updated to "제품명으로 검색..." |
| `e2e/chg-g6-002-vs-i.spec.ts` | 028B: rewritten 19 tests (VS-I-001..VS-I-019). 028C: added VS-I-020 (김치 search) and VS-I-021 (totalIsEstimate). 028D: added VS-I-022/023/024 (category snapshot coverage) |
| `.moai/project/work-orders/CHG-G6-002-G4-VS-I-SUPABASE-RUNTIME-WIRING-v0.1.md` | 028B: table corrected. 028C: 57014 finding + no-DDL solution + status updated. 028D: section 11 added; section 6 limitation superseded; status updated |
| `data/derived/chg-g6-002/product_category_top30.json` | 028D: NEW — aggregate snapshot artifact and, after 028E2, the single category runtime source |

---

## 3. Validation Commands

Run these when a dev server is available at `VSD_BASE_URL`:

```bash
# TypeScript type-check (no server required)
npx tsc --noEmit

# ESLint on changed files
npx eslint lib/supabase-source.ts lib/source-db.ts

# Build check
npm run build

# Playwright VS-I tests (requires live server)
VSD_BASE_URL=http://127.0.0.1:3013 npx playwright test e2e/chg-g6-002-vs-i.spec.ts --reporter=list

# git diff check
git diff --check
```

---

## 4. Static Verification

| Check | Result |
|-------|--------|
| `randomUUID` import removed | PASS (verified by reading file) |
| `isPartialSupabaseConfig()` added to source-db.ts | PASS (verified by reading file) |
| All 4 dispatch functions have partial-config guard | PASS (verified by reading file) |
| Sub-query errors → unavailable in `getSourceProductViaSupabase` | PASS (verified by reading file) |
| `productsRes.error` / `haccpRes.error` / `safetyRes.error` → unavailable in `getSourceFacilityEvidenceViaSupabase` | PASS (verified by reading file) |
| `excludedReviewCount` = 43 | PASS (verified by reading file) |
| Partial Supabase config cannot fall back to SQLite | PASS |
| Work order table corrected | PASS (verified by reading file) |
| E2E tests use dynamic IDs + exact HTTP status | PASS (verified by reading file) |
| 028C: `count:"planned"` in searchSourceProductsViaSupabase | PASS (verified by reading file) |
| 028C: `textSearch("product_name", q, {config:"simple",type:"plain"})` replaces ilike OR | PASS (verified by reading file) |
| 028C: `order("report_no", {ascending:true})` replaces reported_at in search | PASS (verified by reading file) |
| 028C: facility preview sort changed to `report_no ASC` | PASS (verified by reading file) |
| 028C: `totalIsEstimate:true` in search meta on Supabase path | PASS (verified by reading file) |
| 028C: `ProductSearchResult.meta.totalIsEstimate?:boolean` in source-db.ts | PASS (verified by reading file) |
| 028C: products page copy reflects "약 N건 · 품목보고번호순" | PASS (verified by reading file) |
| 028C: search placeholder "제품명으로 검색..." | PASS (verified by reading file) |
| 028C: VS-I-020 (김치 search) and VS-I-021 (totalIsEstimate) E2E added | PASS (verified by reading file) |
| 028C: stale `excludedReviewCount = 0` comment fixed | PASS (verified by reading file) |
| 028D: `escapeIlike` function removed from supabase-source.ts | PASS (verified by reading file) |
| 028D: `_categoriesCache` and keyset loop removed | PASS (verified by reading file) |
| 028D/028E2: category JSON is the single source and validates 30 rows, ranks, uniqueness and counts | PASS |
| 028D/028E2: `listSourceProductCategoriesViaSupabase` returns a bounded slice — zero Supabase requests | PASS |
| 028D: `data/derived/chg-g6-002/product_category_top30.json` created with source hash, query, 30 rank rows | PASS (verified by reading file) |
| 028D: VS-I-022 test checks 소스, 과자, 김치 present in filter | PASS (verified by reading file) |
| 028D: VS-I-023 test checks source hash and count 141933 absent from page HTML | PASS (verified by reading file) |
| 028D: VS-I-024 test checks 소스 is first non-default option (rank 1) | PASS (verified by reading file) |
| `npm run lint` | PASS — 0 errors, 5 pre-existing warnings outside VS-I changed code |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS — line-ending notices only |
| Fresh production `/products` first load | PASS — HTTP 200, 2.17s (previous 7.75s) |
| Production Playwright VS-I-001..024 | PASS — 24/24, desktop and 390px checks included |
| Screenshots saved to `output/playwright/chg-g6-002-vs-i/` | PASS |

---

## 5. Completion Boundary

- Local production runtime, official Supabase anon reads, API contracts, responsive pages, category snapshot, and screenshot evidence are complete.
- This result does **not** deploy the new code. Vercel production/preview, Git commit/push/PR, and any Supabase write remain outside this gate and require separate authorization.

---

## 6. Security Review

- No service-role key added or referenced.
- Partial config fail-closed does not leak which variable is missing (returns generic `FG_DATA_UNAVAILABLE`).
- Sub-query error messages log only provider error code (no SQL/table detail) via `console.warn`.
- Category filter uses a checked-in non-sensitive aggregate JSON; it performs no runtime database query and renders names only.
- `excludedReviewCount = 43` is a public aggregate; no private mapping rows are returned.

---

## 7. Rollback

All changes are local code edits only. No Supabase DDL, no migrations, no Vercel changes, no Git commits. Revert any file with `git checkout <file>`.

---

## 8. Pre-commit Audit

### 8.1 Candidate boundary

| Item | Result |
|------|--------|
| Current branch | `codex/chg-g6-001-g4-vs-01-preview` at `91c435f` |
| Local relation to `origin/main` | 0 behind / 3 ahead at audit time |
| Commit candidates | 112 files, approximately 2.61 MiB |
| Included tracked modifications | 16 files (excluding personal Claude settings) |
| Included untracked deliverables | 96 files |
| Staged files | 0 |

The VS-I work is stacked on the existing G6-001 Preview history. To keep the next review atomic, a new `codex/chg-g6-002-vs-i-preview` branch should be created from the current HEAD only after authorization, and its first PR should target `codex/chg-g6-001-g4-vs-01-preview`, not `main`. A later mainline merge requires the prior Preview/UAT chain to be resolved first.

### 8.2 Explicit exclusions and cleanup

| Path | Decision | Evidence |
|------|----------|----------|
| `.claude/settings.local.json` | EXCLUDE | Personal local settings; remains modified and unstaged |
| `03_공동제조 매칭 정확도(F1 SCORE)/` | EXCLUDE | 28 local source/evaluation files, 8.81 MiB; added to `.gitignore` |
| `output/` | EXCLUDE | Browser/bridge runtime artifacts; existing ignore rule retained |
| `.env.local` and other `.env*` | EXCLUDE | Existing ignore rule; only empty-value `.env.example` is eligible |
| `scripts/_patch_validator.py` | REMOVE | One-time patch helper declared itself temporary; deleted after application |

### 8.3 Security and portability

| Check | Result |
|-------|--------|
| JWT, GitHub, Supabase secret, Vercel token, AWS key, private key | PASS — 0 actual matches |
| Credentialed DB URL scan | REVIEWED — two files contain only deliberate fake DSN test fixtures and a scanner regex |
| `.env.example` | PASS — variable names and empty values only |
| Personal absolute paths in candidate files | PASS — 0 after removing one stale temporary-audit path from VS-A QA |
| Derived mapping evidence | PASS — 308 mapping rows and 43 exception rows, identifier/status fields only |

### 8.4 Revalidation after audit cleanup

| Command | Result |
|---------|--------|
| `npm run lint` | PASS — 0 errors, 5 pre-existing warnings |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `python -m unittest scripts.test_chg_g6_002_load_package` | PASS — 109/109 |
| `python scripts/chg_g6_002_dryrun_validator.py` | PASS — 0 errors |
| Product search FTS contract | PASS — migration 0028 simple-configuration GIN index verified |

Pre-commit verdict: **PASS WITH STACKED-BRANCH CONDITION**. The candidate set is safe to commit after explicit Git authorization. No commit, push, PR, Vercel action, or additional Supabase write was performed during this audit.

---

*Claude Code implemented 028B→028E2. Codex independently validated lint, typecheck, build, git diff, cold production response, and Playwright VS-I-001..024. VS-I local gate is COMPLETE; deployment remains unexecuted.*
