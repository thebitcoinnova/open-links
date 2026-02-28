import { Buffer } from "node:buffer";
import { Octokit } from "@octokit/rest";
import type { CommitResult, RepoContentPayload, SyncResult } from "@openlinks/studio-shared";

const OPENLINKS_FILES = {
  profile: "data/profile.json",
  links: "data/links.json",
  site: "data/site.json",
} as const;

export interface ProvisionedFork {
  owner: string;
  name: string;
  defaultBranch: string;
  visibility: "public" | "private";
}

export interface DeployStatus {
  ci: string;
  deploy: string;
  pagesUrl: string | null;
}

const octokitFor = (accessToken: string): Octokit => new Octokit({ auth: accessToken });

const decodeFileContent = (content: string): string =>
  Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");

const toEncodedJson = (value: unknown): string =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8").toString("base64");

export class GitHubRepoService {
  async createFork(input: {
    accessToken: string;
    upstreamOwner: string;
    upstreamRepo: string;
    defaultBranchOnly?: boolean;
  }): Promise<ProvisionedFork> {
    const octokit = octokitFor(input.accessToken);
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/forks", {
      owner: input.upstreamOwner,
      repo: input.upstreamRepo,
      default_branch_only: input.defaultBranchOnly ?? false,
    });

    return {
      owner: data.owner.login,
      name: data.name,
      defaultBranch: data.default_branch,
      visibility: data.private ? "private" : "public",
    };
  }

  async getOpenLinksContent(input: {
    accessToken: string;
    owner: string;
    repo: string;
  }): Promise<RepoContentPayload> {
    const octokit = octokitFor(input.accessToken);

    const readFile = async (path: string) => {
      const { data } = await octokit.repos.getContent({
        owner: input.owner,
        repo: input.repo,
        path,
      });

      if (Array.isArray(data) || data.type !== "file" || !data.content) {
        throw new Error(`Expected file content at ${path}`);
      }

      return {
        sha: data.sha,
        json: JSON.parse(decodeFileContent(data.content)) as Record<string, unknown>,
      };
    };

    const [profile, links, site] = await Promise.all([
      readFile(OPENLINKS_FILES.profile),
      readFile(OPENLINKS_FILES.links),
      readFile(OPENLINKS_FILES.site),
    ]);

    return {
      profile: profile.json,
      links: links.json,
      site: site.json,
      sha: {
        profile: profile.sha,
        links: links.sha,
        site: site.sha,
      },
    };
  }

  async commitOpenLinksContent(input: {
    accessToken: string;
    owner: string;
    repo: string;
    branch: string;
    payload: RepoContentPayload;
    messagePrefix?: string;
  }): Promise<CommitResult> {
    const octokit = octokitFor(input.accessToken);
    const commits: CommitResult["commits"] = [];

    const updateFile = async (
      path: keyof typeof OPENLINKS_FILES,
      content: unknown,
      sha?: string,
    ) => {
      const filePath = OPENLINKS_FILES[path];
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: input.owner,
        repo: input.repo,
        path: filePath,
        message: `${input.messagePrefix ?? "chore(studio)"}: update ${path}`,
        content: toEncodedJson(content),
        branch: input.branch,
        sha,
      });

      const nextSha = response.data.content?.sha;
      if (!nextSha) {
        throw new Error(`GitHub did not return updated SHA for ${filePath}`);
      }

      commits.push({
        filePath,
        sha: nextSha,
      });
    };

    await updateFile("profile", input.payload.profile, input.payload.sha.profile);
    await updateFile("links", input.payload.links, input.payload.sha.links);
    await updateFile("site", input.payload.site, input.payload.sha.site);

    const deployStatus = await this.getDeployStatus({
      accessToken: input.accessToken,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
    });

    return {
      success: true,
      commits,
      deployStatus,
    };
  }

  async getDeployStatus(input: {
    accessToken: string;
    owner: string;
    repo: string;
    branch: string;
  }): Promise<DeployStatus> {
    const octokit = octokitFor(input.accessToken);

    const [ciRuns, deployRuns, pagesResult] = await Promise.all([
      octokit.actions.listWorkflowRuns({
        owner: input.owner,
        repo: input.repo,
        workflow_id: "ci.yml",
        branch: input.branch,
        per_page: 1,
      }),
      octokit.actions.listWorkflowRuns({
        owner: input.owner,
        repo: input.repo,
        workflow_id: "deploy-pages.yml",
        branch: input.branch,
        per_page: 1,
      }),
      octokit.repos
        .getPages({ owner: input.owner, repo: input.repo })
        .then((res) => ({ ok: true as const, data: res.data }))
        .catch(() => ({ ok: false as const, data: null })),
    ]);

    const ci =
      ciRuns.data.workflow_runs[0]?.conclusion ?? ciRuns.data.workflow_runs[0]?.status ?? "unknown";
    const deploy =
      deployRuns.data.workflow_runs[0]?.conclusion ??
      deployRuns.data.workflow_runs[0]?.status ??
      "unknown";

    return {
      ci,
      deploy,
      pagesUrl: pagesResult.ok ? (pagesResult.data.html_url ?? null) : null,
    };
  }

  async syncFork(input: {
    accessToken: string;
    owner: string;
    repo: string;
    branch: string;
  }): Promise<SyncResult> {
    const octokit = octokitFor(input.accessToken);

    try {
      const { data } = await octokit.request("POST /repos/{owner}/{repo}/merge-upstream", {
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
      });
      const mergeCommitSha =
        typeof data === "object" &&
        data !== null &&
        "merge_commit_sha" in data &&
        typeof (data as { merge_commit_sha?: unknown }).merge_commit_sha === "string"
          ? ((data as { merge_commit_sha: string }).merge_commit_sha ?? null)
          : null;
      const message =
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "Fork synchronized";

      return {
        status: "synced",
        upstreamSha: mergeCommitSha,
        forkSha: mergeCommitSha,
        message,
      };
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number((error as { status?: number }).status)
          : null;

      if (status === 409) {
        return {
          status: "conflict",
          upstreamSha: null,
          forkSha: null,
          message: "Fork has conflicts with upstream; manual resolution required.",
        };
      }

      return {
        status: "failed",
        upstreamSha: null,
        forkSha: null,
        message: error instanceof Error ? error.message : "Unknown sync error",
      };
    }
  }
}

export const githubRepoService = new GitHubRepoService();
