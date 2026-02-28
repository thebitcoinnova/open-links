import type {
  CommitResult,
  OnboardingStatus,
  RepoContentPayload,
  SyncResult,
  ValidationResult,
} from "@openlinks/studio-shared";

const API_BASE = import.meta.env.VITE_STUDIO_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new Error(typeof body === "string" ? body : JSON.stringify(body));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  baseUrl: API_BASE,

  async getMe(): Promise<{
    authenticated: true;
    user: { id: string; githubLogin: string; githubName: string | null };
  } | null> {
    try {
      return await request<{
        authenticated: true;
        user: { id: string; githubLogin: string; githubName: string | null };
      }>("/api/v1/auth/me");
    } catch {
      return null;
    }
  },

  getOnboardingStatus(): Promise<OnboardingStatus> {
    return request<OnboardingStatus>("/api/v1/onboarding/status");
  },

  listRepos(): Promise<{
    repos: Array<{ id: string; owner: string; name: string; default_branch: string }>;
  }> {
    return request<{
      repos: Array<{ id: string; owner: string; name: string; default_branch: string }>;
    }>("/api/v1/repos");
  },

  provisionRepo(): Promise<{ repo: { id: string; owner: string; name: string } }> {
    return request<{ repo: { id: string; owner: string; name: string } }>(
      "/api/v1/repos/provision",
      {
        method: "POST",
        body: JSON.stringify({ visibility: "public" }),
      },
    );
  },

  getRepoContent(repoId: string): Promise<RepoContentPayload> {
    return request<RepoContentPayload>(`/api/v1/repos/${repoId}/content`);
  },

  validateRepoContent(repoId: string, payload: RepoContentPayload): Promise<ValidationResult> {
    return request<ValidationResult>(`/api/v1/repos/${repoId}/validate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  saveRepoContent(repoId: string, payload: RepoContentPayload): Promise<CommitResult> {
    return request<CommitResult>(`/api/v1/repos/${repoId}/content`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  getDeployStatus(
    repoId: string,
  ): Promise<{ ci: string; deploy: string; pagesUrl: string | null }> {
    return request<{ ci: string; deploy: string; pagesUrl: string | null }>(
      `/api/v1/repos/${repoId}/deploy-status`,
    );
  },

  syncRepo(repoId: string): Promise<SyncResult> {
    return request<SyncResult>(`/api/v1/repos/${repoId}/sync`, {
      method: "POST",
    });
  },

  getOperations(repoId: string): Promise<{
    operations: Array<{ id: string; operation: string; status: string; created_at: string }>;
  }> {
    return request<{
      operations: Array<{ id: string; operation: string; status: string; created_at: string }>;
    }>(`/api/v1/repos/${repoId}/operations`);
  },
};
