import Link from "next/link";

import { InstantJoinForm } from "@/app/components/instant-join-form";
import { ensureProfile, requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/meetings/data";
import { formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  await ensureProfile(user);
  const { meetings, summaries, connections } = await getDashboardData(user.id);

  return (
    <div className="grid">
      <section className="card">
        <p className="muted">Calendar-driven meeting intelligence</p>
        <h1>Send a Recall.ai bot to your meetings and store searchable summaries in Supabase.</h1>
        <Link className="button" href="/settings">
          Configure calendar
        </Link>
      </section>

      <section className="card">
        <h2>Join a meeting now</h2>
        <p className="muted">
          Paste a Zoom or Google Meet link for urgent calls, last-minute link changes, or meetings that were not on
          your calendar.
        </p>
        <InstantJoinForm />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Upcoming Meetings</h2>
          <div className="list">
            {meetings.length ? (
              meetings.map((meeting) => (
                <Link className="list-item" href={`/meetings/${meeting.id}`} key={meeting.id}>
                  <strong>{meeting.title}</strong>
                  <p className="muted">{formatDateTime(meeting.starts_at)}</p>
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
                  <p className="muted">{formatDateTime(summary.created_at)}</p>
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
