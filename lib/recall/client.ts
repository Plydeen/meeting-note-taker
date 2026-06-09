import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env, requireEnv } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];

type RecallBotResponse = {
  id: string;
  status?: string;
  [key: string]: Json | undefined;
};

type RecallTranscriptPayload = {
  event?: string;
  data?: {
    data?: {
      code?: string;
      sub_code?: string | null;
      updated_at?: string;
    };
    bot?: { id?: string };
    transcript?: {
      id?: string;
      words?: Array<{
        text?: string;
        start_timestamp?: { relative?: number };
        end_timestamp?: { relative?: number };
      }>;
      speaker?: { name?: string; id?: string };
      is_final?: boolean;
    };
  };
  bot_id?: string;
  id?: string;
};

export function getRecallWebhookUrl() {
  return `${env.APP_BASE_URL}/api/webhooks/recall`;
}

export async function createRecallBotForMeeting(meeting: Meeting) {
  if (!meeting.meeting_url) {
    throw new Error("Meeting is missing a meeting URL.");
  }

  const recordingConfig = {
    transcript: {
      provider: {
        recallai_streaming: {
          mode: "prioritize_low_latency",
          language_code: "en",
        },
      },
      diarization: {
        use_separate_streams_when_available: true,
      },
    },
    realtime_endpoints: [
      {
        type: "webhook",
        url: getRecallWebhookUrl(),
        events: ["transcript.data", "participant_events.join", "participant_events.leave"],
      },
    ],
  };

  const response = await fetch(`https://${env.RECALLAI_REGION}.recall.ai/api/v1/bot/`, {
    method: "POST",
    headers: {
      authorization: requireEnv("RECALLAI_API_KEY"),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: meeting.meeting_url,
      bot_name: env.RECALLAI_BOT_NAME,
      recording_config: recordingConfig,
    }),
  });

  if (!response.ok) {
    throw new Error(`Recall.ai bot creation failed: ${await response.text()}`);
  }

  const bot = (await response.json()) as RecallBotResponse;
  const supabase = createSupabaseAdmin();

  const { error: botError } = await supabase.from("recall_bots").upsert(
    {
      meeting_id: meeting.id,
      recall_bot_id: bot.id,
      status: bot.status ?? "created",
      bot_name: env.RECALLAI_BOT_NAME,
      join_at: new Date().toISOString(),
      recording_config: recordingConfig,
      raw_response: bot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "recall_bot_id" },
  );

  if (botError) {
    throw botError;
  }

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({ status: "bot_queued", updated_at: new Date().toISOString(), error: null })
    .eq("id", meeting.id);

  if (meetingError) {
    throw meetingError;
  }

  return bot;
}

export async function handleRecallWebhook(rawBody: string, headers: Headers) {
  verifyRecallSignature(rawBody, headers);

  const payload = JSON.parse(rawBody) as RecallTranscriptPayload;
  const eventType = payload.event ?? "unknown";
  const recallBotId = getRecallBotId(payload);
  const idempotencyKey = getIdempotencyKey(payload, rawBody);
  const supabase = createSupabaseAdmin();
  const meeting = recallBotId ? await findMeetingByRecallBotId(recallBotId) : null;

  const { error: eventError } = await supabase.from("ingestion_events").upsert(
    {
      meeting_id: meeting?.id ?? null,
      recall_bot_id: recallBotId,
      event_type: eventType,
      idempotency_key: idempotencyKey,
      payload: payload as Json,
    },
    { onConflict: "event_type,idempotency_key" },
  );

  if (eventError) {
    throw eventError;
  }

  if (meeting && eventType === "transcript.data") {
    await upsertTranscriptSegment(meeting.id, recallBotId, payload);
    await supabase
      .from("meetings")
      .update({ status: "transcript_streaming", updated_at: new Date().toISOString() })
      .eq("id", meeting.id);
  }

  if (recallBotId && eventType.startsWith("bot.")) {
    await updateBotLifecycle(recallBotId, eventType, payload);
  }

  if (meeting) {
    const status = mapRecallEventToMeetingStatus(eventType);
    if (status) {
      await supabase
        .from("meetings")
        .update({
          status,
          error: status === "failed" ? payload.data?.data?.sub_code ?? eventType : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", meeting.id);
    }
  }

  return { eventType, meetingId: meeting?.id ?? null };
}

export async function queueDueRecallBots() {
  const supabase = createSupabaseAdmin();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 10 * 60 * 1000);

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select()
    .in("status", ["scheduled", "pending"])
    .eq("auto_join_enabled", true)
    .eq("requires_approval", false)
    .not("meeting_url", "is", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", windowEnd.toISOString());

  if (error) {
    throw error;
  }

  const results = [];
  for (const meeting of meetings ?? []) {
    const { data: existingBot } = await supabase
      .from("recall_bots")
      .select()
      .eq("meeting_id", meeting.id)
      .maybeSingle();

    if (existingBot) {
      continue;
    }

    try {
      results.push(await createRecallBotForMeeting(meeting));
    } catch (error) {
      await supabase
        .from("meetings")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Recall bot creation failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", meeting.id);
    }
  }

  return results;
}

function verifyRecallSignature(rawBody: string, headers: Headers) {
  const secret = env.RECALLAI_WORKSPACE_VERIFICATION_SECRET ?? env.RECALLAI_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing Recall workspace verification secret.");
  }

  const messageId = headers.get("webhook-id") ?? headers.get("svix-id");
  const timestamp = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const signatureHeader = headers.get("webhook-signature") ?? headers.get("svix-signature");

  if (!secret.startsWith("whsec_")) {
    throw new Error("Recall verification secret must start with whsec_.");
  }

  if (!messageId || !timestamp || !signatureHeader) {
    throw new Error("Missing Recall webhook verification headers.");
  }

  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signedPayload = `${messageId}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signedPayload).digest("base64");
  const expectedBuffer = Buffer.from(expected, "base64");

  const signatures = signatureHeader.split(" ");
  for (const versionedSignature of signatures) {
    const [version, signature] = versionedSignature.split(",");
    if (version !== "v1" || !signature) {
      continue;
    }

    const actualBuffer = Buffer.from(signature, "base64");
    if (expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)) {
      return;
    }
  }

  throw new Error("Invalid Recall webhook signature.");
}

async function findMeetingByRecallBotId(recallBotId: string) {
  const { data, error } = await createSupabaseAdmin()
    .from("recall_bots")
    .select("meeting_id")
    .eq("recall_bot_id", recallBotId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: meeting, error: meetingError } = await createSupabaseAdmin()
    .from("meetings")
    .select()
    .eq("id", data.meeting_id)
    .single();

  if (meetingError) {
    throw meetingError;
  }

  return meeting;
}

async function upsertTranscriptSegment(meetingId: string, recallBotId: string | null, payload: RecallTranscriptPayload) {
  const transcript = payload.data?.transcript;
  const words = transcript?.words ?? [];
  const text = words.map((word) => word.text).filter(Boolean).join(" ").trim();

  if (!text) {
    return;
  }

  const startsAtMs = words[0]?.start_timestamp?.relative;
  const endsAtMs = words[words.length - 1]?.end_timestamp?.relative;

  const { error } = await createSupabaseAdmin().from("transcript_segments").upsert(
    {
      meeting_id: meetingId,
      recall_bot_id: recallBotId,
      external_segment_id: transcript?.id ?? getIdempotencyKey(payload, text),
      speaker_name: transcript?.speaker?.name ?? null,
      speaker_id: transcript?.speaker?.id ?? null,
      text,
      starts_at_ms: typeof startsAtMs === "number" ? Math.round(startsAtMs * 1000) : null,
      ends_at_ms: typeof endsAtMs === "number" ? Math.round(endsAtMs * 1000) : null,
      is_final: transcript?.is_final ?? true,
      raw_payload: payload as Json,
    },
    { onConflict: "meeting_id,external_segment_id" },
  );

  if (error) {
    throw error;
  }
}

async function updateBotLifecycle(recallBotId: string, eventType: string, payload: RecallTranscriptPayload) {
  const { error } = await createSupabaseAdmin()
    .from("recall_bots")
    .update({
      status: payload.data?.data?.code ?? eventType,
      updated_at: payload.data?.data?.updated_at ?? new Date().toISOString(),
    })
    .eq("recall_bot_id", recallBotId);

  if (error) {
    throw error;
  }
}

function getRecallBotId(payload: RecallTranscriptPayload) {
  return payload.data?.bot?.id ?? payload.bot_id ?? null;
}

function mapRecallEventToMeetingStatus(eventType: string) {
  switch (eventType) {
    case "bot.joining_call":
    case "bot.in_waiting_room":
      return "bot_joining";
    case "bot.in_call_not_recording":
    case "bot.recording_permission_allowed":
    case "bot.in_call_recording":
      return "bot_joined";
    case "transcript.done":
    case "bot.done":
      return "processing_summary";
    case "transcript.failed":
    case "bot.fatal":
    case "bot.recording_permission_denied":
      return "failed";
    default:
      return null;
  }
}

function getIdempotencyKey(payload: RecallTranscriptPayload, fallback: string) {
  return payload.id ?? payload.data?.transcript?.id ?? Buffer.from(fallback).toString("base64url").slice(0, 120);
}
