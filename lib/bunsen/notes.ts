import "server-only";

import { env, requireEnv } from "@/lib/env";
import { bunsenNotesSchema, fallbackBunsenNotes, type BunsenNotes } from "@/lib/bunsen/types";

const SYSTEM_PROMPT = `You are Bunsen, a meeting notes agent. Produce detailed structured notes (NOT a brief summary) from the transcript and optional meeting keyframe images.

Return strict JSON matching this shape:
{
  "version": 2,
  "overview": "2-4 paragraph narrative of the meeting",
  "client_wants": ["what the client asked for or cares about"],
  "action_items": [{"task": "...", "owner": "optional", "due": "optional"}],
  "possible_solutions": [{"problem": "...", "solution": "...", "tech_stack": ["optional tech names"]}],
  "topics_discussed": [{"topic": "...", "notes": "..."}],
  "follow_ups": ["..."],
  "jargon_breakdown": [{"term": "industry term or acronym", "plain_english": "plain explanation in context"}],
  "client_context": "short breakdown of what the client was talking about overall",
  "research": [],
  "visual_notes": ["what each keyframe shows: slides, demos, charts, screenshares"],
  "decisions": ["..."],
  "open_questions": ["..."],
  "risks": ["..."]
}

Rules:
- Capture specifics: names, numbers, commitments, deadlines.
- Identify industry jargon the client used; explain each in plain English.
- For problems raised, propose solutions; if tech applies, list concrete tech_stack items.
- Always return research as an empty array (research is added later).
- If keyframes are provided, describe visible content in visual_notes; otherwise return [].`;

function truncateTranscript(transcript: string): string {
  const max = 200_000;
  if (transcript.length <= max) {
    return transcript;
  }
  return `${transcript.slice(0, 120_000)}\n\n[... transcript truncated ...]\n\n${transcript.slice(-60_000)}`;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.SUMMARY_MODEL,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bunsen notes pass failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Bunsen notes pass returned no content.");
  }
  return content;
}

function parseNotes(content: string): BunsenNotes {
  const parsed = bunsenNotesSchema.safeParse(JSON.parse(content));
  if (parsed.success) {
    return parsed.data;
  }
  throw new Error(`Invalid Bunsen notes JSON: ${parsed.error.message}`);
}

export async function takeNotes(input: { title: string; transcript: string; keyframes: string[] }): Promise<BunsenNotes> {
  if (!env.OPENAI_API_KEY) {
    return fallbackBunsenNotes(input.transcript);
  }

  const transcript = truncateTranscript(input.transcript);
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: `Meeting title: ${input.title}\n\nTranscript:\n${transcript}` },
    ...input.keyframes.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  let content = await callOpenAI(messages);

  try {
    return parseNotes(content);
  } catch (firstError) {
    console.warn("[bunsen notes] validation failed, attempting repair", firstError);
    const repairMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
      { role: "assistant", content },
      {
        role: "user",
        content: `The JSON above failed validation. Fix it to match the required schema exactly. Error: ${firstError instanceof Error ? firstError.message : String(firstError)}`,
      },
    ];
    content = await callOpenAI(repairMessages);
    return parseNotes(content);
  }
}
