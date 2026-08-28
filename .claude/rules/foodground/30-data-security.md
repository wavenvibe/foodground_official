# Foodground data and security rule

Use only the isolated new Supabase contract. Public code may use anon-safe data only. Keep service-role and external credentials server-side. Use RLS for owner boundaries. Do not expose SQL, table names, provider URLs, prompts, credentials, personal data, or stack traces in public errors. Treat empty results and unavailable data as different states.
