"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type State = "checking" | "ready" | "expired";

// The recovery token arrives in the URL hash fragment (e.g. #access_token=...),
// which is only ever visible to the browser. This page's sole job is to lift
// that token out of the URL and hand it to the server; the password change
// itself runs server-side in /api/auth/set-password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");

    if (params.get("error") || !token) {
      setState("expired");
      return;
    }

    setAccessToken(token);
    setState("ready");
    // Strip the token from the address bar so it isn't left in history.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, password }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 400 && data.error?.includes("expired")) {
        setState("expired");
        return;
      }
      setError(data.error ?? "Unable to set your password. Please try again.");
      return;
    }

    router.replace("/login?reset=1");
  }

  return (
    <div className="grid">
      <section className="card" style={{ maxWidth: 420, margin: "40px auto", width: "100%" }}>
        <p className="muted">Recall Meetings</p>
        <h1>Set your password</h1>

        {state === "checking" ? <p className="muted">Verifying your reset link...</p> : null}

        {state === "expired" ? (
          <p className="muted">
            This reset link is invalid or has expired. <Link href="/login/forgot-password">Request a new one</Link>.
          </p>
        ) : null}

        {state === "ready" ? (
          <>
            <p className="muted">Choose a password for your account.</p>
            {error ? (
              <p style={{ color: "#dc2626", fontWeight: 600 }} role="alert">
                {error}
              </p>
            ) : null}
            <form onSubmit={handleSubmit} className="auth-form">
              <label className="field">
                <span className="muted">New password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="muted">Confirm password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Set password"}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
