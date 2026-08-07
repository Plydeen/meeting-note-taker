import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env, requireEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

function getSupabaseUrl() {
  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  return supabaseUrl;
}

// Auth client bound to the request cookie jar. All auth happens server-side so
// the (possibly internal) Supabase URL is never shipped to the browser.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `set` throws when called from a Server Component render. Session
          // refresh is handled by middleware, so this can be safely ignored.
        }
      },
    },
  });
}
