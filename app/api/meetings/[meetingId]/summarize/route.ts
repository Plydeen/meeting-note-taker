import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { summarizeMeeting } from "@/lib/summary/generate";

export async function POST(_request: NextRequest, context: { params: Promise<{ meetingId: string }> }) {
  try {
    const { meetingId } = await context.params;
    const summary = await summarizeMeeting(meetingId);
    return NextResponse.json({ summary });
  } catch (error) {
    return jsonError(error);
  }
}
