import type { Metadata } from "next";
import Link from "next/link";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Recall Meeting Transcription",
  description: "Calendar-driven Recall.ai meeting transcription and summarization.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="shell">
          <nav className="nav">
            <Link href="/">
              <strong>Recall Meetings</strong>
            </Link>
            <div className="nav-links">
              <Link href="/">Dashboard</Link>
              <Link href="/meetings">Meetings</Link>
              <Link href="/settings">Settings</Link>
            </div>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
