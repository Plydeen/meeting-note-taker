import { timingSafeEqual } from "node:crypto";

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import {
  getMeetingSummary,
  getMeetingTranscript,
  listRecentMeetings,
  searchMeetings,
} from "@/lib/beaker/tools";
import { requireEnv } from "@/lib/env";

function tokenMatches(token: string): boolean {
  try {
    const expected = requireEnv("MCP_ACCESS_TOKEN");
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expected);
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Accept the token either as an `Authorization: Bearer <token>` header (Claude
// Code / API clients) or as a `?token=` query param. The claude.ai / Desktop
// connector dialog only supports "no auth" or OAuth, so for those clients the
// connector is added as no-auth with the secret carried in the URL.
function verifyMcpAuth(request: Request): boolean {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return tokenMatches(auth.slice("Bearer ".length));
  }

  const urlToken = new URL(request.url).searchParams.get("token");
  if (urlToken) {
    return tokenMatches(urlToken);
  }

  return false;
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const mcpHandler = createMcpHandler(
  (server) => {
    server.tool(
      "search_meetings",
      "Semantic search over meeting summaries. Returns the most relevant meetings with similarity scores, meeting IDs, titles, dates, and the summary content used for matching. Use this first to find relevant meetings.",
      {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional(),
      },
      async ({ query, limit }) => {
        try {
          const results = await searchMeetings(query, limit ?? 5);
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        } catch (error) {
          return toolError(error instanceof Error ? error.message : "search_meetings failed");
        }
      },
    );

    server.tool(
      "get_meeting_summary",
      "Fetch the full structured summary and notes for one meeting by ID: overview, client wants, action items, possible solutions, topics, research, follow-ups.",
      { meeting_id: z.string().uuid() },
      async ({ meeting_id }) => {
        try {
          const result = await getMeetingSummary(meeting_id);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          return toolError(error instanceof Error ? error.message : "get_meeting_summary failed");
        }
      },
    );

    server.tool(
      "list_recent_meetings",
      "List recent completed meetings (ID, title, date, status, participant count) most recent first. Useful for browsing when there is no search query.",
      { limit: z.number().int().min(1).max(50).optional() },
      async ({ limit }) => {
        try {
          const results = await listRecentMeetings(limit ?? 10);
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        } catch (error) {
          return toolError(error instanceof Error ? error.message : "list_recent_meetings failed");
        }
      },
    );

    server.tool(
      "get_meeting_transcript",
      "Fetch the FULL raw transcript of a meeting. Only call this when the user has explicitly asked for the full transcript or for details that the summary cannot answer. Prefer search_meetings and get_meeting_summary for general questions. Transcripts can be very long.",
      { meeting_id: z.string().uuid() },
      async ({ meeting_id }) => {
        try {
          const result = await getMeetingTranscript(meeting_id);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
          return toolError(error instanceof Error ? error.message : "get_meeting_transcript failed");
        }
      },
    );
  },
  {
    serverInfo: { name: "beaker", version: "1.0.0" },
  },
  {
    basePath: "/api/mcp",
    disableSse: true,
    maxDuration: 60,
  },
);

async function authenticatedHandler(request: Request) {
  if (!verifyMcpAuth(request)) {
    return unauthorizedResponse();
  }
  return mcpHandler(request);
}

export { authenticatedHandler as GET, authenticatedHandler as POST, authenticatedHandler as DELETE };
