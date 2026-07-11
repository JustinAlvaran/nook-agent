import { createClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "../env";
import type { Database } from "./database.types";

export function createSupabaseAdminClient() {
  const env = getServerEnvironment();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
