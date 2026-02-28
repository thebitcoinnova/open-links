import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { StudioApiDependencies } from "../../src/types/studio-api-dependencies.js";

const ensureStudioApiEnv = () => {
  process.env.NODE_ENV ??= "test";
  process.env.PORT ??= "4000";
  process.env.STUDIO_API_URL ??= "http://localhost:4000";
  process.env.STUDIO_WEB_URL ??= "http://localhost:4173";
  process.env.CORS_ORIGIN ??= "http://localhost:4173";
  process.env.DATABASE_URL ??= "postgresql://studio:studio@localhost:5435/openlinks_studio_test";
  process.env.SESSION_SECRET ??= "session-secret-session-secret-1234";
  process.env.ENCRYPTION_KEY ??= "encryption-key-encryption-key-1234";
  process.env.INTERNAL_CRON_SECRET ??= "internal-cron-secret-1234";
  process.env.GITHUB_APP_ID ??= "12345";
  process.env.GITHUB_APP_CLIENT_ID ??= "test-client-id";
  process.env.GITHUB_APP_CLIENT_SECRET ??= "test-client-secret";
  process.env.GITHUB_APP_PRIVATE_KEY ??=
    "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----";
  process.env.GITHUB_WEBHOOK_SECRET ??= "test-webhook-secret";
  process.env.UPSTREAM_REPO_OWNER ??= "upstream-owner";
  process.env.UPSTREAM_REPO_NAME ??= "open-links";
  process.env.REPO_DEFAULT_VISIBILITY ??= "public";
  process.env.SESSION_TTL_DAYS ??= "14";
  process.env.SYNC_INTERVAL_HOURS ??= "12";
  process.env.GITHUB_TOKEN_REFRESH_MARGIN_SECONDS ??= "300";
};

export const buildTestStudioApiApp = async (
  deps: StudioApiDependencies,
): Promise<FastifyInstance> => {
  ensureStudioApiEnv();
  const { buildStudioApiApp } = await import("../../src/app.js");
  return buildStudioApiApp({ deps });
};

export const getCookieValue = (
  response: LightMyRequestResponse,
  cookieName: string,
): string | null => {
  const header = response.headers["set-cookie"];
  const setCookies = Array.isArray(header) ? header : header ? [header] : [];

  for (const cookie of setCookies) {
    const [nameValue] = cookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name.trim() === cookieName) {
      return value;
    }
  }

  return null;
};
