import "server-only";

import { env } from "@/lib/env";

export function getRequestUserId(userId?: string) {
  return userId ?? env.DEV_USER_ID;
}
