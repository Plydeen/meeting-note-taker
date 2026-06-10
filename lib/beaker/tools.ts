import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/beaker/embeddings";
import { z } from "zod";

const uuidSchema = z.string().uuid();

export async function searchMeetings(query: string, limit: number) {
  const supabase = createSupabaseAdmin();
  const embedding = await embedQuery(query);

  const { data: matches, error } = await supabase.rpc("match_meeting_embeddings", {
    query_embedding: embedding,
    match_count: limit,
  });

  if (error) {
    throw error;
  }

  const meetingIds = (matches ?? []).map((m: { meeting_id: string }) => m.meeting_id);
  if (meetingIds.length === 0) {
    return [];
  }

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id, title, starts_at, ends_at, platform, status, organizer_email")
    .in("id", meetingIds);

  if (meetingsError) {
    throw meetingsError;
  }

  const meetingMap = new Map((meetings ?? []).map((m) => [m.id, m]));

  return (matches ?? []).map((match: { meeting_id: string; content: string; similarity: number }) => {
    const meeting = meetingMap.get(match.meeting_id);
    return {
      meeting_id: match.meeting_id,
      similarity: match.similarity,
      title: meeting?.title ?? "Unknown",
      starts_at: meeting?.starts_at ?? null,
      platform: meeting?.platform ?? null,
      status: meeting?.status ?? null,
      content_excerpt: match.content.slice(0, 500),
    };
  });
}

export async function getMeetingSummary(meetingId: string) {
  uuidSchema.parse(meetingId);
  const supabase = createSupabaseAdmin();

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, title, starts_at, ends_at, platform, status, organizer_email")
    .eq("id", meetingId)
    .single();

  if (meetingError) {
    throw meetingError;
  }

  const { data: summary, error: summaryError } = await supabase
    .from("meeting_summaries")
    .select("summary_markdown, summary_json, created_at, model, provider")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (summaryError) {
    throw summaryError;
  }

  if (!summary) {
    throw new Error("No summary found for this meeting.");
  }

  return { meeting, summary };
}

export async function listRecentMeetings(limit: number) {
  const supabase = createSupabaseAdmin();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, title, starts_at, ends_at, platform, status")
    .eq("status", "complete")
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const results = [];
  for (const meeting of meetings ?? []) {
    const { count } = await supabase
      .from("meeting_participants")
      .select("*", { count: "exact", head: true })
      .eq("meeting_id", meeting.id);

    results.push({ ...meeting, participant_count: count ?? 0 });
  }

  return results;
}

export async function getMeetingTranscript(meetingId: string) {
  uuidSchema.parse(meetingId);
  const supabase = createSupabaseAdmin();

  const { data: segments, error } = await supabase
    .from("transcript_segments")
    .select("speaker_name, text, starts_at_ms, created_at")
    .eq("meeting_id", meetingId)
    .order("starts_at_ms", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const lines = (segments ?? []).map((s) => `${s.speaker_name ?? "Speaker"}: ${s.text}`);
  const full = lines.join("\n");
  const max = 100_000;

  if (full.length <= max) {
    return { transcript: full, truncated: false, segment_count: lines.length };
  }

  return {
    transcript: `${full.slice(0, max)}\n\n[... transcript truncated; ${lines.length} total segments ...]`,
    truncated: true,
    segment_count: lines.length,
  };
}
