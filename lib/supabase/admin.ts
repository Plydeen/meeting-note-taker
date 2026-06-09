import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env, requireEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseAdmin() {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  return createClient<Database>(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
