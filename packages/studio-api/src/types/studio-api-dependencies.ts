import type {
  CommitResult,
  RepoContentPayload,
  SyncResult,
  ValidationResult,
} from "@openlinks/studio-shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import type { RepoRecord, UserRecord } from "../services/database.js";
import type { AuthenticatedSessionUser } from "../services/github-auth.js";
import type { DeployStatus, ProvisionedFork } from "../services/github-repo.js";
import type { TurnstileVerificationResult } from "../services/turnstile.js";

export interface SessionRecord {
  id: string;
  user_id: string;
  expires_at: Date;
}

export interface OperationRecord {
  id: string;
  operation: string;
  status: string;
  detail_json: Record<string, unknown>;
  created_at: Date;
}

export interface StudioApiDb {
  createSession(input: { userId: string; expiresAt: Date }): Promise<string>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  deleteSession(sessionId: string): Promise<void>;
  getUserById(userId: string): Promise<UserRecord | null>;
  getLatestRepoForUser(userId: string): Promise<RepoRecord | null>;
  listReposForUser(userId: string): Promise<RepoRecord[]>;
  upsertRepo(input: {
    userId: string;
    owner: string;
    name: string;
    defaultBranch: string;
    visibility: string;
    upstreamOwner: string;
    upstreamName: string;
    syncIntervalHours: number;
  }): Promise<RepoRecord>;
  getRepoByIdForUser(repoId: string, userId: string): Promise<RepoRecord | null>;
  updateRepoSyncState(
    repoId: string,
    input: {
      syncEnabled?: boolean;
      syncConflict?: boolean;
      lastSyncedAt?: Date | null;
      lastSyncStatus?: string | null;
      lastSyncMessage?: string | null;
      pagesUrl?: string | null;
    },
  ): Promise<void>;
  upsertRepoFileSha(repoId: string, filePath: string, fileSha: string): Promise<void>;
  listOperationsForRepo(repoId: string, limit?: number): Promise<OperationRecord[]>;
  logOperation(input: {
    repoId?: string;
    userId?: string;
    operation: string;
    status: "ok" | "error";
    detail: Record<string, unknown>;
  }): Promise<void>;
  getDueReposForSync(now: Date): Promise<RepoRecord[]>;
  disableReposForOwner(owner: string): Promise<void>;
}

export interface StudioGitHubAuthService {
  createAuthorizationUrl(state: string): string;
  exchangeCodeForSession(input: { code: string }): Promise<AuthenticatedSessionUser>;
  getUserToken(userId: string): Promise<string>;
  hasRequiredInstallation(userId: string): Promise<boolean>;
  revokeSession(sessionId: string): Promise<void>;
}

export interface StudioGitHubRepoService {
  createFork(input: {
    accessToken: string;
    upstreamOwner: string;
    upstreamRepo: string;
    defaultBranchOnly?: boolean;
  }): Promise<ProvisionedFork>;
  getOpenLinksContent(input: {
    accessToken: string;
    owner: string;
    repo: string;
  }): Promise<RepoContentPayload>;
  commitOpenLinksContent(input: {
    accessToken: string;
    owner: string;
    repo: string;
    branch: string;
    payload: RepoContentPayload;
    messagePrefix?: string;
  }): Promise<CommitResult>;
  getDeployStatus(input: {
    accessToken: string;
    owner: string;
    repo: string;
    branch: string;
  }): Promise<DeployStatus>;
}

export interface StudioTurnstileService {
  verifyToken(input: {
    token: string;
    remoteIp?: string | null;
  }): Promise<TurnstileVerificationResult>;
}

export type StudioRequireSession = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface StudioApiDependencies {
  config: AppConfig;
  db: StudioApiDb;
  githubAuthService: StudioGitHubAuthService;
  githubRepoService: StudioGitHubRepoService;
  turnstileService: StudioTurnstileService;
  syncRepo: (repo: RepoRecord) => Promise<SyncResult>;
  validateRepoContent: (payload: RepoContentPayload) => Promise<ValidationResult>;
  requireSession: StudioRequireSession;
}
