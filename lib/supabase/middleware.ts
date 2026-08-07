import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env, requireEnv } from "@/lib/env";
import { isEmailAllowed } from "@/lib/allowlist";
import type { Database } from "@/lib/supabase/types";

// Paths that authenticate themselves (bearer tokens / webhook signatures) or
// must stay reachable without a session.
const PUBLIC_PATHS = ["/reset-password", "/api/auth/set-password"];
const PUBLIC_PREFIXES = ["/api/cron", "/api/webhooks", "/api/mcp", "/login"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  const supabase = createServerClient<Database>(supabaseUrl, requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return response;
  }

  const authorized = Boolean(user) && isEmailAllowed(user?.email);

  if (!authorized) {
    // Sign out any session whose email is not on the allowlist so a stray
    // account cannot linger, then bounce to the login screen.
    if (user) {
      await supabase.auth.signOut();
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = user ? "error=not_allowed" : "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
