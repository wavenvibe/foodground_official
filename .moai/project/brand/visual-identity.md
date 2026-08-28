# Foodground visual identity input

This is a direction brief for Claude Code + MoAI. Claude owns the detailed G3
design and may refine exact accessible shades and component geometry.

## Color direction

primary: "#03C75A"
secondary: "#31394D"
accent: "#00FC43"

neutral_scale:
  50: "#F8F8F6"
  100: "#F1F1EE"
  200: "#E4E5E1"
  300: "#D7DBE1"
  400: "#A7ADB8"
  500: "#7B8493"
  600: "#667085"
  700: "#454D5C"
  800: "#31394D"
  900: "#20242C"
  950: "#12151B"

background: "calm light gray; #F1F1EE is the starting reference"
surface: "white or a nearby neutral surface with visible hierarchy"

Green is a point color for actions, selected states, progress, and important
values. It must not fill the whole interface.

## Typography direction

primary_font: Claude should propose a readable Korean web/system sans-serif with no new paid license.
secondary_font: same family unless a clear hierarchy need is demonstrated.
mono_font: system monospace only where identifiers or technical values require it.
font_source: local or system font preferred; no new paid font service.

## Logo

logo_file: use an approved Foodground vector asset when available; do not redraw or invent a final logo.
logo_dark_file: propose only if the approved asset requires a dark-background variant.
logo_max_height: Claude should determine during responsive header design.

## Layout preferences

hero_layout: work-centered B2B layout; avoid a promotional landing-page hero dominating the service.
section_rhythm: clear information hierarchy using restrained surfaces, dividers, tables, and cards.
border_radius_style: restrained, professional radius; avoid excessive pill shapes.

## Dark mode

dark_mode_support: not required in the current scope unless Claude proves it has negligible implementation and QA cost.

## Visual do's and don'ts

dos:
  - Preserve the A-option work-centered information architecture.
  - Use calm gray background with clear white or neutral work surfaces.
  - Use green sparingly for action and status.
  - Design for dense B2B search, comparison, projects, and evidence-backed results.
  - Validate 1440px desktop and 390px mobile behavior.
  - Make loading, empty, error, permission, and external-service failure states feel intentional.

donts:
  - Do not use a full-page bright green background.
  - Do not create generic AI gradients, glassmorphism, or oversized marketing copy.
  - Do not expose TIPS scores, evidence, or project branding in user screens.
  - Do not make unverified recommendations appear certain.
  - Do not rely on color alone for status or validation.

Reference: `docs/design/g3-03-option2/`
Last updated: 2026-08-12
