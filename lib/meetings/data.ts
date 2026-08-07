import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function getDashboardData(userId?: string) {
  if (!userId) {
    return { meetings: [], summaries: [], connections: [] };
  }

  const supabase = createSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const [{ data: meetings }, { data: summaries }, { data: connections }] = await Promise.all([
    supabase
      .from("meetings")
      .select()
      .eq("user_id", userId)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(8),
    supabase
      .from("meeting_summaries")
      .select("*, meetings!inner(user_id)")
      .eq("meetings.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
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

export async function getMeetingDetail(meetingId: string, userId: string) {
  const supabase = createSupabaseAdmin();

  // Enforce ownership before loading any related rows.
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select()
    .eq("id", meetingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (meetingError) {
    throw meetingError;
  }

  if (!meeting) {
    return null;
  }

  const [{ data: segments }, { data: summary }, { data: bots }, { data: participants }] = await Promise.all([
    supabase.from("transcript_segments").select().eq("meeting_id", meetingId).order("starts_at_ms", { ascending: true, nullsFirst: false }),
    supabase.from("meeting_summaries").select().eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("recall_bots").select().eq("meeting_id", meetingId).order("created_at", { ascending: false }),
    supabase.from("meeting_participants").select().eq("meeting_id", meetingId).order("email", { ascending: true }),
  ]);

  return {
    meeting,
    segments: segments ?? [],
    summary,
    bots: bots ?? [],
    participants: participants ?? [],
  };
}
