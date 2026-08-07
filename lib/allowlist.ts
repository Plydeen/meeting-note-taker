import { env } from "@/lib/env";

// Defense-in-depth on top of disabled Supabase signups: if ALLOWED_EMAILS is
// set, only those addresses may use the app. If it is empty, any authenticated
// Supabase user is permitted (rely on signups being disabled).
export function getAllowedEmails(): string[] {
  return (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email?: string | null): boolean {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) {
    return true;
  }
  if (!email) {
    return false;
  }
  return allowed.includes(email.toLowerCase());
}
