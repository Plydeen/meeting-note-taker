import { ensureProfile, requireUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; disconnected?: string }>;
}) {
  const user = await requireUser();
  await ensureProfile(user);
  const { connected, disconnected } = await searchParams;
  const connections =
    (await createSupabaseAdmin().from("calendar_connections").select().eq("user_id", user.id).order("created_at", { ascending: false }))
      .data ?? [];

  return (
    <div className="grid">
      <section className="card">
        <h1>Settings</h1>
        {connected ? <p>Google Calendar connected successfully.</p> : null}
        {disconnected ? <p>Google account removed. Its meetings have been deleted.</p> : null}
        <a className="button" href="/api/auth/google/start">
          {connections.length ? "Connect another Google Calendar" : "Connect Google Calendar"}
        </a>
        <p className="muted">
          You can connect multiple Google accounts. Each one is synced independently and meetings from all of
          them appear on the dashboard.
        </p>
      </section>

      <section className="card">
        <h2>Calendar Connections</h2>
        {connections.length ? (
          connections.map((connection) => (
            <div className="list-item" key={connection.id}>
              <strong>{connection.account_email ?? "Google account"}</strong>
              <p className="muted">Auto-join is {connection.auto_join_enabled ? "enabled" : "disabled"}.</p>
              <p className="muted">Last synced: {connection.last_synced_at ? formatDateTime(connection.last_synced_at) : "never"}</p>
              <form action={`/api/calendar/connections/${connection.id}/disconnect`} method="POST" style={{ marginTop: 12 }}>
                <button className="button danger small" type="submit">
                  Remove account
                </button>
              </form>
            </div>
          ))
        ) : (
          <p className="muted">No connected calendars yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Operational Routes</h2>
        <p className="muted">Configure your scheduler to POST to these routes with `Authorization: Bearer CRON_SECRET`.</p>
        <pre>{`POST /api/cron/sync-calendars      (every 5 minutes)
POST /api/cron/queue-recall-bots   (every 1-2 minutes)
POST /api/cron/summarize-meetings  (every 5 minutes)
POST /api/cron/embed-summaries     (every 15 minutes)

Recall realtime webhook:
POST /api/webhooks/recall

Beaker MCP endpoint:
POST ${env.APP_BASE_URL}/api/mcp/mcp

Header auth (Claude Code / API):  Authorization: Bearer MCP_ACCESS_TOKEN
claude.ai / Desktop connector ("No authentication"), token in URL:
${env.APP_BASE_URL}/api/mcp/mcp?token=${env.MCP_ACCESS_TOKEN ?? "<set MCP_ACCESS_TOKEN>"}`}</pre>
      </section>
    </div>
  );
}
