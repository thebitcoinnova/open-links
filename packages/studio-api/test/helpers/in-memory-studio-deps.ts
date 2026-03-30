import type { RepoContentPayload, SyncResult, ValidationResult } from "@openlinks/studio-shared";
import type { AppConfig } from "../../src/config.js";
import type { RepoRecord, UserRecord } from "../../src/services/database.js";
import type { TurnstileVerificationResult } from "../../src/services/turnstile.js";
import type {
  OperationRecord,
  SessionRecord,
  StudioApiDependencies,
} from "../../src/types/studio-api-dependencies.js";

type ValidationMode = "valid" | "invalid";
type SyncMode = "synced" | "conflict" | "failed";
const SESSION_COOKIE_NAME = "studio_session";

interface LoggedOperation extends OperationRecord {
  repo_id: string | null;
  user_id: string | null;
}

export interface InMemoryStudioState {
  user: UserRecord;
  sessions: Map<string, SessionRecord>;
  repos: Map<string, RepoRecord>;
  operations: LoggedOperation[];
  repoFileShas: Map<string, string>;
  installationPresent: boolean;
  validationMode: ValidationMode;
  syncMode: SyncMode;
  turnstileResult: TurnstileVerificationResult;
  deployStatus: {
    ci: string;
    deploy: string;
    pagesUrl: string | null;
  };
  repositoryMetadata: {
    description: string | null;
    homepageUrl: string | null;
  };
  repoMetadataUpdates: Array<{
    description: string | null;
    homepageUrl: string | null;
    owner: string;
    repo: string;
  }>;
  savedPayloads: RepoContentPayload[];
}

const now = () => new Date();

const createTestConfig = (): AppConfig => ({
  nodeEnv: "test",
  port: 4000,
  apiBaseUrl: "http://localhost:4000",
  studioWebUrl: "http://localhost:4173",
  corsOrigin: "http://localhost:4173",
  cookieDomain: undefined,
  databaseUrl: "postgresql://studio:studio@localhost:5435/openlinks_studio_test",
  sessionSecret: "session-secret-session-secret-1234",
  encryptionKey: "encryption-key-encryption-key-1234",
  internalCronSecret: "internal-cron-secret-1234",
  github: {
    appId: "12345",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    privateKey: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----",
    webhookSecret: "test-webhook-secret",
    tokenRefreshMarginSeconds: 300,
  },
  turnstile: {
    secretKey: null,
    expectedHostname: "localhost",
  },
  upstreamRepo: {
    owner: "upstream-owner",
    name: "open-links",
    defaultVisibility: "public",
  },
  sessionTtlDays: 14,
  syncIntervalHours: 12,
});

const toRepoFileKey = (repoId: string, filePath: string) => `${repoId}:${filePath}`;

const cloneRepo = (repo: RepoRecord): RepoRecord => ({ ...repo });

const createDefaultUser = (): UserRecord => ({
  id: "user_1",
  github_user_id: 1001,
  github_login: "octocat",
  github_name: "The Octocat",
  avatar_url: "https://avatars.example.test/octocat.png",
});

export const createInMemoryStudioDeps = (): {
  deps: StudioApiDependencies;
  state: InMemoryStudioState;
} => {
  const config = createTestConfig();
  const user = createDefaultUser();

  const state: InMemoryStudioState = {
    user,
    sessions: new Map<string, SessionRecord>(),
    repos: new Map<string, RepoRecord>(),
    operations: [],
    repoFileShas: new Map<string, string>(),
    installationPresent: true,
    validationMode: "valid",
    syncMode: "synced",
    turnstileResult: { status: "ok" },
    deployStatus: {
      ci: "success",
      deploy: "success",
      pagesUrl: "https://fork-owner.github.io/open-links-fork",
    },
    repositoryMetadata: {
      description: null,
      homepageUrl: "https://openlinks.us/",
    },
    repoMetadataUpdates: [],
    savedPayloads: [],
  };

  let sessionCounter = 0;
  let repoCounter = 0;
  let operationCounter = 0;
  let commitCounter = 0;

  const db: StudioApiDependencies["db"] = {
    async createSession(input) {
      const id = `session_${++sessionCounter}`;
      state.sessions.set(id, {
        id,
        user_id: input.userId,
        expires_at: input.expiresAt,
      });
      return id;
    },
    async getSession(sessionId) {
      return state.sessions.get(sessionId) ?? null;
    },
    async deleteSession(sessionId) {
      state.sessions.delete(sessionId);
    },
    async getUserById(userId) {
      return state.user.id === userId ? state.user : null;
    },
    async getLatestRepoForUser(userId) {
      const repos = Array.from(state.repos.values())
        .filter((repo) => repo.user_id === userId)
        .sort((a, b) => b.id.localeCompare(a.id));
      return repos[0] ?? null;
    },
    async listReposForUser(userId) {
      return Array.from(state.repos.values()).filter((repo) => repo.user_id === userId);
    },
    async upsertRepo(input) {
      const existing = Array.from(state.repos.values()).find(
        (repo) =>
          repo.user_id === input.userId && repo.owner === input.owner && repo.name === input.name,
      );

      if (existing) {
        existing.default_branch = input.defaultBranch;
        existing.visibility = input.visibility;
        existing.upstream_owner = input.upstreamOwner;
        existing.upstream_name = input.upstreamName;
        existing.sync_interval_hours = input.syncIntervalHours;
        state.repos.set(existing.id, cloneRepo(existing));
        return cloneRepo(existing);
      }

      const repo: RepoRecord = {
        id: `repo_${++repoCounter}`,
        user_id: input.userId,
        owner: input.owner,
        name: input.name,
        default_branch: input.defaultBranch,
        visibility: input.visibility,
        upstream_owner: input.upstreamOwner,
        upstream_name: input.upstreamName,
        pages_url: null,
        sync_enabled: true,
        sync_interval_hours: input.syncIntervalHours,
        sync_conflict: false,
        last_synced_at: null,
        last_sync_status: null,
        last_sync_message: null,
      };

      state.repos.set(repo.id, cloneRepo(repo));
      return cloneRepo(repo);
    },
    async getRepoByIdForUser(repoId, userId) {
      const repo = state.repos.get(repoId);
      if (!repo || repo.user_id !== userId) {
        return null;
      }
      return cloneRepo(repo);
    },
    async updateRepoSyncState(repoId, input) {
      const repo = state.repos.get(repoId);
      if (!repo) {
        return;
      }
      if (input.syncEnabled !== undefined) {
        repo.sync_enabled = input.syncEnabled;
      }
      if (input.syncConflict !== undefined) {
        repo.sync_conflict = input.syncConflict;
      }
      if (input.lastSyncedAt !== undefined) {
        repo.last_synced_at = input.lastSyncedAt;
      }
      if (input.lastSyncStatus !== undefined) {
        repo.last_sync_status = input.lastSyncStatus;
      }
      if (input.lastSyncMessage !== undefined) {
        repo.last_sync_message = input.lastSyncMessage;
      }
      if (input.pagesUrl !== undefined) {
        repo.pages_url = input.pagesUrl;
      }
      state.repos.set(repo.id, cloneRepo(repo));
    },
    async upsertRepoFileSha(repoId, filePath, fileSha) {
      state.repoFileShas.set(toRepoFileKey(repoId, filePath), fileSha);
    },
    async listOperationsForRepo(repoId, limit = 20) {
      return state.operations
        .filter((operation) => operation.repo_id === repoId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, limit)
        .map(({ repo_id: _repoId, user_id: _userId, ...rest }) => rest);
    },
    async logOperation(input) {
      const operation: LoggedOperation = {
        id: `op_${++operationCounter}`,
        operation: input.operation,
        status: input.status,
        detail_json: input.detail,
        created_at: now(),
        repo_id: input.repoId ?? null,
        user_id: input.userId ?? null,
      };
      state.operations.push(operation);
    },
    async getDueReposForSync(currentTime) {
      const nowMs = currentTime.getTime();
      const due: RepoRecord[] = [];
      for (const repo of state.repos.values()) {
        if (!repo.sync_enabled || repo.sync_conflict) {
          continue;
        }
        if (!repo.last_synced_at) {
          due.push(cloneRepo(repo));
          continue;
        }
        const intervalMs = repo.sync_interval_hours * 60 * 60 * 1000;
        if (repo.last_synced_at.getTime() <= nowMs - intervalMs) {
          due.push(cloneRepo(repo));
        }
      }
      return due;
    },
    async disableReposForOwner(owner) {
      for (const repo of state.repos.values()) {
        if (repo.owner.toLowerCase() === owner.toLowerCase()) {
          repo.sync_enabled = false;
          repo.last_sync_status = "app_uninstalled";
          repo.last_sync_message = "GitHub App installation removed or suspended";
          state.repos.set(repo.id, cloneRepo(repo));
        }
      }
    },
  };

  const githubAuthService: StudioApiDependencies["githubAuthService"] = {
    createAuthorizationUrl(stateValue) {
      return `https://github.com/login/oauth/authorize?state=${stateValue}`;
    },
    async exchangeCodeForSession() {
      return {
        user: state.user,
        accessToken: "token-for-tests",
        expiresAt: null,
        refreshToken: null,
        refreshExpiresAt: null,
      };
    },
    async getUserToken() {
      return "token-for-tests";
    },
    async hasRequiredInstallation() {
      return state.installationPresent;
    },
    async revokeSession(sessionId) {
      await db.deleteSession(sessionId);
    },
  };

  const githubRepoService: StudioApiDependencies["githubRepoService"] = {
    async createFork() {
      return {
        owner: "fork-owner",
        name: "open-links-fork",
        defaultBranch: "main",
        visibility: "public",
      };
    },
    async getOpenLinksContent() {
      return {
        profile: { name: "Test Profile" },
        links: { links: [{ id: "home", href: "https://example.com" }] },
        site: { title: "Test Site" },
        sha: {
          profile: "sha-profile-current",
          links: "sha-links-current",
          site: "sha-site-current",
        },
      };
    },
    async commitOpenLinksContent(input) {
      state.savedPayloads.push(input.payload);
      const commit = ++commitCounter;
      return {
        success: true,
        commits: [
          { filePath: "data/profile.json", sha: `sha-profile-${commit}` },
          { filePath: "data/links.json", sha: `sha-links-${commit}` },
          { filePath: "data/site.json", sha: `sha-site-${commit}` },
        ],
        deployStatus: state.deployStatus,
      };
    },
    async getDeployStatus() {
      return state.deployStatus;
    },
    async getRepositoryMetadata() {
      return state.repositoryMetadata;
    },
    async updateRepositoryMetadata(input) {
      state.repositoryMetadata = {
        description: input.description ?? state.repositoryMetadata.description,
        homepageUrl: input.homepageUrl ?? null,
      };
      state.repoMetadataUpdates.push({
        description: input.description ?? null,
        homepageUrl: input.homepageUrl ?? null,
        owner: input.owner,
        repo: input.repo,
      });
    },
  };

  const turnstileService: StudioApiDependencies["turnstileService"] = {
    async verifyToken() {
      return state.turnstileResult;
    },
  };

  const validateRepoContent: StudioApiDependencies["validateRepoContent"] = async () => {
    if (state.validationMode === "invalid") {
      const result: ValidationResult = {
        valid: false,
        errors: [
          {
            source: "site",
            path: "$.site",
            message: "Invalid site payload for tests",
          },
        ],
        warnings: [],
      };
      return result;
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };
    return result;
  };

  const syncRepo: StudioApiDependencies["syncRepo"] = async (repo) => {
    const tracked = state.repos.get(repo.id);
    if (!tracked) {
      const missingResult: SyncResult = {
        status: "failed",
        upstreamSha: null,
        forkSha: null,
        message: "Repository not found in in-memory state",
      };
      return missingResult;
    }

    if (state.syncMode === "synced") {
      tracked.sync_conflict = false;
      tracked.sync_enabled = true;
      tracked.last_synced_at = now();
      tracked.last_sync_status = "synced";
      tracked.last_sync_message = "Fork synchronized";
      state.repos.set(tracked.id, cloneRepo(tracked));
      const result: SyncResult = {
        status: "synced",
        upstreamSha: "upstream-sha-1",
        forkSha: "fork-sha-1",
        message: "Fork synchronized",
      };
      return result;
    }

    if (state.syncMode === "conflict") {
      tracked.sync_enabled = false;
      tracked.sync_conflict = true;
      tracked.last_sync_status = "conflict";
      tracked.last_sync_message = "Fork has conflicts with upstream; manual resolution required.";
      state.repos.set(tracked.id, cloneRepo(tracked));
      const result: SyncResult = {
        status: "conflict",
        upstreamSha: null,
        forkSha: null,
        message: "Fork has conflicts with upstream; manual resolution required.",
      };
      return result;
    }

    tracked.last_sync_status = "failed";
    tracked.last_sync_message = "Unknown sync error";
    state.repos.set(tracked.id, cloneRepo(tracked));
    const result: SyncResult = {
      status: "failed",
      upstreamSha: null,
      forkSha: null,
      message: "Unknown sync error",
    };
    return result;
  };

  const deps: StudioApiDependencies = {
    config,
    db,
    githubAuthService,
    githubRepoService,
    turnstileService,
    syncRepo,
    validateRepoContent,
    requireSession: async (request, reply) => {
      const sessionId = request.cookies[SESSION_COOKIE_NAME];
      if (!sessionId) {
        reply.code(401).send({ message: "Authentication required" });
        return;
      }

      const session = await db.getSession(sessionId);
      if (!session) {
        reply.code(401).send({ message: "Session is invalid" });
        return;
      }

      if (session.expires_at.getTime() <= Date.now()) {
        await db.deleteSession(sessionId);
        reply.code(401).send({ message: "Session expired" });
        return;
      }

      const currentUser = await db.getUserById(session.user_id);
      if (!currentUser) {
        reply.code(401).send({ message: "User not found" });
        return;
      }

      request.sessionUser = {
        id: currentUser.id,
        githubUserId: currentUser.github_user_id,
        githubLogin: currentUser.github_login,
        githubName: currentUser.github_name,
        avatarUrl: currentUser.avatar_url,
      };
    },
  };

  return { deps, state };
};
