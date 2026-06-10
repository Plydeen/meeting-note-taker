import type { BunsenNotes } from "@/lib/bunsen/types";

function renderList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "";
}

export function renderBunsenMarkdown(notes: BunsenNotes): string {
  const sections: string[] = [];

  if (notes.overview || notes.client_context) {
    sections.push("## Overview", notes.overview);
    if (notes.client_context) {
      sections.push("", "### Client Context", notes.client_context);
    }
  }

  if (notes.client_wants.length) {
    sections.push("", "## Client Wants", renderList(notes.client_wants));
  }

  if (notes.action_items.length) {
    const items = notes.action_items.map((item) => {
      const owner = item.owner ? ` (${item.owner})` : "";
      const due = item.due ? ` due ${item.due}` : "";
      return `- ${item.task}${owner}${due}`;
    });
    sections.push("", "## Action Items", items.join("\n"));
  }

  if (notes.possible_solutions.length) {
    const blocks = notes.possible_solutions.map((s) => {
      const stack = s.tech_stack?.length ? `\n  Tech stack: ${s.tech_stack.join(", ")}` : "";
      return `- **Problem:** ${s.problem}\n  **Solution:** ${s.solution}${stack}`;
    });
    sections.push("", "## Possible Solutions", blocks.join("\n\n"));
  }

  if (notes.topics_discussed.length) {
    const blocks = notes.topics_discussed.map((t) => `- **${t.topic}:** ${t.notes}`);
    sections.push("", "## Topics Discussed", blocks.join("\n"));
  }

  if (notes.research.length) {
    const blocks = notes.research.map((r) => {
      const sources = r.sources.length
        ? r.sources.map((s) => `  - [${s.title}](${s.url})`).join("\n")
        : "  - No sources captured";
      return `### ${r.key_point}\n\n${r.findings}\n\n**Sources:**\n${sources}`;
    });
    sections.push("", "## Research", blocks.join("\n\n"));
  }

  if (notes.jargon_breakdown.length) {
    const items = notes.jargon_breakdown.map((j) => `- **${j.term}:** ${j.plain_english}`);
    sections.push("", "## Jargon Breakdown", items.join("\n"));
  }

  if (notes.visual_notes.length) {
    sections.push("", "## Visual Notes", renderList(notes.visual_notes));
  }

  if (notes.follow_ups.length) {
    sections.push("", "## Follow-ups", renderList(notes.follow_ups));
  }

  if (notes.decisions.length) {
    sections.push("", "## Decisions", renderList(notes.decisions));
  }

  if (notes.risks.length) {
    sections.push("", "## Risks", renderList(notes.risks));
  }

  if (notes.open_questions.length) {
    sections.push("", "## Open Questions", renderList(notes.open_questions));
  }

  return sections.join("\n").trim() || "## Overview\n\nNo notes captured.";
}
