import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import rawBody from "fastify-raw-body";
import { createDefaultStudioApiDependencies } from "./default-studio-api-dependencies.js";
import { createRequireSession } from "./lib/auth.js";
import { createAuthRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { createInternalRoutes } from "./routes/internal.js";
import { createOnboardingRoutes } from "./routes/onboarding.js";
import { createRepoRoutes } from "./routes/repos.js";
import { createWebhookRoutes } from "./routes/webhooks.js";
import type { StudioApiDependencies } from "./types/studio-api-dependencies.js";

export type BuildStudioApiAppInput = {
  deps?: Partial<StudioApiDependencies>;
};

const resolveDependencies = (input?: Partial<StudioApiDependencies>): StudioApiDependencies => {
  const defaults = createDefaultStudioApiDependencies();
  const merged: StudioApiDependencies = {
    ...defaults,
    ...input,
  };

  if (input?.db && !input.requireSession) {
    merged.requireSession = createRequireSession({ db: merged.db });
  }

  return merged;
};

export const buildStudioApiApp = async (
  input: BuildStudioApiAppInput = {},
): Promise<FastifyInstance> => {
  const deps = resolveDependencies(input.deps);

  const server = Fastify({
    trustProxy: deps.config.nodeEnv === "production",
    logger: {
      level: deps.config.nodeEnv === "production" ? "info" : "debug",
    },
  });

  await server.register(cookie, {
    secret: deps.config.sessionSecret,
  });

  await server.register(cors, {
    origin: deps.config.corsOrigin,
    credentials: true,
  });

  await server.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
  });

  await server.register(rawBody, {
    field: "rawBody",
    encoding: false,
    global: false,
  });

  await server.register(healthRoutes);
  await server.register(createAuthRoutes(deps));
  await server.register(createOnboardingRoutes(deps));
  await server.register(createRepoRoutes(deps));
  await server.register(
    createWebhookRoutes({
      webhookSecret: deps.config.github.webhookSecret,
      disableReposForOwner: (owner) => deps.db.disableReposForOwner(owner),
    }),
  );
  await server.register(createInternalRoutes(deps));

  return server;
};

export { createDefaultStudioApiDependencies };
