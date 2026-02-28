import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { db } from "../services/database.js";

const verifySignature = (raw: string, signatureHeader?: string): boolean => {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", config.github.webhookSecret).update(raw).digest("hex");

  const actual = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
};

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/v1/github/webhooks", async (request, reply) => {
    const signature = request.headers["x-hub-signature-256"] as string | undefined;
    const event = request.headers["x-github-event"] as string | undefined;
    const body = request.body as Record<string, unknown>;
    const raw = JSON.stringify(body);

    if (!verifySignature(raw, signature)) {
      reply.code(401).send({ message: "Invalid webhook signature" });
      return;
    }

    if (event === "installation") {
      const action = body.action;
      const installation = body.installation as { account?: { login?: string } } | undefined;
      const owner = installation?.account?.login;

      if ((action === "deleted" || action === "suspend") && owner) {
        await db.disableReposForOwner(owner);
      }
    }

    reply.send({ ok: true });
  });
};
