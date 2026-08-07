import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/lib/google/calendar";
import { jsonError } from "@/lib/http";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const statePayload = {
      nonce: randomUUID(),
      userId: user.id,
    };
    const state = Buffer.from(JSON.stringify(statePayload), "utf8").toString("base64url");

    return NextResponse.redirect(getGoogleAuthUrl(state));
  } catch (error) {
    return jsonError(error);
  }
}
