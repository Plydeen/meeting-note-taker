import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { backfillTranscriptFromRecall } from "@/lib/recall/client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const NO_TRANSCRIPT_ERROR = "Cannot summarize a meeting without transcript segments.";

type SummaryJson = {
  overview: string;
  decisions: string[];
  action_items: Array<{ task: string; owner?: string; due?: string }>;
  risks: string[];
  open_questions: string[];
  follow_ups: string[];
};

export async function summarizeMeeting(meetingId: string) {
  const supabase = createSupabaseAdmin();
  const { data: meeting, error: meetingError } = await supabase.from("meetings").select().eq("id", meetingId).single();

  if (meetingError) {
    throw meetingError;
  }

  let segments = await fetchSegments(meetingId);

  if (segments.length === 0) {
    // Realtime webhooks may have been missed entirely (tunnel down, app restart,
    // parsing failure). Recall keeps the finished transcript, so pull it directly.
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

  const summary = await generateSummary(meeting.title, transcript);
  const summaryMarkdown = renderSummaryMarkdown(summary);
  const { data, error } = await supabase
    .from("meeting_summaries")
    .insert({
      meeting_id: meetingId,
      provider: env.SUMMARY_PROVIDER,
      model: env.SUMMARY_MODEL,
      summary_markdown: summaryMarkdown,
      summary_json: summary,
      transcript_hash: transcriptHash,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  await supabase.from("meetings").update({ status: "complete", updated_at: new Date().toISOString(), error: null }).eq("id", meetingId);
  return data;
}

export async function summarizeReadyMeetings() {
  const supabase = createSupabaseAdmin();
  const endedBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // bot_joined is included so meetings still summarize when no webhook ever
  // upgraded the status (e.g. the tunnel was down during the call).
  const { data: meetings, error } = await supabase
    .from("meetings")
    .select()
    .in("status", ["processing_summary", "transcript_streaming", "bot_joined"])
    .lte("ends_at", endedBefore);

  if (error) {
    throw error;
  }

  // Retry meetings that previously failed only because no transcript segments
  // were stored. Recall may have the transcript ready now (backfill fetches it).
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

async function generateSummary(title: string, transcript: string): Promise<SummaryJson> {
  if (!env.OPENAI_API_KEY) {
    return fallbackSummary(transcript);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.SUMMARY_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Summarize meeting transcripts into strict JSON with keys: overview, decisions, action_items, risks, open_questions, follow_ups. action_items is an array of objects with task, owner, due.",
        },
        {
          role: "user",
          content: `Meeting title: ${title}\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Summary provider failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Summary provider returned no content.");
  }

  return normalizeSummary(JSON.parse(content));
}

function fallbackSummary(transcript: string): SummaryJson {
  const lines = transcript.split("\n").filter(Boolean);
  return {
    overview: lines.slice(0, 5).join(" ").slice(0, 1200) || "Transcript captured. Configure OPENAI_API_KEY to generate richer summaries.",
    decisions: [],
    action_items: [],
    risks: [],
    open_questions: [],
    follow_ups: [],
  };
}

function normalizeSummary(value: unknown): SummaryJson {
  const input = value && typeof value === "object" ? (value as Partial<SummaryJson>) : {};
  return {
    overview: typeof input.overview === "string" ? input.overview : "",
    decisions: Array.isArray(input.decisions) ? input.decisions.map(String) : [],
    action_items: Array.isArray(input.action_items)
      ? input.action_items.map((item) => {
          if (item && typeof item === "object") {
            const action = item as { task?: unknown; owner?: unknown; due?: unknown };
            return {
              task: String(action.task ?? ""),
              owner: action.owner ? String(action.owner) : undefined,
              due: action.due ? String(action.due) : undefined,
            };
          }

          return { task: String(item) };
        })
      : [],
    risks: Array.isArray(input.risks) ? input.risks.map(String) : [],
    open_questions: Array.isArray(input.open_questions) ? input.open_questions.map(String) : [],
    follow_ups: Array.isArray(input.follow_ups) ? input.follow_ups.map(String) : [],
  };
}

function renderSummaryMarkdown(summary: SummaryJson) {
  const actionItems = summary.action_items.map((item) => {
    const owner = item.owner ? ` (${item.owner})` : "";
    const due = item.due ? ` due ${item.due}` : "";
    return `- ${item.task}${owner}${due}`;
  });

  return [
    "## Overview",
    summary.overview,
    "",
    "## Decisions",
    renderList(summary.decisions),
    "",
    "## Action Items",
    actionItems.length ? actionItems.join("\n") : "- None captured",
    "",
    "## Risks",
    renderList(summary.risks),
    "",
    "## Open Questions",
    renderList(summary.open_questions),
    "",
    "## Follow-ups",
    renderList(summary.follow_ups),
  ].join("\n");
}

function renderList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None captured";
}
