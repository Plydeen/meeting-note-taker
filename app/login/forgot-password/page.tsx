import Link from "next/link";

import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="grid">
      <section className="card" style={{ maxWidth: 420, margin: "40px auto", width: "100%" }}>
        <p className="muted">Recall Meetings</p>
        <h1>Reset your password</h1>
        {sent ? (
          <p className="muted">If that email has access to this app, a reset link is on its way.</p>
        ) : (
          <>
            <p className="muted">Enter your email and we&apos;ll send you a link to set a new password.</p>
            {error ? (
              <p style={{ color: "#dc2626", fontWeight: 600 }} role="alert">
                Enter your email address.
              </p>
            ) : null}
            <form action={requestPasswordReset} className="auth-form">
              <label className="field">
                <span className="muted">Email</span>
                <input className="input" type="email" name="email" autoComplete="email" required />
              </label>
              <button className="button" type="submit">
                Send reset link
              </button>
            </form>
          </>
        )}
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </section>
    </div>
  );
}
