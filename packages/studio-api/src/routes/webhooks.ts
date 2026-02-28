import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

export interface WebhookRouteDeps {
  webhookSecret: string;
  disableReposForOwner: (owner: string) => Promise<void>;
}

const SIGNATURE_PREFIX = "sha256=";
const SHA256_HEX_LENGTH = 64;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
};

const getRawBodyBuffer = (rawBody: Buffer | string | undefined): Buffer | undefined => {
  if (!rawBody) {
    return undefined;
  }

  if (typeof rawBody === "string") {
    return Buffer.from(rawBody, "utf8");
  }

  return rawBody;
};

const verifySignature = (
  raw: Buffer | undefined,
  signatureHeader: string | undefined,
  webhookSecret: string,
): boolean => {
  if (!raw || !signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const actualHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (actualHex.length !== SHA256_HEX_LENGTH || !SHA256_HEX_PATTERN.test(actualHex)) {
    return false;
  }

  const expectedBuf = createHmac("sha256", webhookSecret).update(raw).digest();
  const actualBuf = Buffer.from(actualHex, "hex");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, actualBuf);
};

export const createWebhookRoutes = (deps: WebhookRouteDeps): FastifyPluginAsync => {
  return async (app) => {
    app.post(
      "/api/v1/github/webhooks",
      {
        config: {
          rawBody: true,
        },
      },
      async (request, reply) => {
        const signature = getHeaderValue(request.headers["x-hub-signature-256"]);
        const event = getHeaderValue(request.headers["x-github-event"]);
        const body = request.body as Record<string, unknown>;
        const rawBody = getRawBodyBuffer(request.rawBody);

        if (!verifySignature(rawBody, signature, deps.webhookSecret)) {
          reply.code(401).send({ message: "Invalid webhook signature" });
          return;
        }

        if (event === "installation") {
          const action = body.action;
          const installation = body.installation as { account?: { login?: string } } | undefined;
          const owner = installation?.account?.login;

          if ((action === "deleted" || action === "suspend") && owner) {
            await deps.disableReposForOwner(owner);
          }
        }

        reply.send({ ok: true });
      },
    );
  };
};

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  const [{ config }, { db }] = await Promise.all([
    import("../config.js"),
    import("../services/database.js"),
  ]);
  await app.register(
    createWebhookRoutes({
      webhookSecret: config.github.webhookSecret,
      disableReposForOwner: (owner) => db.disableReposForOwner(owner),
    }),
  );
};
