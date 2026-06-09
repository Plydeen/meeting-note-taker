import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().optional(),
  DEV_USER_ID: z.string().uuid().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  RECALLAI_API_KEY: z.string().optional(),
  RECALLAI_REGION: z.string().default("us-east-1"),
  RECALLAI_WEBHOOK_SECRET: z.string().optional(),
  RECALLAI_WORKSPACE_VERIFICATION_SECRET: z.string().optional(),
  RECALLAI_BOT_NAME: z.string().default("Meeting Recorder"),
  SUMMARY_PROVIDER: z.string().default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  SUMMARY_MODEL: z.string().default("gpt-4.1-mini"),
});

export const env = envSchema.parse(process.env);

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
