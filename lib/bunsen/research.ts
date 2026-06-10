import "server-only";

import { env, requireEnv } from "@/lib/env";
import type { BunsenNotes } from "@/lib/bunsen/types";

type ResponseOutputItem = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
    annotations?: Array<{
      type?: string;
      title?: string;
      url?: string;
    }>;
  }>;
};

type OpenAIResponsesPayload = {
  output?: ResponseOutputItem[];
  output_text?: string;
};

function selectResearchTopics(notes: BunsenNotes): string[] {
  const topics: string[] = [];
  const max = env.BUNSEN_MAX_RESEARCH_TOPICS;

  for (const s of notes.possible_solutions) {
    if (s.problem.trim()) {
      topics.push(s.problem.trim());
    }
  }
  for (const j of notes.jargon_breakdown) {
    if (j.term.trim()) {
      topics.push(j.term.trim());
    }
  }
  for (const t of notes.topics_discussed) {
    if (t.topic.trim()) {
      topics.push(t.topic.trim());
    }
  }

  const unique = [...new Set(topics)];
  return unique.slice(0, max);
}

function extractFindings(payload: OpenAIResponsesPayload): { findings: string; sources: Array<{ title: string; url: string }> } {
  const sources: Array<{ title: string; url: string }> = [];
  let findings = payload.output_text ?? "";

  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" || part.type === "text") {
        if (part.text) {
          findings = part.text;
        }
        for (const annotation of part.annotations ?? []) {
          if (annotation.type === "url_citation" && annotation.url) {
            sources.push({
              title: annotation.title ?? annotation.url,
              url: annotation.url,
            });
          }
        }
      }
    }
  }

  const dedupedSources = sources.filter(
    (s, i, arr) => arr.findIndex((x) => x.url === s.url) === i,
  );

  return { findings: findings.trim() || "No findings returned.", sources: dedupedSources };
}

async function researchTopic(keyPoint: string, meetingTitle: string): Promise<BunsenNotes["research"][number] | null> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.RESEARCH_MODEL,
      tools: [{ type: "web_search" }],
      input: `Research this point from a meeting titled "${meetingTitle}": ${keyPoint}

Provide current, factual findings in 1-3 paragraphs. If this is a technology problem, name leading tools and tech stacks used to solve it. Include citations.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Research failed for "${keyPoint}": ${await response.text()}`);
  }

  const payload = (await response.json()) as OpenAIResponsesPayload;
  const { findings, sources } = extractFindings(payload);

  return { key_point: keyPoint, findings, sources };
}

export async function researchKeyPoints(notes: BunsenNotes, meetingTitle: string): Promise<BunsenNotes["research"]> {
  if (!env.OPENAI_API_KEY) {
    return [];
  }

  const topics = selectResearchTopics(notes);
  const results: BunsenNotes["research"] = [];

  for (const topic of topics) {
    try {
      const result = await researchTopic(topic, meetingTitle);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.warn("[bunsen research] topic failed", topic, error);
    }
  }

  return results;
}
