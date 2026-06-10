import "server-only";

import { createHash } from "node:crypto";

import { takeNotes } from "@/lib/bunsen/notes";
import { renderBunsenMarkdown } from "@/lib/bunsen/render";
import { researchKeyPoints } from "@/lib/bunsen/research";
import type { BunsenNotes } from "@/lib/bunsen/types";
import { extractMeetingKeyframes } from "@/lib/bunsen/video";
import { embedMeetingSummary } from "@/lib/beaker/embeddings";
import { env } from "@/lib/env";
import { backfillTranscriptFromRecall } from "@/lib/recall/client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const NO_TRANSCRIPT_ERROR = "Cannot summarize a meeting without transcript segments.";

export async function summarizeMeeting(meetingId: string) {
  const supabase = createSupabaseAdmin();
  const { data: meeting, error: meetingError } = await supabase.from("meetings").select().eq("id", meetingId).single();

  if (meetingError) {
    throw meetingError;
  }

  let segments = await fetchSegments(meetingId);

  if (segments.length === 0) {
    await backfillTranscriptFromRecall(meetingId);
    segments = await fetchSegments(meetingId);
  }

  const transcript = segments
    .map((segment) => `${segment.speaker_name ?? "Speaker"}: ${segment.text}`)
    .join("\n");

  if (!transcript.trim()) {
    throw new Error(NO_TRANSCRIPT_ERROR);
  }

  const transcriptHash = createHash("sha256").update(transcript).digest("hex");
  const { data: existing } = await supabase
    .from("meeting_summaries")
    .select()
    .eq("meeting_id", meetingId)
    .eq("transcript_hash", transcriptHash)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  await supabase.from("meetings").update({ status: "processing_summary", updated_at: new Date().toISOString() }).eq("id", meetingId);

  const keyframes = await extractMeetingKeyframes(meetingId);
  let notes: BunsenNotes = await takeNotes({ title: meeting.title, transcript, keyframes });
  notes = { ...notes, research: await researchKeyPoints(notes, meeting.title) };
  const summaryMarkdown = renderBunsenMarkdown(notes);

  const { data, error } = await supabase
    .from("meeting_summaries")
    .insert({
      meeting_id: meetingId,
      provider: env.SUMMARY_PROVIDER,
      model: env.SUMMARY_MODEL,
      summary_markdown: summaryMarkdown,
      summary_json: notes,
      transcript_hash: transcriptHash,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  await supabase.from("meetings").update({ status: "complete", updated_at: new Date().toISOString(), error: null }).eq("id", meetingId);

  try {
    await embedMeetingSummary(meetingId);
  } catch (embedError) {
    console.warn("[beaker] embedding failed after summarize", embedError);
  }

  return data;
}

export async function summarizeReadyMeetings() {
  const supabase = createSupabaseAdmin();
  const endedBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select()
    .in("status", ["processing_summary", "transcript_streaming", "bot_joined"])
    .lte("ends_at", endedBefore);

  if (error) {
    throw error;
  }

  const { data: retryable, error: retryError } = await supabase
    .from("meetings")
    .select()
    .eq("status", "failed")
    .eq("error", NO_TRANSCRIPT_ERROR)
    .gte("ends_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .lte("ends_at", endedBefore);

  if (retryError) {
    throw retryError;
  }

  const candidates = [...(meetings ?? []), ...(retryable ?? [])];

  const summaries = [];
  for (const meeting of candidates) {
    try {
      summaries.push(await summarizeMeeting(meeting.id));
    } catch (error) {
      await supabase
        .from("meetings")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Summary generation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", meeting.id);
    }
  }

  return summaries;
}

async function fetchSegments(meetingId: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("transcript_segments")
    .select()
    .eq("meeting_id", meetingId)
    .order("starts_at_ms", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
