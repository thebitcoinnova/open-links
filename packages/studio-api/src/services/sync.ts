import type { SyncResult } from "@openlinks/studio-shared";
import { db, type RepoRecord } from "./database.js";
import { githubAuthService } from "./github-auth.js";
import { githubRepoService } from "./github-repo.js";

export const syncRepo = async (repo: RepoRecord): Promise<SyncResult> => {
  const token = await githubAuthService.getUserToken(repo.user_id);
  const result = await githubRepoService.syncFork({
    accessToken: token,
    owner: repo.owner,
    repo: repo.name,
    branch: repo.default_branch,
  });

  await db.createSyncJob({
    repoId: repo.id,
    status: result.status,
    message: result.message,
    upstreamSha: result.upstreamSha,
    forkSha: result.forkSha,
  });

  if (result.status === "synced") {
    await db.updateRepoSyncState(repo.id, {
      syncConflict: false,
      syncEnabled: true,
      lastSyncedAt: new Date(),
      lastSyncStatus: result.status,
      lastSyncMessage: result.message,
    });
  } else if (result.status === "conflict") {
    await db.updateRepoSyncState(repo.id, {
      syncEnabled: false,
      syncConflict: true,
      lastSyncStatus: result.status,
      lastSyncMessage: result.message,
    });
  } else {
    await db.updateRepoSyncState(repo.id, {
      lastSyncStatus: result.status,
      lastSyncMessage: result.message,
    });
  }

  await db.logOperation({
    repoId: repo.id,
    userId: repo.user_id,
    operation: "sync_fork",
    status: result.status === "failed" ? "error" : "ok",
    detail: result,
  });

  return result;
};
