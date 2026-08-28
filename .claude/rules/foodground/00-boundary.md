# Foodground boundary rule

Only `wavenvibe/foodground_official` is writable. The legacy repository, `foodground.vercel.app`, and the legacy Supabase are immutable references. Never run a write operation, deployment, migration, RPC, commit, push, PR, or tag against them.

Remote changes to the new Supabase or Vercel target require a target identifier and recovery check in the current work order before execution.
