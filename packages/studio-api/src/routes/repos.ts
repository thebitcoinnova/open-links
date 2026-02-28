import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { RepoContentPayload } from "@openlinks/studio-shared";
import { config } from "../config.js";
import { requireSession } from "../lib/auth.js";
import { db } from "../services/database.js";
import { githubAuthService } from "../services/github-auth.js";
import { githubRepoService } from "../services/github-repo.js";
import { syncRepo } from "../services/sync.js";
import { validateRepoContent } from "../services/validation.js";

const provisionBodySchema = z.object({
  visibility: z.enum(["public", "private"]).optional(),
});

const contentBodySchema = z.object({
  profile: z.record(z.unknown()),
  links: z.record(z.unknown()),
  site: z.record(z.unknown()),
  sha: z
    .object({
      profile: z.string().optional(),
      links: z.string().optional(),
      site: z.string().optional(),
    })
    .optional(),
});

const resolveSessionUser = (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.sessionUser;
  if (!user) {
    reply.code(401).send({ message: "Authentication required" });
    return null;
  }
  return user;
};

export const repoRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/repos", { preHandler: requireSession }, async (request, reply) => {
    const user = resolveSessionUser(request, reply);
    if (!user) {
      return;
    }
    const repos = await db.listReposForUser(user.id);
    return { repos };
  });

  app.post("/api/v1/repos/provision", { preHandler: requireSession }, async (request, reply) => {
    const user = resolveSessionUser(request, reply);
    if (!user) {
      return;
    }
    const parsed = provisionBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply
        .code(400)
        .send({ message: "Invalid provision request", issues: parsed.error.flatten() });
      return;
    }

    const hasInstall = await githubAuthService.hasRequiredInstallation(user.id).catch(() => false);
    if (!hasInstall) {
      reply.code(409).send({
        message: "GitHub App installation missing. Install the app before provisioning a fork.",
        reason: "github_app_not_installed",
      });
      return;
    }

    const token = await githubAuthService.getUserToken(user.id);

    try {
      const fork = await githubRepoService.createFork({
        accessToken: token,
        upstreamOwner: config.upstreamRepo.owner,
        upstreamRepo: config.upstreamRepo.name,
      });

      const repo = await db.upsertRepo({
        userId: user.id,
        owner: fork.owner,
        name: fork.name,
        defaultBranch: fork.defaultBranch,
        visibility: parsed.data.visibility ?? fork.visibility,
        upstreamOwner: config.upstreamRepo.owner,
        upstreamName: config.upstreamRepo.name,
        syncIntervalHours: config.syncIntervalHours,
      });

      await db.logOperation({
        repoId: repo.id,
        userId: user.id,
        operation: "provision_fork",
        status: "ok",
        detail: { owner: fork.owner, name: fork.name },
      });

      reply.code(201).send({ repo });
    } catch (error: unknown) {
      await db.logOperation({
        userId: user.id,
        operation: "provision_fork",
        status: "error",
        detail: { message: error instanceof Error ? error.message : "unknown" },
      });

      reply.code(500).send({
        message: error instanceof Error ? error.message : "Failed to provision repository",
      });
    }
  });

  app.get(
    "/api/v1/repos/:repoId/content",
    { preHandler: requireSession },
    async (request, reply) => {
      const user = resolveSessionUser(request, reply);
      if (!user) {
        return;
      }
      const { repoId } = request.params as { repoId: string };

      const repo = await db.getRepoByIdForUser(repoId, user.id);
      if (!repo) {
        reply.code(404).send({ message: "Repository not found" });
        return;
      }

      const token = await githubAuthService.getUserToken(user.id);
      const content = await githubRepoService.getOpenLinksContent({
        accessToken: token,
        owner: repo.owner,
        repo: repo.name,
      });

      await db.upsertRepoFileSha(repo.id, "data/profile.json", content.sha.profile ?? "");
      await db.upsertRepoFileSha(repo.id, "data/links.json", content.sha.links ?? "");
      await db.upsertRepoFileSha(repo.id, "data/site.json", content.sha.site ?? "");

      reply.send(content);
    },
  );

  app.post(
    "/api/v1/repos/:repoId/validate",
    { preHandler: requireSession },
    async (request, reply) => {
      const parsed = contentBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        reply.code(400).send({ message: "Invalid payload", issues: parsed.error.flatten() });
        return;
      }

      const payload: RepoContentPayload = {
        profile: parsed.data.profile,
        links: parsed.data.links,
        site: parsed.data.site,
        sha: parsed.data.sha ?? {},
      };

      const result = await validateRepoContent(payload);
      reply.send(result);
    },
  );

  app.put(
    "/api/v1/repos/:repoId/content",
    { preHandler: requireSession },
    async (request, reply) => {
      const user = resolveSessionUser(request, reply);
      if (!user) {
        return;
      }
      const { repoId } = request.params as { repoId: string };
      const parsed = contentBodySchema.safeParse(request.body ?? {});

      if (!parsed.success) {
        reply.code(400).send({ message: "Invalid payload", issues: parsed.error.flatten() });
        return;
      }

      const repo = await db.getRepoByIdForUser(repoId, user.id);
      if (!repo) {
        reply.code(404).send({ message: "Repository not found" });
        return;
      }

      const payload: RepoContentPayload = {
        profile: parsed.data.profile,
        links: parsed.data.links,
        site: parsed.data.site,
        sha: parsed.data.sha ?? {},
      };

      const validation = await validateRepoContent(payload);
      if (!validation.valid) {
        reply.code(422).send(validation);
        return;
      }

      const token = await githubAuthService.getUserToken(user.id);

      if (!payload.sha.profile || !payload.sha.links || !payload.sha.site) {
        const current = await githubRepoService.getOpenLinksContent({
          accessToken: token,
          owner: repo.owner,
          repo: repo.name,
        });
        payload.sha = {
          profile: payload.sha.profile ?? current.sha.profile,
          links: payload.sha.links ?? current.sha.links,
          site: payload.sha.site ?? current.sha.site,
        };
      }

      const committed = await githubRepoService.commitOpenLinksContent({
        accessToken: token,
        owner: repo.owner,
        repo: repo.name,
        branch: repo.default_branch,
        payload,
        messagePrefix: "chore(studio)",
      });

      for (const commit of committed.commits) {
        await db.upsertRepoFileSha(repo.id, commit.filePath, commit.sha);
      }

      await db.updateRepoSyncState(repo.id, {
        pagesUrl: committed.deployStatus.pagesUrl,
        lastSyncStatus: "content_saved",
        lastSyncMessage: "Content saved from studio editor",
      });

      await db.logOperation({
        repoId: repo.id,
        userId: user.id,
        operation: "save_content",
        status: "ok",
        detail: committed,
      });

      reply.send(committed);
    },
  );

  app.get(
    "/api/v1/repos/:repoId/deploy-status",
    { preHandler: requireSession },
    async (request, reply) => {
      const user = resolveSessionUser(request, reply);
      if (!user) {
        return;
      }
      const { repoId } = request.params as { repoId: string };

      const repo = await db.getRepoByIdForUser(repoId, user.id);
      if (!repo) {
        reply.code(404).send({ message: "Repository not found" });
        return;
      }

      const token = await githubAuthService.getUserToken(user.id);
      const deployStatus = await githubRepoService.getDeployStatus({
        accessToken: token,
        owner: repo.owner,
        repo: repo.name,
        branch: repo.default_branch,
      });

      await db.updateRepoSyncState(repo.id, {
        pagesUrl: deployStatus.pagesUrl,
      });

      reply.send(deployStatus);
    },
  );

  app.post("/api/v1/repos/:repoId/sync", { preHandler: requireSession }, async (request, reply) => {
    const user = resolveSessionUser(request, reply);
    if (!user) {
      return;
    }
    const { repoId } = request.params as { repoId: string };

    const repo = await db.getRepoByIdForUser(repoId, user.id);
    if (!repo) {
      reply.code(404).send({ message: "Repository not found" });
      return;
    }

    const result = await syncRepo(repo);
    reply.send(result);
  });

  app.get(
    "/api/v1/repos/:repoId/operations",
    { preHandler: requireSession },
    async (request, reply) => {
      const user = resolveSessionUser(request, reply);
      if (!user) {
        return;
      }
      const { repoId } = request.params as { repoId: string };
      const repo = await db.getRepoByIdForUser(repoId, user.id);
      if (!repo) {
        reply.code(404).send({ message: "Repository not found" });
        return;
      }

      const operations = await db.listOperationsForRepo(repo.id, 50);
      reply.send({ operations });
    },
  );
};
