import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getGoogleAuthUrl } from "@/lib/google/calendar";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const statePayload = {
      nonce: randomUUID(),
      userId,
    };
    const state = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64url");

    return NextResponse.redirect(getGoogleAuthUrl(state));
  } catch (error) {
    return jsonError(error);
  }
}
