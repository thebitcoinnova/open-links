import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { SESSION_COOKIE_NAME, requireSession } from "../lib/auth.js";
import { newId } from "../lib/ids.js";
import { db } from "../services/database.js";
import { githubAuthService } from "../services/github-auth.js";

const OAUTH_STATE_COOKIE = "studio_oauth_state";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.nodeEnv === "production",
  path: "/",
  domain: config.cookieDomain,
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/auth/github/start", async (_request, reply) => {
    const state = newId();
    const url = githubAuthService.createAuthorizationUrl(state);

    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: 60 * 10,
    });

    reply.redirect(url);
  });

  app.get("/api/v1/auth/github/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };

    if (!query.code || !query.state) {
      reply.code(400).send({ message: "Missing OAuth callback parameters" });
      return;
    }

    const expectedState = request.cookies[OAUTH_STATE_COOKIE];
    if (!expectedState || expectedState !== query.state) {
      reply.code(400).send({ message: "OAuth state mismatch" });
      return;
    }

    const session = await githubAuthService.exchangeCodeForSession({ code: query.code });

    const ttlMs = config.sessionTtlDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const sessionId = await db.createSession({ userId: session.user.id, expiresAt });

    reply.clearCookie(OAUTH_STATE_COOKIE, cookieOptions);
    reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
      ...cookieOptions,
      expires: expiresAt,
    });

    reply.redirect(`${config.studioWebUrl}/onboarding?github=connected`);
  });

  app.get("/api/v1/auth/me", { preHandler: requireSession }, async (request) => {
    return {
      authenticated: true,
      user: request.sessionUser,
    };
  });

  app.post("/api/v1/auth/logout", { preHandler: requireSession }, async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE_NAME];
    if (sessionId) {
      await githubAuthService.revokeSession(sessionId);
    }
    reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    reply.send({ ok: true });
  });
};
