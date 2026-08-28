# Foodground product baseline

## User outcome

Foodground helps food-business users explore food data, find alternative ingredients, identify suitable manufacturing companies, and prepare an email inquiry.

TIPS performance metrics are internal design, measurement, and evidence references. Users should see useful functions, not TIPS branding or a performance-results dashboard. Historical scores were achieved in a prior local test environment; reproducing or guaranteeing those scores in the new web runtime is not a current delivery target and requires a separately approved enhancement.

## Approved scope

1. Public discovery for facilities, recipes, and ingredients; preserve already working public product behavior without a new full-data migration obligation.
2. Alternative-ingredient search and ranked candidates from the approved precomputed analysis outputs, including six similarity metrics, nutrition comparison, provenance, match type, and limitations.
3. Manufacturing-facility conditions, filtering, ranking, reasons, detail navigation, and a link from an alternative candidate into facility search.
4. Supplier inquiry through a browser `mailto:` draft with a copy fallback; no server mail provider.
5. Optional curated label-law search and FAQ only when the client supplies approved, dated sources. No generative answer or automatic legal determination.
6. Responsive states, QA, security, isolated deployment, evidence, and handoff.

Login, saved items, productization projects, OCR, RAG/LLM, group-buy boards, private posts, a new 1,047,894-record migration, contract, payment, settlement, real-time chat, and push notification are later enhancements unless a new change is approved.

## Fixed constraints

- Contract value baseline: KRW 20,000,000 including VAT assumption, pending vendor confirmation.
- Planning range: 2.40-3.30 person-months; working midpoint 2.85.
- Contract/evidence period: 2025-10-01 through 2026-08-20.
- Additional cash spend: KRW 0 unless the user approves a change.
- Database: Supabase paid organization, new isolated project only.
- Runtime data baseline: recipes 70,165; ingredients 18,933; facilities 94,723; total 183,821.
- Historical TIPS baseline: recipes 25,000; ingredients 3,000; facilities 76,000; total 104,000. Never mix it with the runtime baseline.
- Existing alternative-ingredient asset baseline: 69,406 recipes; 553,763 recipe-ingredient rows; 686 standard foods; 234,955 precomputed food pairs. The source analysis folder is read-only.
- Unique-name match observation: 12,582 of 23,806 names, or 52.85%; substring matches require visible provenance and QA.
- Product filing migration target 1,047,894 is deferred under CHG-G4-002.

## Immutable references

- Repository: `wavenvibe/foodground`
- Site: `https://foodground.vercel.app`
- Legacy paid Supabase used for TIPS reproduction

Read these only. Never commit, push, deploy, migrate, call a write RPC, or mutate data there.
