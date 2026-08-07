import type { MeetingPlatform } from "@/lib/supabase/types";

export function detectMeetingPlatform(url: string): MeetingPlatform {
  if (/zoom\.us/i.test(url)) {
    return "zoom";
  }

  if (/meet\.google\.com/i.test(url)) {
    return "google_meet";
  }

  return "unknown";
}

export function extractMeetingUrlFromText(text: string): string | null {
  const match = text.match(/https:\/\/(?:[\w.-]*zoom\.us\/j\/[^\s<>"')]+|meet\.google\.com\/[a-z0-9-]+)/i);
  return match?.[0] ?? null;
}

export function normalizeMeetingUrl(input: string): string {
  const trimmed = input.trim();
  const extracted = extractMeetingUrlFromText(trimmed);
  return extracted ?? trimmed;
}
