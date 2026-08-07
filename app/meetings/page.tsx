import Link from "next/link";

import { InstantJoinForm } from "@/app/components/instant-join-form";
import { requireUser } from "@/lib/auth";
import { getMeetings } from "@/lib/meetings/data";
import { formatDateTime } from "@/lib/format";

export default async function MeetingsPage() {
  const user = await requireUser();
  const meetings = await getMeetings(user.id);

  return (
    <section className="card">
      <h1>Meetings</h1>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2>Join a meeting now</h2>
        <p className="muted">Send the agent to a Zoom or Google Meet link immediately.</p>
        <InstantJoinForm />
      </div>
      <div className="list">
        {meetings.length ? (
          meetings.map((meeting) => (
            <Link className="list-item" href={`/meetings/${meeting.id}`} key={meeting.id}>
              <strong>{meeting.title}</strong>
              <p className="muted">
                {meeting.platform} · {formatDateTime(meeting.starts_at)}
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
