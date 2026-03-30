import { describe, expect, test } from "bun:test";
import type { FastifyInstance } from "fastify";
import { createInMemoryStudioDeps } from "../helpers/in-memory-studio-deps.js";
import { buildTestStudioApiApp, getCookieValue } from "../helpers/test-app.js";

const OAUTH_COOKIE = "studio_oauth_state";
const SESSION_COOKIE = "studio_session";

const startAuth = async (app: FastifyInstance) => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/github/start",
    payload: { captchaToken: "test-token" },
  });
  return response;
};

const authenticate = async (app: FastifyInstance): Promise<string> => {
  const startResponse = await startAuth(app);
  expect(startResponse.statusCode).toBe(200);

  const oauthState = getCookieValue(startResponse, OAUTH_COOKIE);
  expect(oauthState).toBeTruthy();

  const callback = await app.inject({
    method: "GET",
    url: `/api/v1/auth/github/callback?code=test-code&state=${oauthState}`,
    headers: {
      cookie: `${OAUTH_COOKIE}=${oauthState}`,
    },
  });

  expect(callback.statusCode).toBe(302);
  const sessionCookie = getCookieValue(callback, SESSION_COOKIE);
  expect(sessionCookie).toBeTruthy();
  return sessionCookie as string;
};

const provisionRepo = async (app: FastifyInstance, sessionCookie: string): Promise<string> => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/repos/provision",
    headers: {
      cookie: `${SESSION_COOKIE}=${sessionCookie}`,
    },
    payload: { visibility: "public" },
  });

  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body) as { repo: { id: string } };
  return body.repo.id;
};

describe("studio api core integration path", () => {
  test("runs auth -> provision -> save -> deploy status -> sync happy path", async () => {
    const { deps, state } = createInMemoryStudioDeps();
    const app = await buildTestStudioApiApp(deps);

    try {
      const sessionCookie = await authenticate(app);

      const me = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
      });
      expect(me.statusCode).toBe(200);
      expect(JSON.parse(me.body)).toMatchObject({
        authenticated: true,
        user: {
          id: state.user.id,
          githubLogin: state.user.github_login,
        },
      });

      const repoId = await provisionRepo(app, sessionCookie);
      expect(state.repoMetadataUpdates).toContainEqual({
        description: null,
        homepageUrl: "https://fork-owner.github.io/open-links-fork/",
        owner: "fork-owner",
        repo: "open-links-fork",
      });

      const save = await app.inject({
        method: "PUT",
        url: `/api/v1/repos/${repoId}/content`,
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
        payload: {
          profile: { name: "Updated" },
          links: { links: [{ id: "main", href: "https://example.com" }] },
          site: { title: "Updated Site" },
          sha: {},
        },
      });

      expect(save.statusCode).toBe(200);
      const saveBody = JSON.parse(save.body) as {
        commits: Array<{ filePath: string; sha: string }>;
        deployStatus: { ci: string; deploy: string; pagesUrl: string | null };
      };
      expect(saveBody.commits).toHaveLength(3);
      expect(saveBody.deployStatus).toEqual(state.deployStatus);
      expect(state.savedPayloads).toHaveLength(1);

      const deployStatus = await app.inject({
        method: "GET",
        url: `/api/v1/repos/${repoId}/deploy-status`,
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
      });
      expect(deployStatus.statusCode).toBe(200);
      expect(JSON.parse(deployStatus.body)).toEqual(state.deployStatus);
      expect(state.repoMetadataUpdates).toHaveLength(1);

      const sync = await app.inject({
        method: "POST",
        url: `/api/v1/repos/${repoId}/sync`,
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
      });
      expect(sync.statusCode).toBe(200);
      expect(JSON.parse(sync.body)).toMatchObject({
        status: "synced",
      });

      const repo = state.repos.get(repoId);
      expect(repo?.sync_enabled).toBe(true);
      expect(repo?.sync_conflict).toBe(false);
    } finally {
      await app.close();
    }
  });

  test("does not overwrite a customized repo homepage during deploy reconciliation", async () => {
    const { deps, state } = createInMemoryStudioDeps();
    const app = await buildTestStudioApiApp(deps);

    try {
      const sessionCookie = await authenticate(app);
      const repoId = await provisionRepo(app, sessionCookie);

      state.repositoryMetadata.homepageUrl = "https://custom.example.com/profile";
      state.repoMetadataUpdates.length = 0;

      const deployStatus = await app.inject({
        method: "GET",
        url: `/api/v1/repos/${repoId}/deploy-status`,
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
      });
      expect(deployStatus.statusCode).toBe(200);
      expect(JSON.parse(deployStatus.body)).toEqual(state.deployStatus);
      expect(state.repoMetadataUpdates).toHaveLength(0);
      expect(state.repositoryMetadata.homepageUrl).toBe("https://custom.example.com/profile");
    } finally {
      await app.close();
    }
  });

  test("rejects callback with mismatched oauth state", async () => {
    const { deps } = createInMemoryStudioDeps();
    const app = await buildTestStudioApiApp(deps);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/github/callback?code=test-code&state=wrong",
        headers: {
          cookie: `${OAUTH_COOKIE}=expected`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({ message: "OAuth state mismatch" });
    } finally {
      await app.close();
    }
  });

  test("requires session on protected endpoints", async () => {
    const { deps } = createInMemoryStudioDeps();
    const app = await buildTestStudioApiApp(deps);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/repos",
      });
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ message: "Authentication required" });
    } finally {
      await app.close();
    }
  });

  test("blocks provisioning when github app installation is missing", async () => {
    const { deps, state } = createInMemoryStudioDeps();
    state.installationPresent = false;
    const app = await buildTestStudioApiApp(deps);

    try {
      const sessionCookie = await authenticate(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/repos/provision",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
        payload: { visibility: "public" },
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body)).toMatchObject({
        reason: "github_app_not_installed",
      });
    } finally {
      await app.close();
    }
  });

  test("returns 422 when payload validation fails during save", async () => {
    const { deps, state } = createInMemoryStudioDeps();
    state.validationMode = "invalid";
    const app = await buildTestStudioApiApp(deps);

    try {
      const sessionCookie = await authenticate(app);
      const repoId = await provisionRepo(app, sessionCookie);

      const save = await app.inject({
        method: "PUT",
        url: `/api/v1/repos/${repoId}/content`,
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
        payload: {
          profile: { name: "Broken" },
          links: { links: [] },
          site: {},
          sha: {},
        },
      });

      expect(save.statusCode).toBe(422);
      expect(JSON.parse(save.body)).toMatchObject({
        valid: false,
      });
    } finally {
      await app.close();
    }
  });

  test("reports conflict and disables sync when fork sync conflicts", async () => {
    const { deps, state } = createInMemoryStudioDeps();
    state.syncMode = "conflict";
    const app = await buildTestStudioApiApp(deps);

    try {
      const sessionCookie = await authenticate(app);
      const repoId = await provisionRepo(app, sessionCookie);

      const sync = await app.inject({
        method: "POST",
        url: `/api/v1/repos/${repoId}/sync`,
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionCookie}`,
        },
      });

      expect(sync.statusCode).toBe(200);
      expect(JSON.parse(sync.body)).toMatchObject({
        status: "conflict",
      });

      const repo = state.repos.get(repoId);
      expect(repo?.sync_enabled).toBe(false);
      expect(repo?.sync_conflict).toBe(true);
    } finally {
      await app.close();
    }
  });

  test("rejects internal sync run when secret is missing", async () => {
    const { deps } = createInMemoryStudioDeps();
    const app = await buildTestStudioApiApp(deps);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/internal/sync/run",
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ message: "Unauthorized" });
    } finally {
      await app.close();
    }
  });

  test("processes due repos in internal sync run with valid secret", async () => {
    const { deps } = createInMemoryStudioDeps();
    const app = await buildTestStudioApiApp(deps);

    try {
      const sessionCookie = await authenticate(app);
      await provisionRepo(app, sessionCookie);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/internal/sync/run",
        headers: {
          "x-internal-secret": deps.config.internalCronSecret,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        scanned: 1,
        processed: 1,
      });
    } finally {
      await app.close();
    }
  });
});
