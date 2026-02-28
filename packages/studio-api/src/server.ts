import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { repoRoutes } from "./routes/repos.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { internalRoutes } from "./routes/internal.js";

const server = Fastify({
  logger: {
    level: config.nodeEnv === "production" ? "info" : "debug",
  },
});

await server.register(cookie, {
  secret: config.sessionSecret,
});

await server.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

await server.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: "1 minute",
});

await server.register(healthRoutes);
await server.register(authRoutes);
await server.register(onboardingRoutes);
await server.register(repoRoutes);
await server.register(webhookRoutes);
await server.register(internalRoutes);

const start = async () => {
  try {
    await server.listen({ port: config.port, host: "0.0.0.0" });
    server.log.info(`studio-api listening on ${config.port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
