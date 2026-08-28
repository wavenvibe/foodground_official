import "server-only";

/**
 * USE_FIXTURES: true only in local development without Supabase env vars.
 * Never active in production — production always uses real Supabase or fails.
 */
export const USE_FIXTURES =
  process.env.NODE_ENV !== "production" &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL;
