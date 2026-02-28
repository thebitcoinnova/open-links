import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  STUDIO_API_URL: z.string().url().default("http://localhost:4000"),
  STUDIO_WEB_URL: z.string().url().default("http://localhost:4173"),
  CORS_ORIGIN: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  INTERNAL_CRON_SECRET: z.string().min(16),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  UPSTREAM_REPO_OWNER: z.string().min(1),
  UPSTREAM_REPO_NAME: z.string().min(1),
  REPO_DEFAULT_VISIBILITY: z.enum(["public", "private"]).default("public"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  SYNC_INTERVAL_HOURS: z.coerce.number().int().positive().default(12),
  GITHUB_TOKEN_REFRESH_MARGIN_SECONDS: z.coerce.number().int().nonnegative().default(300),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

const exitInvalidEnv = (issues: Record<string, string[] | undefined>): never => {
  console.error("Studio API environment validation failed.");
  console.error("Detected issues:");
  for (const [key, messages] of Object.entries(issues)) {
    if (!messages || messages.length === 0) {
      console.error(`- ${key}: Invalid value`);
      continue;
    }
    for (const message of messages) {
      console.error(`- ${key}: ${message}`);
    }
  }
  console.error("");
  console.error("How to fix:");
  console.error("- Set each variable above to a valid non-placeholder value.");
  console.error("- For production builds, run: bun run studio:env:check:prod -- --target api");
  process.exit(1);
};

const loadEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      exitInvalidEnv(error.flatten().fieldErrors);
    }
    const message = error instanceof Error ? error.message : String(error);
    exitInvalidEnv({
      ENVIRONMENT: [message],
    });
  }
  throw new Error("Unreachable environment parse state");
};

const env = loadEnv();

if (env.NODE_ENV === "production" && !env.TURNSTILE_SECRET_KEY) {
  exitInvalidEnv({
    TURNSTILE_SECRET_KEY: ["Required in production builds"],
  });
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  apiBaseUrl: env.STUDIO_API_URL,
  studioWebUrl: env.STUDIO_WEB_URL,
  corsOrigin: env.CORS_ORIGIN ?? env.STUDIO_WEB_URL,
  cookieDomain: env.COOKIE_DOMAIN,
  databaseUrl: env.DATABASE_URL,
  sessionSecret: env.SESSION_SECRET,
  encryptionKey: env.ENCRYPTION_KEY,
  internalCronSecret: env.INTERNAL_CRON_SECRET,
  github: {
    appId: env.GITHUB_APP_ID,
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
    tokenRefreshMarginSeconds: env.GITHUB_TOKEN_REFRESH_MARGIN_SECONDS,
  },
  turnstile: {
    secretKey: env.TURNSTILE_SECRET_KEY ?? null,
    expectedHostname: new URL(env.STUDIO_WEB_URL).hostname.toLowerCase(),
  },
  upstreamRepo: {
    owner: env.UPSTREAM_REPO_OWNER,
    name: env.UPSTREAM_REPO_NAME,
    defaultVisibility: env.REPO_DEFAULT_VISIBILITY,
  },
  sessionTtlDays: env.SESSION_TTL_DAYS,
  syncIntervalHours: env.SYNC_INTERVAL_HOURS,
};

export type AppConfig = typeof config;
