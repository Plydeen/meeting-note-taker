import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { isEmailAllowed } from "@/lib/allowlist";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { isEmailAllowed };

// Returns the authenticated, allowlisted user, or null. Uses getUser() (not
// getSession) so the token is verified against Supabase on every call.
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isEmailAllowed(user.email)) {
    return null;
  }

  return user;
}

// For use in pages/layouts: guarantees a user or redirects to /login.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login" as Route);
  }
  return user;
}

// Ensure a profiles row exists so calendar_connections / meetings foreign keys
// resolve even before the user connects a Google account.
export async function ensureProfile(user: User): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null,
    },
    { onConflict: "id" },
  );
}
