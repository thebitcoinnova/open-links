import { Buffer } from "node:buffer";
import { Octokit } from "@octokit/rest";
import type { CommitResult, RepoContentPayload, SyncResult } from "@openlinks/studio-shared";
import {
  type ForkSyncTreeEntry,
  type ForkSyncTreeMode,
  type ForkSyncTreeType,
  buildForkOwnedPreservationTree,
  describeSharedForkSyncConflicts,
  summarizeForkSyncConflicts,
} from "./fork-sync.js";

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

interface BranchHeadSnapshot {
  commitSha: string;
  treeSha: string;
}

const normalizeRepositoryHomepage = (homepageUrl: string | null | undefined): string | null => {
  if (typeof homepageUrl !== "string") {
    return null;
  }

  const trimmed = homepageUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const octokitFor = (accessToken: string): Octokit => new Octokit({ auth: accessToken });

const decodeFileContent = (content: string): string =>
  Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");

const toEncodedJson = (value: unknown): string =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8").toString("base64");

const listChangedPathsFromCompare = (compareData: unknown): string[] => {
  if (typeof compareData !== "object" || compareData === null || !("files" in compareData)) {
    return [];
  }

  const files = compareData.files;
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .flatMap((file) =>
      typeof file === "object" &&
      file !== null &&
      "filename" in file &&
      typeof file.filename === "string"
        ? [file.filename]
        : [],
    )
    .sort();
};

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

  async updateRepositoryMetadata(input: {
    accessToken: string;
    owner: string;
    repo: string;
    homepageUrl?: string | null;
    description?: string | null;
  }): Promise<void> {
    const octokit = octokitFor(input.accessToken);
    const homepage = normalizeRepositoryHomepage(input.homepageUrl);

    await octokit.repos.update({
      owner: input.owner,
      repo: input.repo,
      description: input.description ?? undefined,
      homepage: homepage ?? "",
    });
  }

  async getRepositoryMetadata(input: {
    accessToken: string;
    owner: string;
    repo: string;
  }): Promise<{
    description: string | null;
    homepageUrl: string | null;
  }> {
    const octokit = octokitFor(input.accessToken);
    const { data } = await octokit.repos.get({
      owner: input.owner,
      repo: input.repo,
    });

    return {
      description: data.description ?? null,
      homepageUrl: normalizeRepositoryHomepage(data.homepage),
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
    upstreamOwner: string;
    upstreamRepo: string;
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
        return this.syncForkPreservingForkOwnedPaths({ ...input, octokit });
      }

      return {
        status: "failed",
        upstreamSha: null,
        forkSha: null,
        message: error instanceof Error ? error.message : "Unknown sync error",
      };
    }
  }

  private async getBranchHeadSnapshot(input: {
    octokit: Octokit;
    owner: string;
    repo: string;
    branch: string;
  }): Promise<BranchHeadSnapshot> {
    const branchResponse = await input.octokit.repos.getBranch({
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
    });
    const commitSha = branchResponse.data.commit.sha;
    const commitResponse = await input.octokit.git.getCommit({
      owner: input.owner,
      repo: input.repo,
      commit_sha: commitSha,
    });

    return {
      commitSha,
      treeSha: commitResponse.data.tree.sha,
    };
  }

  private async getRecursiveTree(input: {
    octokit: Octokit;
    owner: string;
    repo: string;
    treeSha: string;
  }): Promise<ForkSyncTreeEntry[]> {
    const response = await input.octokit.git.getTree({
      owner: input.owner,
      repo: input.repo,
      tree_sha: input.treeSha,
      recursive: "1",
    });

    return response.data.tree.flatMap((entry) => {
      if (!entry.path || !entry.mode || !entry.type) {
        return [];
      }

      return [
        {
          mode: entry.mode as ForkSyncTreeMode,
          path: entry.path,
          sha: entry.sha ?? null,
          type: entry.type as ForkSyncTreeType,
        },
      ];
    });
  }

  private async syncForkPreservingForkOwnedPaths(input: {
    accessToken: string;
    owner: string;
    repo: string;
    branch: string;
    upstreamOwner: string;
    upstreamRepo: string;
    octokit: Octokit;
  }): Promise<SyncResult> {
    const upstreamRepoResponse = await input.octokit.repos.get({
      owner: input.upstreamOwner,
      repo: input.upstreamRepo,
    });
    const upstreamBranch = upstreamRepoResponse.data.default_branch;

    const networkCompare = await input.octokit.request(
      "GET /repos/{owner}/{repo}/compare/{basehead}",
      {
        owner: input.upstreamOwner,
        repo: input.upstreamRepo,
        basehead: `${upstreamBranch}...${input.owner}:${input.branch}`,
      },
    );

    const mergeBaseSha =
      typeof networkCompare.data === "object" &&
      networkCompare.data !== null &&
      "merge_base_commit" in networkCompare.data &&
      typeof networkCompare.data.merge_base_commit === "object" &&
      networkCompare.data.merge_base_commit !== null &&
      "sha" in networkCompare.data.merge_base_commit &&
      typeof networkCompare.data.merge_base_commit.sha === "string"
        ? networkCompare.data.merge_base_commit.sha
        : null;

    if (!mergeBaseSha) {
      return {
        status: "conflict",
        upstreamSha: null,
        forkSha: null,
        message: "Fork has conflicts with upstream; manual resolution required.",
      };
    }

    const [upstreamChanged, forkChanged, upstreamHead, forkHead] = await Promise.all([
      input.octokit.request("GET /repos/{owner}/{repo}/compare/{basehead}", {
        owner: input.upstreamOwner,
        repo: input.upstreamRepo,
        basehead: `${mergeBaseSha}...${upstreamBranch}`,
      }),
      input.octokit.request("GET /repos/{owner}/{repo}/compare/{basehead}", {
        owner: input.upstreamOwner,
        repo: input.upstreamRepo,
        basehead: `${mergeBaseSha}...${input.owner}:${input.branch}`,
      }),
      this.getBranchHeadSnapshot({
        octokit: input.octokit,
        owner: input.upstreamOwner,
        repo: input.upstreamRepo,
        branch: upstreamBranch,
      }),
      this.getBranchHeadSnapshot({
        octokit: input.octokit,
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
      }),
    ]);

    const conflictSummary = summarizeForkSyncConflicts({
      forkChangedPaths: listChangedPathsFromCompare(forkChanged.data),
      upstreamChangedPaths: listChangedPathsFromCompare(upstreamChanged.data),
    });

    if (conflictSummary.sharedConflicts.length > 0) {
      return {
        status: "conflict",
        upstreamSha: upstreamHead.commitSha,
        forkSha: forkHead.commitSha,
        message: describeSharedForkSyncConflicts(conflictSummary.sharedConflicts),
      };
    }

    const [upstreamTree, forkTree] = await Promise.all([
      this.getRecursiveTree({
        octokit: input.octokit,
        owner: input.upstreamOwner,
        repo: input.upstreamRepo,
        treeSha: upstreamHead.treeSha,
      }),
      this.getRecursiveTree({
        octokit: input.octokit,
        owner: input.owner,
        repo: input.repo,
        treeSha: forkHead.treeSha,
      }),
    ]);

    const tree = buildForkOwnedPreservationTree({
      forkTree,
      upstreamTree,
    }).map((entry) => ({
      mode: entry.mode,
      path: entry.path,
      sha: entry.sha,
      type: entry.type,
    }));

    const createdTree = await input.octokit.git.createTree({
      owner: input.owner,
      repo: input.repo,
      base_tree: upstreamHead.treeSha,
      tree,
    });

    const createdCommit = await input.octokit.git.createCommit({
      owner: input.owner,
      repo: input.repo,
      message: "chore(studio): sync upstream while preserving fork-owned paths",
      tree: createdTree.data.sha,
      parents: [forkHead.commitSha, upstreamHead.commitSha],
    });

    await input.octokit.git.updateRef({
      owner: input.owner,
      repo: input.repo,
      ref: `heads/${input.branch}`,
      sha: createdCommit.data.sha,
    });

    return {
      status: "synced",
      upstreamSha: upstreamHead.commitSha,
      forkSha: createdCommit.data.sha,
      message: "Fork synchronized while preserving fork-owned paths.",
    };
  }
}

export const githubRepoService = new GitHubRepoService();
