<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Foodground repository boundary

- This repository, `wavenvibe/foodground_official`, is the only writable Foodground codebase.
- Treat `wavenvibe/foodground`, `foodground.vercel.app`, and the legacy Supabase as immutable TIPS-reproduction references.
- Never push, deploy, migrate, or write to the legacy repository, Vercel project, or Supabase.
- Use separate environment variables, Supabase, and deployment targets for this repository.
- Do not copy `.env`, credentials, tokens, personal data, or hard-coded keys from the legacy source.

# Foodground project harness

## Required reading order

Before planning or editing, read these files in order:

1. `.moai/project/product.md`
2. `.moai/project/architecture.md`
3. `.moai/project/quality-gates.md`
4. `.moai/project/current-slice.md`
5. The work order referenced by `current-slice.md`

The active CHG-G4-002 work order defines which sources are authoritative. The Codex-authored
`docs/architecture/g3-05/IMPLEMENTATION_CONTRACT.md`, DOC-10, DOC-11, TEC-03,
TEC-04, and the existing uncommitted VS-1A code are review inputs only until
Claude Code + MoAI completes G3 and the user approves the result.

`docs/design/g3-03-option2/` records the user-approved visual direction:
work-centered B2B information structure, calm gray background, and green used
as a point color. Claude may redesign detailed layouts, components, tokens, and
responsive behavior while preserving that direction.

## Current execution rules

- Work one vertical slice at a time: UI, data access, authorization, states, and evidence move together.
- Current gate is G3 CHG-G4-002 integration design by Claude Code + MoAI. Do not implement or edit application code until the user approves the change-aware design outputs.
- Current commercial baseline is KRW 20,000,000 and 2.40-3.30 MM. Do not restore the previous KRW 40M scope.
- Existing alternative-ingredient outputs are pre-existing assets. Price only the safe transfer, schema, UI, integration, QA, deployment, and handoff work; do not describe the algorithm as newly developed.
- Do not implement public uploads, Python/Streamlit serving, OCR, RAG/LLM, Auth/projects, group-buy boards, private posts, or the 1,047,894-record migration in the current slice.
- Use Supabase only. Do not add another database, ORM, paid API, or SaaS without user approval.
- Keep TIPS metrics and evidence internal to requirements, QA, and acceptance. Do not create a TIPS menu, performance dashboard, or evidence screen for users.
- Historical TIPS results are prior local R&D evidence. This web project uses them as design and measurement references; reproducing or guaranteeing the same scores is a later, separately approved enhancement.
- Do not present unavailable data as an empty successful result. Use the approved `FG_*` error contract and a visible recovery path.
- Treat Server Component boundaries, canonical routes, API envelopes, schema details, and exact tokens in the Codex drafts as hypotheses to verify during G3, not immutable decisions.
- Never claim a slice complete until lint, build/type validation, responsive browser checks, error/empty/loading states, and requirement trace evidence are recorded.

## Git and change safety

- Do not commit, push, create a PR, merge, tag, deploy, or apply a remote migration unless the user explicitly requests that action.
- Do not auto-create, auto-merge, or auto-clean worktrees for this project.
- Preserve unrelated and untracked files. Never replace approved documents; create a new revision when a contract document must change.
