import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "glczrbadvfgmblmkpgfj";

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

export function createPublicServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigurationError("New Supabase public configuration is missing.");
  }

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new SupabaseConfigurationError("New Supabase URL is invalid.");
  }

  if (hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`) {
    throw new SupabaseConfigurationError("Supabase target is not the approved isolated project.");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
