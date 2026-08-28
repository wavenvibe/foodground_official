# Foodground architecture constraints and design hypotheses

## Status

The runtime stack, environment isolation, Supabase-only database constraint,
zero additional cash spend, and legacy read-only boundary are fixed. Route
names, component boundaries, API envelopes, schema layout, exact RLS policies,
and migration order below are Codex draft hypotheses. Claude Code + MoAI must
review them against the requirements and record any accepted or replaced
decision in the G3 design outputs before implementation.

## Runtime

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4 and project CSS variables
- Supabase PostgreSQL and RLS in the isolated new project; Auth and private Storage are deferred unless a new change is approved
- Vercel deployment target isolated from the legacy site

Read the relevant local Next.js guide in `node_modules/next/dist/docs/` before changing App Router behavior.

## Boundaries

- Public searchable masters live in the `public` schema and expose safe fields only.
- Current public read models expose approved safe fields only. User-owned data and Auth are not part of CHG-G4-002.
- Operator, ingest, audit, and external-call details live in non-Data-API schemas such as `private`, `ops`, and `audit`.
- Service-role keys and third-party credentials are server-only. They must not appear in browser bundles, logs, documents, or fixtures.
- OCR, image uploads, public re-analysis, and a persistent Python/Streamlit service are out of the current scope.

## Alternative-ingredient integration — fixed boundary

- Audit the existing `final_output` analysis folder read-only. Do not modify or serve it directly.
- Record source path, filename, size, SHA-256, row count, schema mapping, and rejected-row counts before loading.
- Load approved precomputed outputs through staging, validation, and publish migrations into the isolated new Supabase project only after design approval.
- The public web reads precomputed candidates. It does not accept uploads or execute the legacy analysis pipeline.
- Treat exact and substring matches as different provenance. Do not hide the observed 52.85% unique-name match risk in QA.
- Do not claim price, cost-saving, sensory equivalence, medical effect, or legal compliance.

## API and errors — draft proposal

Successful APIs return `data`, `meta`, and `traceId`. Failed APIs return:

```json
{
  "error": {
    "code": "FG_DATA_UNAVAILABLE",
    "message": "조회 데이터를 불러오지 못했습니다.",
    "retryable": true,
    "fallback": "retry"
  },
  "traceId": "public-safe-id"
}
```

Do not expose SQL, table names, provider URLs, prompt text, credentials, or stack traces in public errors.

## Search — required behavior, implementation to be designed

- Stable ordering always includes a unique tie-breaker.
- Maximum page size is 50.
- Search input is length-limited and sanitized before PostgREST filter composition.
- Public browser code receives only anon-safe output; service-role access stays server-side.
- Empty results and data unavailability are different states.

## Routes — draft proposal

- `/facilities`, `/facilities/[id]`
- `/products`, `/products/[id]`
- `/recipes`, `/recipes/[id]`
- `/ingredients`, `/ingredients/[id]`
- `/substitutes`
- `/label-guide` only if approved source material is provided

Compatibility routes `/search`, `/b/[id]`, and `/signin` may redirect or render the same canonical implementation during transition.
