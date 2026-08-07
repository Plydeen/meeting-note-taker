# Recall Meeting App — Go-Live Test Plan

App URL: https://recall.kowens.tech
Allowlisted users: kevin@heresy.financial, firepitfinancial@gmail.com, parkerlydeen@buttonscale.com

---

## Part 1 — Client's Google Cloud setup (do on the Zoom call, before testing)

All four must be true or "Connect Google Calendar" will fail:

1. **Authorized redirect URI** on the existing OAuth 2.0 Client (ID ends `...3s38j8cq...`):
   ```
   https://recall.kowens.tech/api/auth/google/callback
   ```
   Exact — no trailing slash, https. (Authorized JavaScript origins can be left blank; this is a server-side flow.)

2. **Google Calendar API enabled**: APIs & Services → Library → "Google Calendar API" → Enable.

3. **OAuth consent screen scopes** include `.../auth/calendar.events.readonly`
   (plus the default openid / email / profile). The app requests read-only calendar events.

4. **Publishing status** — pick one:
   - **Testing mode + add the client's Google account as a "Test user"** (recommended for tomorrow —
     works instantly, no Google verification needed for the sensitive calendar scope, up to 100 test users).
   - Production: works too, but shows an "unverified app" warning the client must click through
     (Advanced → Continue). Full verification only matters for wider public use.

The Client ID + Secret are already in the app's `.env`; nothing else needs changing app-side.

---

## Part 2 — Recall + summary pipeline (CAN be tested today, no Google needed)

The instant-join path needs only a live Zoom/Meet link + the Recall key — it exercises the whole
ingestion → transcript → summary → embedding pipeline independently of Google Calendar.

Steps:
1. Start a throwaway Zoom or Google Meet meeting; copy the join URL.
2. Logged in at https://recall.kowens.tech, use the **Instant join** form to submit that URL.
3. Verify downstream (server-side checks I can run):
   - `recall_bots` row created, bot actually appears in the meeting within ~30–60s.
   - Webhook traffic lands: rows in `ingestion_events`; live `transcript_segments` accumulate as people talk.
   - End the meeting → `bot.done` triggers transcript backfill → `transcript_segments` fully populated.
   - `summarize-meetings` cron (every 5 min) writes a `meeting_summaries` row (Bunsen/OpenAI).
   - `embed-summaries` cron (every 15 min) writes a `meeting_embeddings` row.
   - MCP endpoint (`/api/mcp/...` with the MCP access token) returns the meeting via search.

Verification queries (run against supabase-db):
```
select id, platform, status, meeting_url from meetings order by created_at desc limit 5;
select meeting_id, recall_bot_id, status from recall_bots order by updated_at desc limit 5;
select count(*) from transcript_segments where meeting_id = '<id>';
select meeting_id, length(content) from meeting_summaries order by created_at desc limit 3;
select count(*) from meeting_embeddings;
```

---

## Part 3 — Google Calendar path (test tomorrow with the client, after Part 1)

1. Client signs in → Settings → **Connect Google Calendar** → completes Google consent.
   - Verify: `calendar_connections` row for the client with a stored refresh token;
     `profiles` row has their email.
2. Initial sync runs immediately on connect; `sync-calendars` cron re-runs every 5 min.
   - Verify: upcoming meetings with a Zoom/Meet link appear in `meetings`.
3. Auto-join + bot queueing: `queue-recall-bots` cron (every 2 min) dispatches a bot for an
   eligible upcoming meeting per the connection's auto-join rules.
   - Verify: `recall_bots` row + bot joins the real scheduled meeting.
4. Multi-account (optional): connect a second Google account; confirm both appear and sync.
5. Disconnect: remove a calendar connection; confirm its meetings cascade-delete.

---

## Notes / knowns
- Core pipeline is 100% server-side: the `cron` container hits `/api/cron/{queue-recall-bots,
  sync-calendars,summarize-meetings,embed-summaries}` on schedule — no browser/session needed.
- Password onboarding: each allowlisted user uses "Forgot password?" → email → set their own password.
  Public signups are disabled; the allowlist is the gate.
- Recovery links are single-use and expire in 1h; use the newest email and click promptly.
