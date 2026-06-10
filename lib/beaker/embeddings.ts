import "server-only";

import { createHash } from "node:crypto";

import { env, requireEnv } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_CONTENT_LENGTH = 24_000;

async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Embedding API returned no vector.");
  }
  return embedding;
}

function buildEmbeddingContent(meeting: {
  title: string;
  starts_at: string;
  organizer_email: string | null;
  platform: string;
  summary_markdown: string;
}) {
  const header = `Title: ${meeting.title} | Date: ${meeting.starts_at} | Organizer: ${meeting.organizer_email ?? "unknown"} | Platform: ${meeting.platform}`;
  const body = `${header}\n\n${meeting.summary_markdown}`;
  return body.length > MAX_CONTENT_LENGTH ? body.slice(0, MAX_CONTENT_LENGTH) : body;
}

export async function embedQuery(text: string): Promise<number[]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for embeddings.");
  }
  return createEmbedding(text);
}

export async function embedMeetingSummary(meetingId: string): Promise<boolean> {
  if (!env.OPENAI_API_KEY) {
    return false;
  }

  const supabase = createSupabaseAdmin();

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id, title, starts_at, organizer_email, platform")
    .eq("id", meetingId)
    .maybeSingle();

  if (meetingError) {
    throw meetingError;
  }
  if (!meeting) {
    return false;
  }

  const { data: summary, error: summaryError } = await supabase
    .from("meeting_summaries")
    .select("summary_markdown")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (summaryError) {
    throw summaryError;
  }
  if (!summary?.summary_markdown) {
    return false;
  }

  const content = buildEmbeddingContent({ ...meeting, summary_markdown: summary.summary_markdown });
  const contentHash = createHash("sha256").update(content).digest("hex");

  const { data: existing } = await supabase
    .from("meeting_embeddings")
    .select("content_hash")
    .eq("meeting_id", meetingId)
    .eq("source", "summary")
    .maybeSingle();

  if (existing?.content_hash === contentHash) {
    return false;
  }

  const embedding = await createEmbedding(content);

  const { error: upsertError } = await supabase.from("meeting_embeddings").upsert(
    {
      meeting_id: meetingId,
      source: "summary",
      content,
      content_hash: contentHash,
      embedding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,source" },
  );

  if (upsertError) {
    throw upsertError;
  }

  return true;
}

export async function backfillMissingEmbeddings(limit = 50): Promise<number> {
  const supabase = createSupabaseAdmin();

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    throw error;
  }

  let embedded = 0;
  for (const meeting of meetings ?? []) {
    if (embedded >= limit) {
      break;
    }

    const { data: summary } = await supabase
      .from("meeting_summaries")
      .select("id")
      .eq("meeting_id", meeting.id)
      .limit(1)
      .maybeSingle();

    if (!summary) {
      continue;
    }

    const didEmbed = await embedMeetingSummary(meeting.id);
    if (didEmbed) {
      embedded += 1;
    }
  }

  return embedded;
}
