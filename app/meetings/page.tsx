import Link from "next/link";

import { getRequestUserId } from "@/lib/dev-user";
import { getMeetings } from "@/lib/meetings/data";

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const params = await searchParams;
  const userId = getRequestUserId(params.userId);
  const meetings = await getMeetings(userId);

  return (
    <section className="card">
      <h1>Meetings</h1>
      {!userId ? <p className="muted">Set `DEV_USER_ID` in `.env.local`, or provide `?userId=YOUR_SUPABASE_USER_ID`, to list meetings.</p> : null}
      <div className="list">
        {meetings.length ? (
          meetings.map((meeting) => (
            <Link className="list-item" href={{ pathname: `/meetings/${meeting.id}`, query: { userId } }} key={meeting.id}>
              <strong>{meeting.title}</strong>
              <p className="muted">
                {meeting.platform} · {new Date(meeting.starts_at).toLocaleString()}
              </p>
              <span className="status">{meeting.status}</span>
            </Link>
          ))
        ) : (
          <p className="muted">No meetings found.</p>
        )}
      </div>
    </section>
  );
}
