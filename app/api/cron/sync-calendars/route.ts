import { NextRequest, NextResponse } from "next/server";

import { syncUpcomingMeetings } from "@/lib/google/calendar";
import { assertCronAuthorized, jsonError } from "@/lib/http";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);
    const supabase = createSupabaseAdmin();
    const { data: connections, error } = await supabase.from("calendar_connections").select("id").eq("auto_join_enabled", true);

    if (error) {
      throw error;
    }

    let synced = 0;
    for (const connection of connections ?? []) {
      const meetings = await syncUpcomingMeetings(connection.id);
      synced += meetings.length;
    }

    return NextResponse.json({ synced });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return jsonError(error);
  }
}
