import "server-only";

import { env, requireEnv } from "@/lib/env";
import { detectMeetingPlatform, extractMeetingUrlFromText } from "@/lib/meetings/platform";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  organizer?: { email?: string; self?: boolean };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
  }>;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

type CalendarConnection = Database["public"]["Tables"]["calendar_connections"]["Row"];

export function getGoogleAuthUrl(state: string) {
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${env.APP_BASE_URL}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    // select_account forces Google's account picker so additional Google
    // accounts can be connected instead of silently reusing the active session.
    prompt: "consent select_account",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForConnection(code: string, userId: string) {
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${env.APP_BASE_URL}/api/auth/google/callback`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed: ${await tokenResponse.text()}`);
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
  const userInfo = await fetchGoogleUserInfo(tokens.access_token);
  const supabase = createSupabaseAdmin();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from("profiles").upsert({
    id: userId,
    email: userInfo.email ?? null,
    display_name: userInfo.name ?? null,
  });

  const { data, error } = await supabase
    .from("calendar_connections")
    .upsert(
      {
        user_id: userId,
        provider: "google",
        account_email: userInfo.email ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        scopes: tokens.scope.split(" "),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,account_email" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Best-effort revocation of a Google OAuth grant so the app no longer retains
// access after a connection is removed. Failures are swallowed because the
// connection row is deleted regardless (e.g. token already expired/revoked).
export async function revokeGoogleToken(token: string | null | undefined) {
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });

    return response.ok;
  } catch (error) {
    console.error("[google revoke] failed", error);
    return false;
  }
}

export async function syncUpcomingMeetings(connectionId: string, lookaheadDays = 14) {
  const supabase = createSupabaseAdmin();
  const { data: connection, error } = await supabase
    .from("calendar_connections")
    .select()
    .eq("id", connectionId)
    .single();

  if (error) {
    throw error;
  }

  const accessToken = await getFreshAccessToken(connection);
  const timeMin = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + lookaheadDays * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax,
    conferenceDataVersion: "1",
    maxResults: "250",
  });

  const response = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar sync failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as { items?: GoogleEvent[] };
  const events = payload.items ?? [];
  const syncedMeetings = [];

  for (const event of events) {
    const meetingUrl = extractMeetingUrl(event);
    if (!meetingUrl) {
      continue;
    }

    const startsAt = event.start?.dateTime ?? event.start?.date;
    if (!startsAt) {
      continue;
    }

    const autoJoinEnabled = shouldAutoJoin(connection, event);
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .upsert(
        {
          user_id: connection.user_id,
          calendar_connection_id: connection.id,
          external_calendar_id: event.id,
          title: event.summary ?? "Untitled meeting",
          description: event.description ?? null,
          meeting_url: meetingUrl,
          platform: detectMeetingPlatform(meetingUrl),
          starts_at: new Date(startsAt).toISOString(),
          ends_at: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : null,
          timezone: event.start?.timeZone ?? null,
          organizer_email: event.organizer?.email ?? null,
          status: autoJoinEnabled ? "scheduled" : "skipped",
          auto_join_enabled: autoJoinEnabled,
          requires_approval: requiresManualApproval(connection),
          raw_event: event,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,external_calendar_id" },
      )
      .select()
      .single();

    if (meetingError) {
      throw meetingError;
    }

    await upsertParticipants(meeting.id, event.attendees ?? []);
    syncedMeetings.push(meeting);
  }

  await supabase
    .from("calendar_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  return syncedMeetings;
}

export function extractMeetingUrl(event: GoogleEvent) {
  const candidates = [
    event.hangoutLink,
    ...(event.conferenceData?.entryPoints?.map((entry) => entry.uri) ?? []),
    event.location,
    event.description,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const url = extractMeetingUrlFromText(candidate);
    if (url) {
      return url;
    }
  }

  return null;
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${await response.text()}`);
  }

  return (await response.json()) as GoogleUserInfo;
}

async function getFreshAccessToken(connection: CalendarConnection) {
  if (connection.access_token && connection.expires_at && Date.parse(connection.expires_at) > Date.now() + 60_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new Error("Google connection is missing a refresh token.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`);
  }

  const tokens = (await response.json()) as GoogleTokenResponse;
  await createSupabaseAdmin()
    .from("calendar_connections")
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

async function upsertParticipants(meetingId: string, attendees: NonNullable<GoogleEvent["attendees"]>) {
  if (attendees.length === 0) {
    return;
  }

  const rows = attendees
    .filter((attendee) => attendee.email)
    .map((attendee) => ({
      meeting_id: meetingId,
      name: attendee.displayName ?? null,
      email: attendee.email ?? null,
      response_status: attendee.responseStatus ?? null,
      is_organizer: attendee.organizer ?? false,
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await createSupabaseAdmin()
    .from("meeting_participants")
    .upsert(rows, { onConflict: "meeting_id,email" });

  if (error) {
    throw error;
  }
}

function shouldAutoJoin(connection: CalendarConnection, event: GoogleEvent) {
  if (!connection.auto_join_enabled) {
    return false;
  }

  const rules = parseAutoJoinRules(connection.auto_join_rules);
  const self = event.attendees?.find((attendee) => attendee.self);

  if (rules.accepted_only && self?.responseStatus && !["accepted", "needsAction"].includes(self.responseStatus)) {
    return false;
  }

  if (rules.external_attendees_only) {
    const ownDomain = connection.account_email?.split("@")[1];
    const hasExternal = event.attendees?.some((attendee) => {
      const domain = attendee.email?.split("@")[1];
      return domain && ownDomain && domain !== ownDomain;
    });

    if (!hasExternal) {
      return false;
    }
  }

  return true;
}

function requiresManualApproval(connection: CalendarConnection) {
  return parseAutoJoinRules(connection.auto_join_rules).manual_approval_required;
}

function parseAutoJoinRules(value: unknown) {
  const defaults = {
    accepted_only: true,
    external_attendees_only: false,
    manual_approval_required: false,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  return { ...defaults, ...value };
}
