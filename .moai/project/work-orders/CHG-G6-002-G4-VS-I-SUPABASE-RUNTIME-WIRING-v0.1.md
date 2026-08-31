# Work Order: CHG-G6-002-G4-VS-I — Supabase Runtime Wiring

**Change ID:** CHG-G6-002-G4-VS-I-SUPABASE-RUNTIME-WIRING
**Version:** v0.1
**Status:** COMPLETE — independent Codex lint·typecheck·build·production Playwright 24/24 PASS
**Gate:** CHG-G6-002 / Approval C PASS
**Predecessor:** VS-H (lineage publish boundary — COMPLETE)

---

## 1. Objective

Wire existing product, facility, HACCP, safety, and manufacturing-match APIs to the official public Supabase runtime boundary (`glczrbadvfgmblmkpgfj`). The SQLite local path remains available for explicit local development. Fail-closed if Supabase is configured but unavailable.

---

## 2. Data-Source Priority

```
NEXT_PUBLIC_SUPABASE_URL set AND NEXT_PUBLIC_SUPABASE_ANON_KEY set
  → Supabase path (authoritative runtime)
  → Supabase error → return FG_DATA_UNAVAILABLE (no SQLite fallback)

FOODGROUND_SOURCE_DB set AND Supabase NOT active
  → SQLite path (explicit local development only)

Neither configured
  → FG_DATA_UNAVAILABLE
```

`isSupabaseActive()` exported from `lib/source-db.ts` — checks both env vars are non-empty.

---

## 3. Supabase Table Mapping

| Function | Supabase Table / View |
|---|---|
| `searchSourceProducts` | `products_public` + `facilities` (LEFT JOIN) |
| `getSourceProduct` | `products_public` + `facilities` + `haccp_certifications_public` + `facility_safety_public` |
| `getSourceFacilityEvidence` | `facilities` + `products_public` (filtered by indexed `facility_mgt_no`) + `haccp_certifications_public` + `facility_safety_public` |
| `getSourceFacilitySummaries` | `facilities` (IN list) |
| `getManufacturingOptions` / `matchManufacturingCandidates` | `manufacturing_profiles_public` |

### Column Differences (SQLite vs Supabase)

| Field | SQLite column | Supabase column |
|---|---|---|
| Facility business type | `biz_type` | `business_type` |
| HACCP update timestamp | `updated_at` | `source_updated_at` |
| Manufacturing profile | CSV files | `manufacturing_profiles_public` table |

---

## 4. API and Error Contracts (unchanged)

- Successful: `{ ok: true, data: T, traceId: string }`
- Failed: `{ ok: false, error: { code: "FG_DATA_UNAVAILABLE" | "FG_BAD_REQUEST", message: string, retryable: boolean }, traceId: string }`
- All public error messages: Korean, no SQL/internal details

---

## 5. Security

- `createPublicServerClient()` validates hostname matches `glczrbadvfgmblmkpgfj.supabase.co`
- Only anon key used — RLS enforces public-only access
- No service-role key in any new code
- All user input sanitized before use in queries (length limits, special-char escaping)
- `server-only` guard on all new server-side lib files

---

## 6. Known Limitations

- `listSourceProductCategories`: **[028D/028E2] Replaced by checked-in aggregate JSON** `data/derived/chg-g6-002/product_category_top30.json`. Server code imports and validates this single source. Zero Supabase round-trips; categories are returned in filing-count rank order.
- `SourceFacilitySummary.updated_at`: Returns `null` via Supabase path (facilities table exposes `created_at`, not `updated_at`).
- Manufacturing `excludedReviewCount`: Returns 43 as a documented aggregate baseline (43 excluded review profiles per QA evidence). Private mapping rows are not exposed via anon key.

---

## 7. Async Change

`getManufacturingOptions()` changed from sync to `async`. Caller in `app/manufacturing-brief/page.tsx` updated to `await getManufacturingOptions()`.

---

## 8. Files Modified

| File | Change |
|---|---|
| `lib/source-db.ts` | Add `isSupabaseActive()`, dispatch to Supabase functions |
| `lib/supabase-source.ts` | **NEW** — all Supabase implementations |
| `lib/manufacturing-match.ts` | Async profile loading, async `getManufacturingOptions` |
| `app/manufacturing-brief/page.tsx` | `await getManufacturingOptions()` |
| `e2e/chg-g6-002-vs-i.spec.ts` | **NEW** — VS-I E2E tests |
| `docs/qa/chg-g6-002-vs-i-supabase-runtime-wiring.md` | **NEW** — QA evidence |

---

## 10. 028C — Production Query Performance Fix (no-DDL)

**Finding:** `/api/products?page=1&pageSize=5` failed with PG 57014 at ~3.9s due to `reported_at DESC` ordering over 1,047,894 unindexed rows plus exact count.

**Measured read-only timings (anon key, no schema change):**
- `reported_at DESC` + exact count → HTTP 500 / PG 57014 at ~3.9s
- `report_no ASC` + planned count → HTTP 206 at ~0.46s
- HACCP inner join + planned count → HTTP 206 at ~0.63s
- `product_name plfts(simple)` for 김치 + planned count → HTTP 206 at ~1.76s

**No-DDL solution applied:**
1. `count:"planned"` (Postgres EXPLAIN estimate) replaces `count:"exact"` in product search and facility preview
2. `textSearch("product_name", q, {config:"simple",type:"plain"})` replaces `ilike OR` for free-text
3. `order("report_no", {ascending:true})` (PK, indexed) replaces `reported_at DESC` in both search and facility preview
4. `totalIsEstimate:true` added to `ProductSearchResult.meta` on the Supabase path
5. UI copy updated: "약 N건 · 품목보고번호순", search placeholder restricted to 제품명
6. E2E tests VS-I-020 and VS-I-021 added

---

## 11. 028D — Category Aggregate Snapshot Replacement

**Request ID:** CHG-G6-002-G4-VS-I-A-CATEGORY-SNAPSHOT-CLEANUP-028D

### Finding: 30-request keyset loop causes ~7.75s first-load latency

The original `listSourceProductCategoriesViaSupabase` implementation used a sequential keyset loop:
- 30 iterations of `.gt("category", lastCategory).limit(1)` — one HTTP round-trip per distinct category
- Measured first-load wall time: **~7.75s** on cold Supabase connection
- Returned categories in alphabetical order (low business value) rather than by filing frequency

### Solution: Static aggregate snapshot

Replaced the entire keyset loop with a checked-in aggregate of `production_log` (1,047,894 rows). Request 028E2 removed the duplicated name array; the JSON artifact below is now the single runtime source and is validated for 30 rows, ranks 1..30, unique non-empty names, and positive integer counts.

**Artifact:** `data/derived/chg-g6-002/product_category_top30.json`

| Field | Value |
|---|---|
| `source_db_sha256` | `23104bfccc0163fb2c17c3a89739ba1e05d713b841babe66d5b8b9a6666a7444` |
| `total_source_rows` | 1,047,894 |
| `generated_at` | 2026-08-31 |
| `change_id` | CHG-G6-002-G4-VS-I-A-CATEGORY-SNAPSHOT-CLEANUP-028D |

**Source query (executed read-only against the approved local SQLite `production_log` source):**
```sql
SELECT category, COUNT(*) n
FROM production_log
WHERE category IS NOT NULL AND length(trim(category)) > 0
GROUP BY category
ORDER BY n DESC, category ASC
LIMIT 30
```

**Safety rationale:** The JSON artifact contains only aggregate counts (rank, name, count). No individual product, facility, manufacturer, or personal data is present. Server code imports the JSON and exposes **names only** to the UI.

### Rank-1 result: 소스 (141,933 filings)

The snapshot delivers rank-ordered categories. Top 5:

| Rank | Name | Count |
|---|---|---|
| 1 | 소스 | 141,933 |
| 2 | 기타가공품 | 75,783 |
| 3 | 빵류 | 57,297 |
| 4 | 커피 | 48,747 |
| 5 | 향료 | 44,704 |

### Files changed

| File | Change |
|---|---|
| `data/derived/chg-g6-002/product_category_top30.json` | NEW — aggregate snapshot artifact |
| `lib/supabase-source.ts` | Remove `escapeIlike`; replace keyset loop + `_categoriesCache` with a validated JSON import |
| `e2e/chg-g6-002-vs-i.spec.ts` | Add VS-I-022 (contains 소스/과자/김치), VS-I-023 (no source hash/counts in HTML), VS-I-024 (소스 is rank-1 first non-default option) |

### Known limitations (updated)

Section 6 entry for `listSourceProductCategories` is superseded: the 30-request keyset loop is **replaced**. Zero Supabase round-trips at runtime. The static snapshot is rebuilt only when `production_log` data is re-published with a new `change_id`.

### Independent completion evidence

- `npm run lint`: PASS, 0 errors (5 pre-existing warnings outside VS-I changed code)
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS (line-ending notices only)
- Fresh production server `/products`: HTTP 200, cold first load 2.17s (before snapshot 7.75s)
- `npx playwright test e2e/chg-g6-002-vs-i.spec.ts --project=desktop --workers=1 --reporter=list`: **24/24 PASS**
- Supabase·Vercel·Git·legacy writes: none

---

## 9. Prohibited Actions

- No Supabase DDL, migration, INSERT, UPDATE, DELETE
- No Vercel changes
- No Git commit, push, PR, merge, tag
- No writes to legacy `wavenvibe/foodground`, `foodground.vercel.app`, or legacy Supabase
