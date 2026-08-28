import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _instance: SupabaseClient | undefined;

function getInstance(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _instance;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getInstance()[prop as keyof SupabaseClient];
  },
});

export default supabase;
