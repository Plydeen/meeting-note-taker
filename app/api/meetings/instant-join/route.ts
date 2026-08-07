import { NextRequest, NextResponse } from "next/server";

import { ensureProfile, getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { detectMeetingPlatform, normalizeMeetingUrl } from "@/lib/meetings/platform";
import { createRecallBotForMeeting } from "@/lib/recall/client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureProfile(user);

    const body = (await request.json()) as { meetingUrl?: string; title?: string };
    const meetingUrl = body.meetingUrl ? normalizeMeetingUrl(body.meetingUrl) : "";
    if (!meetingUrl) {
      return NextResponse.json({ error: "Meeting URL is required." }, { status: 400 });
    }

    const platform = detectMeetingPlatform(meetingUrl);
    if (platform === "unknown") {
      return NextResponse.json({ error: "Only Zoom and Google Meet links are supported." }, { status: 400 });
    }

    const now = new Date();
    const supabase = createSupabaseAdmin();
    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        user_id: user.id,
        calendar_connection_id: null,
        external_calendar_id: null,
        title: body.title?.trim() || "Instant meeting",
        meeting_url: meetingUrl,
        platform,
        starts_at: now.toISOString(),
        ends_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        status: "bot_queued",
        auto_join_enabled: true,
        requires_approval: false,
        raw_event: { source: "instant_join" },
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    await createRecallBotForMeeting(meeting);

    return NextResponse.json({
      meetingId: meeting.id,
      message: "Agent dispatched. It should join the meeting shortly.",
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}
