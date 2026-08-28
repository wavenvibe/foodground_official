# Foodground quality gates

## A vertical slice is complete only when

1. The user-visible flow works through its real data-access boundary.
2. Authentication and RLS behavior are verified for anonymous, owner, non-owner, and operator roles where relevant.
3. Loading, empty, expected error, not-found, and success states are implemented where relevant.
4. Desktop 1440px and mobile 390px have no horizontal overflow, clipped text, broken focus order, or unusable controls.
5. `npm run lint` and `npm run build` pass. Add focused automated tests when behavior can be isolated without installing unnecessary infrastructure.
6. No secret, personal data, SQL detail, provider URL, or internal prompt is exposed to the browser or public error.
7. Requirement IDs, evidence paths, known limits, and rollback notes are recorded in the current work order.
8. The project board and any affected document-register record are updated.

## User-approved visual direction

- Canvas `#F1F1EE`
- Slate `#31394D`
- Point Green `#03C75A`
- Surface `#FFFFFF`
- Ink `#20242C`
- Muted `#667085`
- Rule `#D7DBE1`

These values are starting references, not a locked design system. Claude may
refine accessible shades, typography, spacing, component geometry, and state
behavior while preserving a calm gray background and restrained green point
color. Green must not become a page-wide decorative fill.

## Completion language

- “Implemented” means code exists and static validation passes.
- “Connected” means the approved isolated Supabase environment responds through the expected contract.
- “Verified” means role, error, responsive, and regression checks have evidence.
- “Complete” requires all three. Never use an empty result caused by a connection failure as completion evidence.
