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
