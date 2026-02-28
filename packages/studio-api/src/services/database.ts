import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { newId } from "../lib/ids.js";

export interface UserRecord {
  id: string;
  github_user_id: number;
  github_login: string;
  github_name: string | null;
  avatar_url: string | null;
}

export interface TokenRecord {
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  access_expires_at: Date | null;
  refresh_expires_at: Date | null;
  token_type: string | null;
  scope: string | null;
}

export interface RepoRecord {
  id: string;
  user_id: string;
  owner: string;
  name: string;
  default_branch: string;
  visibility: string;
  upstream_owner: string;
  upstream_name: string;
  pages_url: string | null;
  sync_enabled: boolean;
  sync_interval_hours: number;
  sync_conflict: boolean;
  last_synced_at: Date | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
}

export interface DueRepoRow extends RepoRecord {
  github_user_id: number;
}

const withClient = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

export const db = {
  async upsertUser(input: {
    githubUserId: number;
    githubLogin: string;
    githubName?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserRecord> {
    const existing = await pool.query<UserRecord>("SELECT * FROM users WHERE github_user_id = $1", [
      input.githubUserId,
    ]);

    if (existing.rowCount && existing.rowCount > 0) {
      const id = existing.rows[0].id;
      const updated = await pool.query<UserRecord>(
        `UPDATE users
         SET github_login = $2,
             github_name = $3,
             avatar_url = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, input.githubLogin, input.githubName ?? null, input.avatarUrl ?? null],
      );
      return updated.rows[0];
    }

    const inserted = await pool.query<UserRecord>(
      `INSERT INTO users (id, github_user_id, github_login, github_name, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        newId(),
        input.githubUserId,
        input.githubLogin,
        input.githubName ?? null,
        input.avatarUrl ?? null,
      ],
    );
    return inserted.rows[0];
  },

  async saveToken(input: {
    userId: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    accessExpiresAt?: Date | null;
    refreshExpiresAt?: Date | null;
    tokenType?: string | null;
    scope?: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO github_tokens (
         user_id,
         access_token_encrypted,
         refresh_token_encrypted,
         access_expires_at,
         refresh_expires_at,
         token_type,
         scope,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         access_expires_at = EXCLUDED.access_expires_at,
         refresh_expires_at = EXCLUDED.refresh_expires_at,
         token_type = EXCLUDED.token_type,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [
        input.userId,
        input.accessTokenEncrypted,
        input.refreshTokenEncrypted ?? null,
        input.accessExpiresAt ?? null,
        input.refreshExpiresAt ?? null,
        input.tokenType ?? null,
        input.scope ?? null,
      ],
    );
  },

  async getTokenByUserId(userId: string): Promise<TokenRecord | null> {
    const result = await pool.query<TokenRecord>("SELECT * FROM github_tokens WHERE user_id = $1", [
      userId,
    ]);
    return result.rows[0] ?? null;
  },

  async createSession(input: { userId: string; expiresAt: Date }): Promise<string> {
    const id = newId();
    await pool.query("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
      id,
      input.userId,
      input.expiresAt,
    ]);
    return id;
  },

  async getSession(
    sessionId: string,
  ): Promise<{ id: string; user_id: string; expires_at: Date } | null> {
    const result = await pool.query<{ id: string; user_id: string; expires_at: Date }>(
      "SELECT id, user_id, expires_at FROM auth_sessions WHERE id = $1",
      [sessionId],
    );
    return result.rows[0] ?? null;
  },

  async deleteSession(sessionId: string): Promise<void> {
    await pool.query("DELETE FROM auth_sessions WHERE id = $1", [sessionId]);
  },

  async getUserById(userId: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRecord>("SELECT * FROM users WHERE id = $1", [userId]);
    return result.rows[0] ?? null;
  },

  async getUserByGithubId(githubUserId: number): Promise<UserRecord | null> {
    const result = await pool.query<UserRecord>("SELECT * FROM users WHERE github_user_id = $1", [
      githubUserId,
    ]);
    return result.rows[0] ?? null;
  },

  async upsertRepo(input: {
    userId: string;
    owner: string;
    name: string;
    defaultBranch: string;
    visibility: string;
    upstreamOwner: string;
    upstreamName: string;
    syncIntervalHours: number;
  }): Promise<RepoRecord> {
    const existing = await pool.query<RepoRecord>(
      "SELECT * FROM repos WHERE user_id = $1 AND owner = $2 AND name = $3",
      [input.userId, input.owner, input.name],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const updated = await pool.query<RepoRecord>(
        `UPDATE repos
         SET default_branch = $4,
             visibility = $5,
             upstream_owner = $6,
             upstream_name = $7,
             sync_interval_hours = $8,
             updated_at = NOW()
         WHERE user_id = $1 AND owner = $2 AND name = $3
         RETURNING *`,
        [
          input.userId,
          input.owner,
          input.name,
          input.defaultBranch,
          input.visibility,
          input.upstreamOwner,
          input.upstreamName,
          input.syncIntervalHours,
        ],
      );
      return updated.rows[0];
    }

    const inserted = await pool.query<RepoRecord>(
      `INSERT INTO repos (
         id,
         user_id,
         owner,
         name,
         default_branch,
         visibility,
         upstream_owner,
         upstream_name,
         sync_interval_hours
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        newId(),
        input.userId,
        input.owner,
        input.name,
        input.defaultBranch,
        input.visibility,
        input.upstreamOwner,
        input.upstreamName,
        input.syncIntervalHours,
      ],
    );
    return inserted.rows[0];
  },

  async getRepoById(repoId: string): Promise<RepoRecord | null> {
    const result = await pool.query<RepoRecord>("SELECT * FROM repos WHERE id = $1", [repoId]);
    return result.rows[0] ?? null;
  },

  async getRepoByIdForUser(repoId: string, userId: string): Promise<RepoRecord | null> {
    const result = await pool.query<RepoRecord>(
      "SELECT * FROM repos WHERE id = $1 AND user_id = $2",
      [repoId, userId],
    );
    return result.rows[0] ?? null;
  },

  async getLatestRepoForUser(userId: string): Promise<RepoRecord | null> {
    const result = await pool.query<RepoRecord>(
      "SELECT * FROM repos WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    return result.rows[0] ?? null;
  },

  async listReposForUser(userId: string): Promise<RepoRecord[]> {
    const result = await pool.query<RepoRecord>(
      "SELECT * FROM repos WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return result.rows;
  },

  async updateRepoSyncState(
    repoId: string,
    input: {
      syncEnabled?: boolean;
      syncConflict?: boolean;
      lastSyncedAt?: Date | null;
      lastSyncStatus?: string | null;
      lastSyncMessage?: string | null;
      pagesUrl?: string | null;
    },
  ): Promise<void> {
    await pool.query(
      `UPDATE repos
       SET sync_enabled = COALESCE($2, sync_enabled),
           sync_conflict = COALESCE($3, sync_conflict),
           last_synced_at = COALESCE($4, last_synced_at),
           last_sync_status = COALESCE($5, last_sync_status),
           last_sync_message = COALESCE($6, last_sync_message),
           pages_url = COALESCE($7, pages_url),
           updated_at = NOW()
       WHERE id = $1`,
      [
        repoId,
        input.syncEnabled ?? null,
        input.syncConflict ?? null,
        input.lastSyncedAt ?? null,
        input.lastSyncStatus ?? null,
        input.lastSyncMessage ?? null,
        input.pagesUrl ?? null,
      ],
    );
  },

  async upsertRepoFileSha(repoId: string, filePath: string, fileSha: string): Promise<void> {
    await pool.query(
      `INSERT INTO repo_files_state (repo_id, file_path, file_sha, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (repo_id, file_path)
       DO UPDATE SET file_sha = EXCLUDED.file_sha, updated_at = NOW()`,
      [repoId, filePath, fileSha],
    );
  },

  async getRepoFileShas(repoId: string): Promise<Record<string, string>> {
    const result = await pool.query<{ file_path: string; file_sha: string }>(
      "SELECT file_path, file_sha FROM repo_files_state WHERE repo_id = $1",
      [repoId],
    );

    const out: Record<string, string> = {};
    for (const row of result.rows) {
      out[row.file_path] = row.file_sha;
    }
    return out;
  },

  async logOperation(input: {
    repoId?: string;
    userId?: string;
    operation: string;
    status: "ok" | "error";
    detail: Record<string, unknown>;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO repo_operations (id, repo_id, user_id, operation, status, detail_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        newId(),
        input.repoId ?? null,
        input.userId ?? null,
        input.operation,
        input.status,
        JSON.stringify(input.detail),
      ],
    );
  },

  async createSyncJob(input: {
    repoId: string;
    status: "synced" | "conflict" | "failed";
    message: string;
    upstreamSha?: string | null;
    forkSha?: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO sync_jobs (id, repo_id, status, message, upstream_sha, fork_sha)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        newId(),
        input.repoId,
        input.status,
        input.message,
        input.upstreamSha ?? null,
        input.forkSha ?? null,
      ],
    );
  },

  async listOperationsForRepo(
    repoId: string,
    limit = 20,
  ): Promise<
    Array<{
      id: string;
      operation: string;
      status: string;
      detail_json: Record<string, unknown>;
      created_at: Date;
    }>
  > {
    const result = await pool.query<{
      id: string;
      operation: string;
      status: string;
      detail_json: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT id, operation, status, detail_json, created_at
       FROM repo_operations
       WHERE repo_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [repoId, limit],
    );
    return result.rows;
  },

  async getDueReposForSync(now: Date): Promise<DueRepoRow[]> {
    const result = await pool.query<DueRepoRow>(
      `SELECT r.*, u.github_user_id
       FROM repos r
       INNER JOIN users u ON u.id = r.user_id
       WHERE r.sync_enabled = TRUE
         AND r.sync_conflict = FALSE
         AND (r.last_synced_at IS NULL OR r.last_synced_at <= ($1::timestamptz - (r.sync_interval_hours || ' hours')::interval))`,
      [now.toISOString()],
    );
    return result.rows;
  },

  async disableReposForOwner(owner: string): Promise<void> {
    await pool.query(
      `UPDATE repos
       SET sync_enabled = FALSE,
           last_sync_status = 'app_uninstalled',
           last_sync_message = 'GitHub App installation removed or suspended',
           updated_at = NOW()
       WHERE lower(owner) = lower($1)`,
      [owner],
    );
  },

  async cleanupExpiredSessions(): Promise<void> {
    await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
  },

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const out = await fn(client);
        await client.query("COMMIT");
        return out;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  },
};
