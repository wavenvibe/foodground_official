# VS-2 Migration Procedure
## CHG-G4-002 -- Supabase Schema Initialization + Data Load

- Gate: G3-07 CHG-G4-002
- Target project: `glczrbadvfgmblmkpgfj` (Mumbai / ap-south-1, nano)
- Stage: VS-2 (design approved; local files ready; **remote execution pending user approval**)
- Created: 2026-08-25

---

## 0. Scope Summary

| Item | Detail |
|---|---|
| Migration files | 8 DDL files + 1 rollback file (`supabase/migrations/20260825*`) |
| Load scripts | 7 Python scripts (`scripts/vs2_load_*.py`, `scripts/vs2_export_*.py`) |
| Validation script | `scripts/vs2_validate.py` |
| Approval checkpoints | A (schema), B (staging count), C (public access) |

### Tables Created

| Table | Schema | Rows | Source |
|---|---|---|---|
| `data_lineage` | private | few | ingest run registry |
| `standard_foods` | public | 686 | food_master.csv |
| `substitute_pairs` | public | 234,955 | food_pair_similarities.csv |
| `ingredient_name_match` | public | 23,806 | ingredient_matching.csv |
| `recipes` | public | 70,165 | recipes.db → recipes table (runtime master) |
| `ingredients` | public | 18,932 | recipes.db → ingredients (1 rejected: NULL name) |
| `recipe_ingredients` | public | 679,457 | recipes.db → recipe_ingredients (relationship data) |
| `facilities` | public | 94,723 | legacy facility SQLite DB |

**Baseline separation (do not mix):**

| Baseline | Rows | Source | Purpose |
|---|---|---|---|
| 원본 런타임 기준 (original runtime) | 70,165 recipes + **18,933** ingredients + 94,723 facilities = **183,821** | Source DBs before migration | Design references, TIPS metrics, work-order scope figures |
| 공개 적재 결과 (public ingest result) | 70,165 recipes + **18,932** ingredients + 94,723 facilities = **183,820** | recipes.db + foodground.db loaded into Supabase; 1 ingredient rejected (NULL name) | Actual Supabase row counts; QA validation targets |
| Analysis baseline | 69,406 recipes + 686 std foods + 234,955 pairs | recipe_ingredients.csv et al. | Alternative-ingredient engine (precomputed) |

> **Note**: "원본 런타임 기준" (18,933 / 183,821) is the source-of-truth before migration.
> "공개 적재 결과" (18,932 / 183,820) is what was actually loaded after rejecting 1 ingredient with NULL name.
> Do not call the ingest result "original runtime baseline" or "runtime master".

`recipe_ingredients` (679,457 rows) is relationship data and is NOT counted in either baseline total.

### Estimated Sizes

| Table | Rows | Est. Size |
|---|---|---|
| substitute_pairs | 234,955 | ~120 MB |
| recipe_ingredients | 679,457 | ~200 MB |
| recipes | 70,165 | ~30 MB |
| facilities | 94,723 | ~50 MB |
| ingredients | 18,932 | ~5 MB |
| standard_foods | 686 | ~1 MB |
| ingredient_name_match | 23,806 | ~5 MB |
| **Total** | | **~411 MB** |

---

## 1. Prerequisites

Before running any remote step:

- [ ] Python 3.11+ available
- [ ] `pip install psycopg2-binary` (or psycopg2)
- [ ] `final_output/` directory available locally (analysis baseline CSVs)
- [ ] recipes.db accessible at configured path
- [ ] foodground.db accessible at configured path
- [ ] Service-role connection string ready (never in version control)
- [ ] Supabase CLI available: `supabase --version`
- [ ] SHA-256 of analysis CSV source files verified against VS-1 audit

```bash
# Verify source file SHA-256 (analysis baseline CSVs)
python -c "
import hashlib, sys
with open(sys.argv[1], 'rb') as f:
    print(hashlib.sha256(f.read()).hexdigest())
" final_output/food_pair_similarities.csv
```

Expected hashes (analysis baseline CSVs only):
| File | SHA-256 |
|---|---|
| food_master.csv | `d32590cddac31ca7fcc6f2c6ef6a2ecff467c9b983786d0bd657a1573a50eb17` |
| food_pair_similarities.csv | `7acbf108272c357a335d3821f39fbca5e3e6c8dc3bf74ee497bc1a4899d43421` |
| ingredient_matching.csv | `91277d6eda926d71ef67cd2c93f593d683afc4dce59661abdeb4d80aec12ec8f` |
| recipe_ingredients.csv | `9b7d557714214149d137bd6f37c8b67abf3f19b6ed126bed864b95a21bf9e9ff` |

SQLite sources are read-only production databases; SHA-256 is not pre-computed.

---

## 2. Local Dry-Run (No Remote Changes)

Run these before approval point A. No DB connection required.

```bash
# Validate all local sources: analysis CSVs + SQLite runtime masters
python scripts/vs2_validate.py --mode csv
# Expected: ALL rows OK, match_type distribution OK

# Dry-run: analysis CSV load scripts
python scripts/vs2_load_standard_foods.py
python scripts/vs2_load_substitute_pairs.py
python scripts/vs2_load_ingredient_name_match.py

# Dry-run: runtime master export scripts (recipes.db + foodground.db)
python scripts/vs2_export_recipes_master.py
python scripts/vs2_export_ingredients.py
python scripts/vs2_export_recipe_ingredients.py
python scripts/vs2_export_facilities.py
# Expected: "dry-run complete (no DB writes)" for each
```

All scripts should exit 0 with "Validation: PASS" before proceeding to Approval Point A.

### Dry-Run Results (confirmed 2026-08-25/26)

| Script | Source | Count | Result |
|---|---|---|---|
| vs2_load_standard_foods.py | food_master.csv | 686 | PASS |
| vs2_load_substitute_pairs.py | food_pair_similarities.csv | 234,955 | PASS |
| vs2_load_ingredient_name_match.py | ingredient_matching.csv | 23,806 | PASS |
| vs2_export_recipes_master.py | recipes.db → recipes | 70,165 | PASS |
| vs2_export_ingredients.py | recipes.db → ingredients | 18,932 loaded (1 rejected) | PASS |
| vs2_export_recipe_ingredients.py | recipes.db → recipe_ingredients | 679,457 | PASS |
| vs2_export_facilities.py | foodground.db → facility | 94,723 | PASS |
| vs2_validate.py --mode csv | all sources | ALL | PASS |

---

## 3. APPROVAL POINT A -- Schema Creation (Remote)

**STOP HERE. Do not proceed without explicit user approval.**

User must confirm:
- G3 design review is complete and approved
- Target project `glczrbadvfgmblmkpgfj` is the correct isolated project
- Service-role key is ready
- Rollback SQL has been reviewed

### Commands to Run at Approval Point A

```bash
# Set connection string -- obtain from Supabase Dashboard:
#   Settings -> Database -> Connection string -> URI (choose "Session mode" / port 5432)
#   Enter the DB password when prompted, or inject via PGPASSWORD env var.
#   Never hard-code the password in files, logs, or version control.
export SUPABASE_DB_URL="postgres://postgres.<project-ref>:<DB-PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
# Alternative (direct, bypasses PgBouncer):
# export SUPABASE_DB_URL="postgres://postgres:<DB-PASSWORD>@db.glczrbadvfgmblmkpgfj.supabase.co:5432/postgres"

# Apply DDL migrations in order
supabase db push --db-url "$SUPABASE_DB_URL"

# Or run manually in order:
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825001000_0020_vs2_init_schemas.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825002000_0021_vs2_standard_foods.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825003000_0022_vs2_substitute_pairs.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825004000_0023_vs2_ingredient_name_match.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825004500_0024_vs2_recipes.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825005000_0025_vs2_facilities_v2.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825006000_0026_vs2_ingredients.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260825007000_0027_vs2_recipe_ingredients.sql
```

### Post-Schema Verification

```sql
-- Run in Supabase SQL editor or psql:
SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('private', 'staging');
SELECT table_name, table_schema FROM information_schema.tables
  WHERE table_schema IN ('public', 'private', 'staging')
  ORDER BY table_schema, table_name;
-- Expected: private.data_lineage, staging.* (hidden from PostgREST),
--           public.standard_foods, substitute_pairs, ingredient_name_match,
--           recipes, ingredients, recipe_ingredients, facilities

SELECT has_schema_privilege('anon', 'private', 'USAGE');  -- must be false
SELECT has_schema_privilege('anon', 'staging', 'USAGE');  -- must be false
```

### Rollback (if needed)

```bash
psql "$SUPABASE_DB_URL" -f supabase/rollback/vs2_rollback.sql
# Uncomment the STAGE 1 ROLLBACK section first
```

---

## 4. Data Load (After Approval Point A)

Load scripts run after DDL is applied. Each script loads into a staging table.

```bash
# Analysis baseline: standard foods (686 rows)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_load_standard_foods.py

# Analysis baseline: substitute pairs (234,955 rows -- ~2-5 min)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_load_substitute_pairs.py

# Analysis baseline: ingredient name match (23,806 rows)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_load_ingredient_name_match.py

# Runtime master: recipes (70,165 rows from recipes.db)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_export_recipes_master.py

# Runtime master: ingredients (18,932 rows loaded, 1 rejected from recipes.db)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_export_ingredients.py

# Relationship data: recipe-ingredient links (679,457 rows from recipes.db -- ~5-10 min)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_export_recipe_ingredients.py

# Runtime master: facilities (94,723 rows from foodground.db)
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_export_facilities.py
```

Each script prints its `ingest_run_id` (UUID). Record these for audit.

---

## 5. APPROVAL POINT B -- Staging Count Verification

**STOP HERE. Do not publish to public tables without user confirmation.**

```bash
# Run staging validation
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_validate.py --mode staging
```

Expected output (all checks must show OK):
```
standard_foods                                         :     686  OK
substitute_pairs                                       :  234,955  OK
ingredient_name_match                                  :  23,806  OK
recipes                                                :  70,165  OK
ingredients                                            :  18,932  OK
recipe_ingredients                                     : 679,457  OK
facilities                                             :  94,723  OK

match_type distribution:
  exact      :    488  OK
  substring  : 11,764  OK
  fuzzy      :    295  OK
  synonym    :     35  OK
  unmatched  : 11,224  OK

Unmatched rows invariant: OK
=== VALIDATION PASS ===
```

If any check fails: run Stage 2 rollback (`TRUNCATE staging.*`), fix the issue, reload.

### Publish: Staging -> Public Tables

After user confirms staging counts:

```sql
-- Run in order; each is idempotent (ON CONFLICT DO UPDATE)

INSERT INTO public.standard_foods
SELECT * FROM staging.standard_foods
ON CONFLICT (standard_food_id) DO UPDATE SET
  name = EXCLUDED.name, food_group = EXCLUDED.food_group,
  representative_ingredient = EXCLUDED.representative_ingredient,
  usage_row_count = EXCLUDED.usage_row_count, recipe_count = EXCLUDED.recipe_count,
  energy_kcal = EXCLUDED.energy_kcal, water_g = EXCLUDED.water_g,
  protein_g = EXCLUDED.protein_g, fat_g = EXCLUDED.fat_g,
  ash_g = EXCLUDED.ash_g, carbohydrate_g = EXCLUDED.carbohydrate_g,
  basis_date = EXCLUDED.basis_date, ingest_run_id = EXCLUDED.ingest_run_id;

INSERT INTO public.substitute_pairs
SELECT * FROM staging.substitute_pairs
ON CONFLICT ("기준식품ID", "후보식품ID") DO UPDATE SET
  sim_nutrition = EXCLUDED.sim_nutrition,
  sim_ingredient_category = EXCLUDED.sim_ingredient_category,
  sim_food_group = EXCLUDED.sim_food_group,
  sim_cooking_state = EXCLUDED.sim_cooking_state,
  sim_dish_type = EXCLUDED.sim_dish_type,
  sim_companion = EXCLUDED.sim_companion,
  score_composite = EXCLUDED.score_composite,
  score_final = EXCLUDED.score_final,
  available_sim_count = EXCLUDED.available_sim_count,
  basis_date = EXCLUDED.basis_date, ingest_run_id = EXCLUDED.ingest_run_id;

INSERT INTO public.ingredient_name_match
SELECT * FROM staging.ingredient_name_match
ON CONFLICT (input_name) DO UPDATE SET
  standard_food_id = EXCLUDED.standard_food_id,
  match_type = EXCLUDED.match_type,
  match_confidence = EXCLUDED.match_confidence,
  basis_date = EXCLUDED.basis_date, ingest_run_id = EXCLUDED.ingest_run_id;

INSERT INTO public.recipes
SELECT * FROM staging.recipes
ON CONFLICT (recipe_id) DO UPDATE SET
  title = EXCLUDED.title, category_large = EXCLUDED.category_large,
  category_mid = EXCLUDED.category_mid, category_small = EXCLUDED.category_small,
  servings = EXCLUDED.servings,
  basis_date = EXCLUDED.basis_date, ingest_run_id = EXCLUDED.ingest_run_id;

INSERT INTO public.ingredients
SELECT * FROM staging.ingredients
ON CONFLICT (ingredient_id) DO UPDATE SET
  ingredient_name = EXCLUDED.ingredient_name,
  basis_date = EXCLUDED.basis_date, ingest_run_id = EXCLUDED.ingest_run_id;

-- recipe_ingredients: truncate-reload pattern (no natural conflict key)
TRUNCATE public.recipe_ingredients;
INSERT INTO public.recipe_ingredients
  (recipe_id, ingredient_id, amount_raw, unit_raw, amount_gram, sort_order, is_seasoning)
SELECT recipe_id, ingredient_id, amount_raw, unit_raw, amount_gram, sort_order, is_seasoning
FROM staging.recipe_ingredients;

INSERT INTO public.facilities
SELECT * FROM staging.facilities
ON CONFLICT (mgt_no) DO UPDATE SET
  name = EXCLUDED.name, region_sido = EXCLUDED.region_sido,
  region_sigungu = EXCLUDED.region_sigungu, business_type = EXCLUDED.business_type,
  is_haccp = EXCLUDED.is_haccp, status = EXCLUDED.status,
  tel = EXCLUDED.tel, homepage = EXCLUDED.homepage,
  ingest_run_id = EXCLUDED.ingest_run_id;
```

---

## 6. APPROVAL POINT C -- Public Access Activation

**STOP HERE. Do not run until user grants final approval.**

RLS policies and indexes are already created by the DDL migrations. After publish:

```bash
# Verify public access
SUPABASE_DB_URL="$SUPABASE_DB_URL" python scripts/vs2_validate.py --mode public

# Test anon access (use anon key, not service-role)
curl "https://glczrbadvfgmblmkpgfj.supabase.co/rest/v1/standard_foods?select=standard_food_id,name,food_group&limit=5" \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [ANON_KEY]"
# Expected: 5 rows with standard_food_id, name, food_group

curl "https://glczrbadvfgmblmkpgfj.supabase.co/rest/v1/recipes?select=recipe_id,title,category_large&limit=5" \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [ANON_KEY]"
# Expected: 5 rows with recipe_id (INTEGER), title, category_large
```

### Rollback at Stage 3

If public access needs to be revoked after publish:

```sql
-- Uncomment STAGE 3 ROLLBACK section in vs2_rollback.sql
REVOKE SELECT ON public.recipe_ingredients  FROM anon, authenticated;
REVOKE SELECT ON public.ingredients         FROM anon, authenticated;
REVOKE SELECT ON public.recipes             FROM anon, authenticated;
REVOKE SELECT ON public.facilities          FROM anon, authenticated;
REVOKE SELECT ON public.substitute_pairs    FROM anon, authenticated;
REVOKE SELECT ON public.standard_foods      FROM anon, authenticated;
REVOKE SELECT ON public.ingredient_name_match FROM anon, authenticated;
-- Note: does NOT truncate or drop tables; data is preserved
```

---

## 7. Known Limits and Open Items

| Item | Detail |
|---|---|
| Baseline separation | recipes.db runtime master (70,165) and analysis CSV baseline (69,406) must never be mixed. The 69,406 figure is valid only for the alternative-ingredient pipeline. |
| ingredients reject | ingredient_id=1124336 (NULL name) excluded. Confirmed 0 FK references in recipe_ingredients. reject_count=1 recorded in data_lineage. |
| recipe_ingredients size | 679,457 rows (~200 MB). Load uses streaming with 5,000-row chunks. Allow ~5-10 min. |
| recipe_ingredients publish | Uses TRUNCATE + INSERT (no ON CONFLICT key) -- this is the one exception to the no-TRUNCATE-public rule, applied only during initial load before users access data. Coordinate timing with Approval Point C. |
| `계산가능_유사도수` range | VS-1 confirms 4-6. Rows with count 4 (100 rows, 0.04%) have 2 NULL sim values; score_composite renormalized correctly. |
| `지방 ` trailing space | food_master.csv column name has a trailing space. Load script strips all keys dynamically. |
| UTF-8 BOM | All 4 analysis CSVs use UTF-8-BOM. Scripts use `encoding='utf-8-sig'`. |
| match_type mapping | Source CSV uses Korean. Load script maps to English enum: 미매칭 -> unmatched (per DDL CHECK constraint). |
| raw_text excluded | recipes.db.recipes.raw_text (full recipe text) is excluded from public.recipes to limit payload. |
| SHA-256 for SQLite | Not pre-computed. SQLite files are read-only production databases; row counts are the integrity check. |

---

## 8. Rollback Summary

| Stage | Method | Effect |
|---|---|---|
| Before Approval A | None needed (local only) | -- |
| After A, before B | `DROP TABLE IF EXISTS staging.*` | Staging tables removed; public tables untouched |
| After B (staging loaded) | `TRUNCATE staging.*` | Staging emptied for re-load |
| After C (data published) | `REVOKE SELECT ON public.<table> FROM anon, authenticated` (each table explicitly) | Public read access revoked; data preserved |
| Full reset | Stage 1 rollback (DROP TABLE public.* + DROP SCHEMA private + staging) | **Data destroyed** -- only if starting over from scratch |

**Never use TRUNCATE on public tables (except recipe_ingredients during initial load at Approval C, coordinated with user).**
**Never disable RLS (B-08).**
