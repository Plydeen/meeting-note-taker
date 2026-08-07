import type { Metadata } from "next";
import Link from "next/link";

import "@/app/globals.css";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = {
  title: "Recall Meeting Transcription",
  description: "Calendar-driven Recall.ai meeting transcription and summarization.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <main className="shell">
          <nav className="nav">
            <Link href="/">
              <strong>Recall Meetings</strong>
            </Link>
            {user ? (
              <div className="nav-links" style={{ alignItems: "center" }}>
                <Link href="/">Dashboard</Link>
                <Link href="/meetings">Meetings</Link>
                <Link href="/settings">Settings</Link>
                <span className="muted">{user.email}</span>
                <form action={signOut}>
                  <button className="signout" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
