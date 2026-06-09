import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized, jsonError } from "@/lib/http";
import { queueDueRecallBots } from "@/lib/recall/client";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);
    const bots = await queueDueRecallBots();
    return NextResponse.json({ queued: bots.length, bots });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonError(error);
  }
}
