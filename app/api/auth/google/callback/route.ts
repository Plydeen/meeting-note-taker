import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { exchangeCodeForConnection, syncUpcomingMeetings } from "@/lib/google/calendar";
import { jsonError } from "@/lib/http";

type GoogleState = {
  userId: string;
  nonce: string;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json({ error: "Missing Google OAuth code or state" }, { status: 400 });
    }

    const parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as GoogleState;
    if (parsedState.userId !== user.id) {
      return NextResponse.json({ error: "OAuth state does not match the signed-in user" }, { status: 400 });
    }

    // Bind the connection to the verified session user, not the state payload.
    const connection = await exchangeCodeForConnection(code, user.id);
    await syncUpcomingMeetings(connection.id);

    return NextResponse.redirect(new URL(`/settings?connected=google`, env.APP_BASE_URL));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    return jsonError(error);
  }
}
