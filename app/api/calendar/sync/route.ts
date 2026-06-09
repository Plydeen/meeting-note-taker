import { NextRequest, NextResponse } from "next/server";

import { syncUpcomingMeetings } from "@/lib/google/calendar";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { connectionId?: string; lookaheadDays?: number };
    if (!body.connectionId) {
      return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
    }

    const meetings = await syncUpcomingMeetings(body.connectionId, body.lookaheadDays ?? 14);
    return NextResponse.json({ synced: meetings.length, meetings });
  } catch (error) {
    return jsonError(error);
  }
}
