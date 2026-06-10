import { z } from "zod";

export type BunsenNotes = {
  version: 2;
  overview: string;
  client_wants: string[];
  action_items: Array<{ task: string; owner?: string; due?: string }>;
  possible_solutions: Array<{
    problem: string;
    solution: string;
    tech_stack?: string[];
  }>;
  topics_discussed: Array<{ topic: string; notes: string }>;
  follow_ups: string[];
  jargon_breakdown: Array<{ term: string; plain_english: string }>;
  client_context: string;
  research: Array<{
    key_point: string;
    findings: string;
    sources: Array<{ title: string; url: string }>;
  }>;
  visual_notes: string[];
  decisions: string[];
  open_questions: string[];
  risks: string[];
};

const actionItemSchema = z.object({
  task: z.string(),
  owner: z.string().optional(),
  due: z.string().optional(),
});

const possibleSolutionSchema = z.object({
  problem: z.string(),
  solution: z.string(),
  tech_stack: z.array(z.string()).optional(),
});

const topicSchema = z.object({
  topic: z.string(),
  notes: z.string(),
});

const jargonSchema = z.object({
  term: z.string(),
  plain_english: z.string(),
});

const researchSchema = z.object({
  key_point: z.string(),
  findings: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

export const bunsenNotesSchema = z.object({
  version: z.literal(2).optional().default(2),
  overview: z.string(),
  client_wants: z.array(z.string()).default([]),
  action_items: z.array(actionItemSchema).default([]),
  possible_solutions: z.array(possibleSolutionSchema).default([]),
  topics_discussed: z.array(topicSchema).default([]),
  follow_ups: z.array(z.string()).default([]),
  jargon_breakdown: z.array(jargonSchema).default([]),
  client_context: z.string().default(""),
  research: z.array(researchSchema).default([]),
  visual_notes: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  open_questions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export function toBunsenNotes(json: unknown): BunsenNotes {
  if (json && typeof json === "object") {
    const v = json as Record<string, unknown>;
    if (v.version === 2) {
      const parsed = bunsenNotesSchema.safeParse(json);
      if (parsed.success) {
        return parsed.data;
      }
    }

    // v1 shape: overview, decisions, action_items, risks, open_questions, follow_ups
    const actionItems = Array.isArray(v.action_items)
      ? v.action_items.map((item) => {
          if (item && typeof item === "object") {
            const a = item as { task?: unknown; owner?: unknown; due?: unknown };
            return {
              task: String(a.task ?? ""),
              owner: a.owner ? String(a.owner) : undefined,
              due: a.due ? String(a.due) : undefined,
            };
          }
          return { task: String(item) };
        })
      : [];

    return {
      version: 2,
      overview: typeof v.overview === "string" ? v.overview : "",
      client_wants: [],
      action_items: actionItems,
      possible_solutions: [],
      topics_discussed: [],
      follow_ups: Array.isArray(v.follow_ups) ? v.follow_ups.map(String) : [],
      jargon_breakdown: [],
      client_context: "",
      research: [],
      visual_notes: [],
      decisions: Array.isArray(v.decisions) ? v.decisions.map(String) : [],
      open_questions: Array.isArray(v.open_questions) ? v.open_questions.map(String) : [],
      risks: Array.isArray(v.risks) ? v.risks.map(String) : [],
    };
  }

  return {
    version: 2,
    overview: "",
    client_wants: [],
    action_items: [],
    possible_solutions: [],
    topics_discussed: [],
    follow_ups: [],
    jargon_breakdown: [],
    client_context: "",
    research: [],
    visual_notes: [],
    decisions: [],
    open_questions: [],
    risks: [],
  };
}

export function fallbackBunsenNotes(transcript: string): BunsenNotes {
  const lines = transcript.split("\n").filter(Boolean);
  return {
    version: 2,
    overview:
      lines.slice(0, 5).join(" ").slice(0, 1200) ||
      "Transcript captured. Configure OPENAI_API_KEY to generate richer notes.",
    client_wants: [],
    action_items: [],
    possible_solutions: [],
    topics_discussed: [],
    follow_ups: [],
    jargon_breakdown: [],
    client_context: "",
    research: [],
    visual_notes: [],
    decisions: [],
    open_questions: [],
    risks: [],
  };
}
