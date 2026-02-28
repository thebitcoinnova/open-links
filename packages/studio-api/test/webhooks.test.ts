import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import { createWebhookRoutes } from "../src/routes/webhooks.js";

const TEST_SECRET = "test-webhook-secret";

const createSignatureHeader = (raw: string): string => {
  const digest = createHmac("sha256", TEST_SECRET).update(raw).digest("hex");
  return `sha256=${digest}`;
};

const createTestServer = async (disabledOwners: string[]) => {
  const app = Fastify();

  await app.register(rawBody, {
    field: "rawBody",
    encoding: false,
    global: false,
  });

  await app.register(
    createWebhookRoutes({
      webhookSecret: TEST_SECRET,
      disableReposForOwner: async (owner: string) => {
        disabledOwners.push(owner);
      },
    }),
  );

  return app;
};

describe("webhook signature verification", () => {
  test("rejects when signature header is missing", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
        },
        payload: JSON.stringify({
          action: "deleted",
          installation: { account: { login: "octocat" } },
        }),
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ message: "Invalid webhook signature" });
      expect(disabledOwners).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  test("rejects when signature header prefix is invalid", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
          "x-hub-signature-256": "sha1=deadbeef",
        },
        payload: JSON.stringify({
          action: "deleted",
          installation: { account: { login: "octocat" } },
        }),
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ message: "Invalid webhook signature" });
      expect(disabledOwners).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  test("rejects when signature digest is malformed", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
          "x-hub-signature-256": "sha256=not-a-valid-hex-digest",
        },
        payload: JSON.stringify({
          action: "deleted",
          installation: { account: { login: "octocat" } },
        }),
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ message: "Invalid webhook signature" });
      expect(disabledOwners).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  test("accepts a valid signature computed from exact raw payload bytes", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    const rawPayload =
      '{\n  "action": "created",\n  "installation": { "account": { "login": "octocat" } }\n}\n';
    const signature = createSignatureHeader(rawPayload);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
          "x-hub-signature-256": signature,
        },
        payload: rawPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
      expect(disabledOwners).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  test("disables repos for installation deleted events", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    const rawPayload = JSON.stringify({
      action: "deleted",
      installation: { account: { login: "octocat" } },
    });
    const signature = createSignatureHeader(rawPayload);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
          "x-hub-signature-256": signature,
        },
        payload: rawPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(disabledOwners).toEqual(["octocat"]);
    } finally {
      await app.close();
    }
  });

  test("disables repos for installation suspend events", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    const rawPayload = JSON.stringify({
      action: "suspend",
      installation: { account: { login: "octocat" } },
    });
    const signature = createSignatureHeader(rawPayload);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
          "x-hub-signature-256": signature,
        },
        payload: rawPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(disabledOwners).toEqual(["octocat"]);
    } finally {
      await app.close();
    }
  });

  test("does not disable repos for non-removal installation actions", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    const rawPayload = JSON.stringify({
      action: "created",
      installation: { account: { login: "octocat" } },
    });
    const signature = createSignatureHeader(rawPayload);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "installation",
          "x-hub-signature-256": signature,
        },
        payload: rawPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(disabledOwners).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  test("does not disable repos for non-installation events", async () => {
    const disabledOwners: string[] = [];
    const app = await createTestServer(disabledOwners);

    const rawPayload = JSON.stringify({ ref: "refs/heads/main" });
    const signature = createSignatureHeader(rawPayload);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/github/webhooks",
        headers: {
          "content-type": "application/json",
          "x-github-event": "push",
          "x-hub-signature-256": signature,
        },
        payload: rawPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
      expect(disabledOwners).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
