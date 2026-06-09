import Link from "next/link";

import { getRequestUserId } from "@/lib/dev-user";
import { getDashboardData } from "@/lib/meetings/data";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const params = await searchParams;
  const userId = getRequestUserId(params.userId);
  const { meetings, summaries, connections } = await getDashboardData(userId);

  return (
    <div className="grid">
      <section className="card">
        <p className="muted">Calendar-driven meeting intelligence</p>
        <h1>Send a Recall.ai bot to your meetings and store searchable summaries in Supabase.</h1>
        {!userId ? (
          <p className="muted">Set `DEV_USER_ID` in `.env.local`, or add `?userId=YOUR_SUPABASE_USER_ID`, before full auth is added.</p>
        ) : (
          <Link className="button" href={{ pathname: "/settings", query: { userId } }}>
            Configure calendar
          </Link>
        )}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Upcoming Meetings</h2>
          <div className="list">
            {meetings.length ? (
              meetings.map((meeting) => (
                <Link className="list-item" href={{ pathname: `/meetings/${meeting.id}`, query: { userId } }} key={meeting.id}>
                  <strong>{meeting.title}</strong>
                  <p className="muted">{new Date(meeting.starts_at).toLocaleString()}</p>
                  <span className="status">{meeting.status}</span>
                </Link>
              ))
            ) : (
              <p className="muted">No meetings synced yet.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Recent Summaries</h2>
          <div className="list">
            {summaries.length ? (
              summaries.map((summary) => (
                <div className="list-item" key={summary.id}>
                  <strong>{summary.provider}</strong>
                  <p className="muted">{new Date(summary.created_at).toLocaleString()}</p>
                  <p>{summary.summary_markdown.split("\n").slice(0, 3).join(" ")}</p>
                </div>
              ))
            ) : (
              <p className="muted">Completed summaries will appear here.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Connections</h2>
        {connections.length ? (
          connections.map((connection) => (
            <p key={connection.id}>
              Google Calendar connected for <strong>{connection.account_email ?? "unknown account"}</strong>.
            </p>
          ))
        ) : (
          <p className="muted">No calendar connections configured.</p>
        )}
      </section>
    </div>
  );
}
