import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

export function assertCronAuthorized(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export function jsonError(error: unknown, status = 500) {
  console.error("[api error]", error);

  let message = "Unexpected error";
  let details: Record<string, unknown> | undefined;

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    const supaError = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    message = String(supaError.message ?? message);
    details = {
      ...(supaError.details ? { details: supaError.details } : {}),
      ...(supaError.hint ? { hint: supaError.hint } : {}),
      ...(supaError.code ? { code: supaError.code } : {}),
    };
    if (Object.keys(details).length === 0) {
      details = undefined;
    }
  }

  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}
