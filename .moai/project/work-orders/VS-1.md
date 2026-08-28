# VS-1 public discovery work order

## Objective

Implement public search and detail flows for facilities, products, recipes, and ingredients against the approved new Supabase contract. Deliver them in that order, starting with VS-1A facilities.

## VS-1A facility unit

### Deliverables

- Canonical list route `/facilities` and detail route `/facilities/[id]`.
- Compatibility behavior for `/search` and `/b/[id]`.
- Server-side data access to `public.facilities` with safe filters, stable ordering, maximum 50 rows, and explicit unavailable state.
- Shared `StatePanel` plus route loading, error, empty, and not-found states.
- Quiet Canvas, Slate, and Point Green approved design applied without a new UI library.
- A migration file for the VS-1 facility public master and anonymous read RLS. Do not apply it remotely without a separate target/recovery check.
- Lint, build, desktop/mobile browser evidence, and a requirement/evidence note.

### Non-goals for this unit

- Remote migration or data load
- Products, recipes, or ingredients implementation
- Saved items or login behavior changes
- Vercel deployment
- Legacy source, Vercel, or Supabase changes

### Exit criteria

- A configured new Supabase can return facility results through the canonical route.
- Missing configuration or a data-source error produces `FG_DATA_UNAVAILABLE`, not an empty-success claim.
- Identical input has deterministic result order using `name, mgt_no`.
- Mobile filters remain usable at 390px and no page has horizontal overflow.
- `npm run lint` and `npm run build` pass.
- Remote connection, data count, RLS, and performance remain explicitly pending until tested against the isolated project.

## Implementation log

### 2026-08-10 — VS-1A code and offline-state implementation

- Added canonical `/facilities` and `/facilities/[id]` routes.
- Converted `/search` and `/b/[id]` to query/id-preserving compatibility redirects.
- Added isolated-project ref validation before any public facility query.
- Added safe facility filters, deterministic `name, mgt_no` order, 20-row pagination, public API error contract, and trace IDs.
- Added shared state panel, route loading, empty, error, and not-found states.
- Applied approved Slate, Canvas, Surface, Ink, and Point Green tokens.
- Added `supabase/migrations/20260810001000_0010_vs1_facilities.sql` without remote execution.
- Changed-file ESLint: pass.
- Next.js production build: pass.
- Browser QA at 1440×1000 and 390×844: HTTP 200, no horizontal overflow, no console/page errors, unavailable state and trace visible.
- Compatibility query preservation and API 503 `FG_DATA_UNAVAILABLE`: pass.

Evidence:

- `output/playwright/vs1/qa-report.json`
- `output/playwright/vs1/facilities-desktop.png`
- `output/playwright/vs1/facilities-mobile.png`

Pending before completion:

- Apply the reviewed migration to new project `glczrbadvfgmblmkpgfj` after target/recovery confirmation.
- Load and reconcile the 94,723 facility runtime baseline.
- Verify anonymous SELECT and denied writes against remote RLS.
- Verify real search, detail, count, deterministic page boundaries, and performance.
- Existing repository-wide ESLint errors remain in legacy saved-item effects (3 errors); they are outside this unit and must be cleared before the G4 gate.
