import { env } from "@/lib/env";

// Meeting timestamps are stored in UTC. These helpers render them in the app's
// configured timezone (DISPLAY_TIMEZONE) so times are correct regardless of the
// server's own timezone (the container runs in UTC).
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString("en-US", {
    timeZone: env.DISPLAY_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatTime(value: string | number | Date): string {
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: env.DISPLAY_TIMEZONE,
    timeStyle: "short",
  });
}
