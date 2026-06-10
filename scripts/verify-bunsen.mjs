/**
 * Sanity check for Bunsen v1/v2 normalizer logic (inline copy for script use).
 */

function toBunsenNotes(json) {
  if (json && typeof json === "object") {
    const v = json;
    if (v.version === 2 && typeof v.overview === "string") {
      return {
        version: 2,
        overview: v.overview,
        client_wants: Array.isArray(v.client_wants) ? v.client_wants : [],
      };
    }

    return {
      version: 2,
      overview: typeof v.overview === "string" ? v.overview : "",
      client_wants: [],
      action_items: Array.isArray(v.action_items) ? v.action_items : [],
    };
  }

  return { version: 2, overview: "", client_wants: [] };
}

const v1 = {
  overview: "Legacy summary",
  decisions: ["Ship v1"],
  action_items: [{ task: "Follow up", owner: "Parker" }],
  risks: [],
  open_questions: [],
  follow_ups: ["Email client"],
};

const v2 = {
  version: 2,
  overview: "Full notes",
  client_wants: ["Better reporting"],
  action_items: [],
  possible_solutions: [],
  topics_discussed: [],
  follow_ups: [],
  jargon_breakdown: [],
  client_context: "Client wants dashboards",
  research: [],
  visual_notes: [],
  decisions: [],
  open_questions: [],
  risks: [],
};

const normalizedV1 = toBunsenNotes(v1);
const normalizedV2 = toBunsenNotes(v2);

if (normalizedV1.overview !== "Legacy summary") {
  console.error("v1 normalization failed");
  process.exit(1);
}

if (normalizedV2.client_wants[0] !== "Better reporting") {
  console.error("v2 normalization failed");
  process.exit(1);
}

console.log("verify-bunsen: ok");
