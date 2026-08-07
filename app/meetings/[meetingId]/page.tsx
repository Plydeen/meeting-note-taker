import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getMeetingDetail } from "@/lib/meetings/data";
import { formatDateTime, formatTime } from "@/lib/format";

import { BunsenSummary } from "./bunsen-summary";

export default async function MeetingDetailPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  const user = await requireUser();
  const detail = await getMeetingDetail(meetingId, user.id);

  if (!detail) {
    notFound();
  }

  const { meeting, segments, summary, bots, participants } = detail;

  return (
    <div className="grid">
      <section className="card">
        <p className="muted">{meeting.platform}</p>
        <h1>{meeting.title}</h1>
        <p className="muted">
          {formatDateTime(meeting.starts_at)}
          {meeting.ends_at ? ` to ${formatTime(meeting.ends_at)}` : ""}
        </p>
        <span className="status">{meeting.status}</span>
        {meeting.meeting_url ? (
          <p>
            <a href={meeting.meeting_url}>Open meeting link</a>
          </p>
        ) : null}
        {meeting.error ? <p className="muted">Error: {meeting.error}</p> : null}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Participants</h2>
          {participants.length ? (
            participants.map((participant) => (
              <p key={participant.id}>
                {participant.name ?? participant.email ?? "Unknown"} <span className="muted">{participant.response_status}</span>
              </p>
            ))
          ) : (
            <p className="muted">No participants synced.</p>
          )}
        </div>

        <div className="card">
          <h2>Recall Bot</h2>
          {bots.length ? (
            bots.map((bot) => (
              <p key={bot.id}>
                {bot.bot_name ?? "Bot"} <span className="status">{bot.status}</span>
              </p>
            ))
          ) : (
            <p className="muted">No bot has been queued for this meeting yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Summary</h2>
        {summary ? <BunsenSummary summary={summary} /> : <p className="muted">No summary generated yet.</p>}
      </section>

      <section className="card">
        <h2>Transcript</h2>
        <div className="transcript">
          {segments.length ? (
            segments.map((segment) => (
              <div className="segment" key={segment.id}>
                <strong>{segment.speaker_name ?? "Speaker"}</strong>
                <p>{segment.text}</p>
              </div>
            ))
          ) : (
            <p className="muted">Transcript segments will appear as Recall.ai streams them.</p>
          )}
        </div>
      </section>
    </div>
  );
}
