import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function getDashboardData(userId?: string) {
  if (!userId) {
    return { meetings: [], summaries: [], connections: [] };
  }

  const supabase = createSupabaseAdmin();
  const [{ data: meetings }, { data: summaries }, { data: connections }] = await Promise.all([
    supabase.from("meetings").select().eq("user_id", userId).order("starts_at", { ascending: true }).limit(8),
    supabase.from("meeting_summaries").select().order("created_at", { ascending: false }).limit(5),
    supabase.from("calendar_connections").select().eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return {
    meetings: meetings ?? [],
    summaries: summaries ?? [],
    connections: connections ?? [],
  };
}

export async function getMeetings(userId?: string) {
  if (!userId) {
    return [];
  }

  const { data, error } = await createSupabaseAdmin()
    .from("meetings")
    .select()
    .eq("user_id", userId)
    .order("starts_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getMeetingDetail(meetingId: string) {
  const supabase = createSupabaseAdmin();
  const [{ data: meeting, error: meetingError }, { data: segments }, { data: summary }, { data: bots }, { data: participants }] =
    await Promise.all([
      supabase.from("meetings").select().eq("id", meetingId).single(),
      supabase.from("transcript_segments").select().eq("meeting_id", meetingId).order("starts_at_ms", { ascending: true, nullsFirst: false }),
      supabase.from("meeting_summaries").select().eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("recall_bots").select().eq("meeting_id", meetingId).order("created_at", { ascending: false }),
      supabase.from("meeting_participants").select().eq("meeting_id", meetingId).order("email", { ascending: true }),
    ]);

  if (meetingError) {
    throw meetingError;
  }

  return {
    meeting,
    segments: segments ?? [],
    summary,
    bots: bots ?? [],
    participants: participants ?? [],
  };
}
