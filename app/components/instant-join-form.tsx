"use client";

import { useState } from "react";

export function InstantJoinForm() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/meetings/instant-join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meetingUrl: url.trim(),
          title: title.trim() || undefined,
        }),
      });

      const result = (await response.json()) as { meetingId?: string; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to join meeting.");
      }

      setStatus(result.message ?? "Agent dispatched.");
      setUrl("");
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join meeting.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label className="field">
        <span className="muted">Meeting URL (Zoom or Google Meet)</span>
        <input
          className="input"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          required
        />
      </label>
      <label className="field">
        <span className="muted">Title (optional)</span>
        <input
          className="input"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Urgent client call"
        />
      </label>
      {error ? (
        <p style={{ color: "#dc2626" }} role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p style={{ color: "#059669" }} role="status">
          {status}
        </p>
      ) : null}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Sending agent…" : "Join meeting now"}
      </button>
    </form>
  );
}
