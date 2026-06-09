import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { handleRecallWebhook } from "@/lib/recall/client";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const result = await handleRecallWebhook(rawBody, request.headers);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error, error instanceof SyntaxError ? 400 : 500);
  }
}
