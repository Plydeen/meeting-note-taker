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
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status });
}
