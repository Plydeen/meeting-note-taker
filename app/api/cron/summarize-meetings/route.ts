import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized, jsonError } from "@/lib/http";
import { summarizeReadyMeetings } from "@/lib/summary/generate";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);
    const summaries = await summarizeReadyMeetings();
    return NextResponse.json({ summarized: summaries.length });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonError(error);
  }
}
