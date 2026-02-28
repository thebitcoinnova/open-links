import type { FastifyPluginAsync } from "fastify";
import type { OnboardingStatus } from "@openlinks/studio-shared";
import { requireSession } from "../lib/auth.js";
import { db } from "../services/database.js";
import { githubAuthService } from "../services/github-auth.js";

export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/onboarding/status", { preHandler: requireSession }, async (request) => {
    const user = request.sessionUser;
    if (!user) {
      return {
        githubConnected: false,
        appInstalled: false,
        repoProvisioned: false,
        pagesVerified: false,
        blockers: ["session_missing"],
      } satisfies OnboardingStatus;
    }

    const [repo, appInstalled] = await Promise.all([
      db.getLatestRepoForUser(user.id),
      githubAuthService.hasRequiredInstallation(user.id).catch(() => false),
    ]);

    const blockers: string[] = [];
    if (!appInstalled) {
      blockers.push("github_app_not_installed");
    }

    if (!repo) {
      blockers.push("repo_not_provisioned");
    }

    if (repo?.sync_conflict) {
      blockers.push("sync_conflict");
    }

    return {
      githubConnected: true,
      appInstalled,
      repoProvisioned: Boolean(repo),
      pagesVerified: Boolean(repo?.pages_url),
      blockers,
    } satisfies OnboardingStatus;
  });
};
