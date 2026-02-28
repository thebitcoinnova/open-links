import { authStartRequestSchema } from "@openlinks/studio-shared";
import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { SESSION_COOKIE_NAME, requireSession } from "../lib/auth.js";
import { newId } from "../lib/ids.js";
import { db } from "../services/database.js";
import { githubAuthService } from "../services/github-auth.js";
import { turnstileService } from "../services/turnstile.js";

const OAUTH_STATE_COOKIE = "studio_oauth_state";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.nodeEnv === "production",
  path: "/",
  domain: config.cookieDomain,
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/v1/auth/github/start",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = authStartRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({
          message: "Invalid auth start request",
          issues: parsed.error.flatten(),
        });
        return;
      }

      if (config.nodeEnv === "production" && !parsed.data.captchaToken) {
        reply.code(400).send({
          message: "Missing CAPTCHA token",
          reason: "captcha_missing",
        });
        return;
      }

      if (parsed.data.captchaToken) {
        const verification = await turnstileService.verifyToken({
          token: parsed.data.captchaToken,
          remoteIp: request.ip,
        });

        if (verification.status === "unavailable") {
          reply.code(503).send({
            message: "CAPTCHA verification unavailable",
            reason: verification.reason,
          });
          return;
        }

        if (verification.status === "failed") {
          reply.code(403).send({
            message: "CAPTCHA verification failed",
            reason: verification.reason,
          });
          return;
        }
      }

      const state = newId();
      const url = githubAuthService.createAuthorizationUrl(state);

      reply.setCookie(OAUTH_STATE_COOKIE, state, {
        ...cookieOptions,
        maxAge: 60 * 10,
      });

      reply.send({ authorizeUrl: url });
    },
  );

  app.get(
    "/api/v1/auth/github/callback",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
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
    },
  );

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
