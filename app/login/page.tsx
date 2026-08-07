import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { signIn } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  missing: "Enter your email and password.",
  not_allowed: "This account is not authorized to access this app.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { error, reset } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] ?? "Unable to sign in." : null;
  const notice = reset ? "Your password has been set. Sign in to continue." : null;

  return (
    <div className="grid">
      <section className="card" style={{ maxWidth: 420, margin: "40px auto", width: "100%" }}>
        <p className="muted">Recall Meetings</p>
        <h1>Sign in</h1>
        <p className="muted">This app is private. Sign in with your authorized account to continue.</p>
        {message ? (
          <p style={{ color: "#dc2626", fontWeight: 600 }} role="alert">
            {message}
          </p>
        ) : null}
        {notice ? (
          <p style={{ color: "#16a34a", fontWeight: 600 }} role="status">
            {notice}
          </p>
        ) : null}
        <form action={signIn} className="auth-form">
          <label className="field">
            <span className="muted">Email</span>
            <input className="input" type="email" name="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span className="muted">Password</span>
            <input className="input" type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/login/forgot-password">Forgot password?</Link>
        </p>
      </section>
    </div>
  );
}
