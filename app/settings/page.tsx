import { getRequestUserId } from "@/lib/dev-user";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const userId = getRequestUserId(params.userId);
  const { connected } = params;
  const connections = userId
    ? (await createSupabaseAdmin().from("calendar_connections").select().eq("user_id", userId).order("created_at", { ascending: false })).data ?? []
    : [];

  return (
    <div className="grid">
      <section className="card">
        <h1>Settings</h1>
        {connected ? <p>Google Calendar connected successfully.</p> : null}
        {!userId ? <p className="muted">Set `DEV_USER_ID` in `.env.local`, or add `?userId=YOUR_SUPABASE_USER_ID`, to configure a calendar connection.</p> : null}
        {userId ? (
          <a className="button" href={`/api/auth/google/start?userId=${userId}`}>
            Connect Google Calendar
          </a>
        ) : null}
      </section>

      <section className="card">
        <h2>Calendar Connections</h2>
        {connections.length ? (
          connections.map((connection) => (
            <div className="list-item" key={connection.id}>
              <strong>{connection.account_email ?? "Google account"}</strong>
              <p className="muted">Auto-join is {connection.auto_join_enabled ? "enabled" : "disabled"}.</p>
              <p className="muted">Last synced: {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : "never"}</p>
            </div>
          ))
        ) : (
          <p className="muted">No connected calendars yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Operational Routes</h2>
        <p className="muted">Configure your scheduler to POST to these routes with `Authorization: Bearer CRON_SECRET`.</p>
        <pre>{`POST /api/cron/sync-calendars
POST /api/cron/queue-recall-bots
POST /api/cron/summarize-meetings

Recall realtime webhook:
POST /api/webhooks/recall`}</pre>
      </section>
    </div>
  );
}
