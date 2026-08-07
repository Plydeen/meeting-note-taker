"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { isEmailAllowed } from "@/lib/allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing" as Route);
  }

  if (!isEmailAllowed(email)) {
    redirect("/login?error=not_allowed" as Route);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid" as Route);
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login" as Route);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/login/forgot-password?error=missing" as Route);
  }

  // Only send the email for allowlisted accounts, but always redirect to the
  // same confirmation screen so this can't be used to probe which emails exist.
  if (isEmailAllowed(email)) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.APP_BASE_URL}/reset-password`,
    });
  }

  redirect("/login/forgot-password?sent=1" as Route);
}
