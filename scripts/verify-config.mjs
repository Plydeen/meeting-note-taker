const required = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RECALLAI_API_KEY",
  "RECALLAI_REGION",
  "RECALLAI_WORKSPACE_VERIFICATION_SECRET",
];

const missing = required.filter((key) => !process.env[key]);

if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
}

if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.includes("localhost")) {
  console.warn("Warning: APP_BASE_URL is localhost. Recall.ai cannot reach localhost webhooks; use your Cloudflare tunnel URL.");
}

if (!process.env.MCP_ACCESS_TOKEN) {
  console.warn("Warning: MCP_ACCESS_TOKEN is unset. Beaker MCP at /api/mcp will reject requests until set.");
}

if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY is unset. Bunsen notes, research, and Beaker embeddings will be limited.");
}

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Configuration looks ready for live verification.");
