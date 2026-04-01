import { classifyForkOwnedPaths, isForkOwnedPath } from "../../src/lib/fork-owned-paths";
import {
  describeSharedForkSyncConflicts,
  summarizeForkSyncConflicts,
} from "../../src/lib/fork-sync";
import { runCommand } from "./command";
import { parseGitHubRepositorySlug } from "./github-repository";

const DEFAULT_BRANCH = "main";
const DEFAULT_REMOTE = "upstream";
const AUTO_RESOLVE_COMMIT_MESSAGE = "chore: sync upstream while preserving fork-owned paths";

export type UpstreamSyncStatus = "up_to_date" | "fast_forwarded" | "merged" | "conflict" | "failed";

export interface UpstreamSyncOptions {
  branch?: string;
  cwd?: string;
  remote?: string;
}

export interface UpstreamSyncResult {
  branchChanged: boolean;
  conflictingPaths: string[];
  forkOwnedConflicts: string[];
  headAfter: string;
  headBefore: string;
  mergeCommitCreated: boolean;
  message: string;
  remote: string;
  sharedConflicts: string[];
  status: UpstreamSyncStatus;
  targetBranch: string;
  upstreamBranch: string;
  upstreamHead: string;
  upstreamRef: string;
}

const resolveRootDir = (cwd?: string) => cwd ?? process.cwd();

const trimStdout = (value: string) => value.trim();

const git = (cwd: string, args: string[], options: { allowFailure?: boolean } = {}) =>
  runCommand("git", args, { allowFailure: options.allowFailure, cwd });

const pathExistsInHead = (cwd: string, repoPath: string): boolean =>
  git(cwd, ["cat-file", "-e", `HEAD:${repoPath}`], { allowFailure: true }).status === 0;

const listChangedPaths = (cwd: string, baseRef: string, headRef: string): string[] =>
  trimStdout(git(cwd, ["diff", "--name-only", `${baseRef}..${headRef}`]).stdout)
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();

const listUnmergedPaths = (cwd: string): string[] =>
  trimStdout(git(cwd, ["diff", "--name-only", "--diff-filter=U"]).stdout)
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();

const hasPendingMerge = (cwd: string): boolean => {
  const gitPath = trimStdout(git(cwd, ["rev-parse", "--git-path", "MERGE_HEAD"]).stdout);
  return (
    gitPath.length > 0 &&
    git(cwd, ["rev-parse", "-q", "--verify", "MERGE_HEAD"], { allowFailure: true }).status === 0
  );
};

const abortMerge = (cwd: string) => {
  if (hasPendingMerge(cwd)) {
    git(cwd, ["merge", "--abort"], { allowFailure: true });
  }
};

const ensureCleanWorktree = (cwd: string) => {
  const status = trimStdout(git(cwd, ["status", "--porcelain"]).stdout);
  if (status.length > 0) {
    throw new Error("Cannot sync upstream with a dirty worktree. Commit or stash changes first.");
  }
};

const resolveTargetBranch = (cwd: string): string => {
  const branch = trimStdout(git(cwd, ["branch", "--show-current"]).stdout);
  if (branch.length === 0) {
    throw new Error("Cannot sync upstream from a detached HEAD. Check out a branch first.");
  }
  return branch;
};

const resolveHeadSha = (cwd: string, ref = "HEAD"): string =>
  trimStdout(git(cwd, ["rev-parse", ref]).stdout);

const remoteExists = (cwd: string, remote: string): boolean =>
  git(cwd, ["remote", "get-url", remote], { allowFailure: true }).status === 0;

const normalizeRemoteIdentity = (cwd: string, remote: string): string | undefined => {
  const remoteUrl = trimStdout(git(cwd, ["remote", "get-url", remote]).stdout);
  if (remoteUrl.length === 0) {
    return undefined;
  }

  try {
    return `github:${parseGitHubRepositorySlug(remoteUrl).toLowerCase()}`;
  } catch {
    return remoteUrl
      .replace(/\.git$/u, "")
      .replace(/\/+$/u, "")
      .toLowerCase();
  }
};

const refExists = (cwd: string, ref: string): boolean =>
  git(cwd, ["rev-parse", "--verify", ref], { allowFailure: true }).status === 0;

const isAncestor = (cwd: string, ancestorRef: string, descendantRef: string): boolean =>
  git(cwd, ["merge-base", "--is-ancestor", ancestorRef, descendantRef], { allowFailure: true })
    .status === 0;

const resolveConflictResult = (cwd: string, upstreamRef: string, headBefore: string) => {
  const mergeBase = trimStdout(git(cwd, ["merge-base", headBefore, upstreamRef]).stdout);
  const conflictSummary = summarizeForkSyncConflicts({
    forkChangedPaths: listChangedPaths(cwd, mergeBase, headBefore),
    upstreamChangedPaths: listChangedPaths(cwd, mergeBase, upstreamRef),
  });
  const unmergedPaths = listUnmergedPaths(cwd);
  const unmergedSummary = classifyForkOwnedPaths(unmergedPaths);

  if (unmergedSummary.sharedPaths.length > 0 || conflictSummary.sharedConflicts.length > 0) {
    const sharedConflicts = Array.from(
      new Set([...unmergedSummary.sharedPaths, ...conflictSummary.sharedConflicts]),
    ).sort();

    abortMerge(cwd);
    return {
      conflictingPaths: conflictSummary.conflictingPaths,
      forkOwnedConflicts: conflictSummary.forkOwnedConflicts,
      message: describeSharedForkSyncConflicts(sharedConflicts),
      sharedConflicts,
      status: "conflict" as const,
      unmergedPaths,
    };
  }

  for (const repoPath of unmergedPaths) {
    if (!isForkOwnedPath(repoPath)) {
      abortMerge(cwd);
      return {
        conflictingPaths: conflictSummary.conflictingPaths,
        forkOwnedConflicts: conflictSummary.forkOwnedConflicts,
        message: describeSharedForkSyncConflicts([repoPath]),
        sharedConflicts: [repoPath],
        status: "conflict" as const,
        unmergedPaths,
      };
    }

    if (pathExistsInHead(cwd, repoPath)) {
      git(cwd, ["checkout", "--ours", "--", repoPath]);
      git(cwd, ["add", "--", repoPath]);
      continue;
    }

    git(cwd, ["rm", "--", repoPath]);
  }

  git(cwd, ["commit", "-m", AUTO_RESOLVE_COMMIT_MESSAGE]);

  return {
    conflictingPaths: conflictSummary.conflictingPaths,
    forkOwnedConflicts: conflictSummary.forkOwnedConflicts,
    message: "Fork synchronized while preserving fork-owned paths.",
    sharedConflicts: [] as string[],
    status: "merged" as const,
    unmergedPaths,
  };
};

export const runUpstreamSync = (options: UpstreamSyncOptions = {}): UpstreamSyncResult => {
  const cwd = resolveRootDir(options.cwd);
  const remote = options.remote ?? DEFAULT_REMOTE;
  const upstreamBranch = options.branch ?? DEFAULT_BRANCH;
  const targetBranch = resolveTargetBranch(cwd);

  ensureCleanWorktree(cwd);

  if (!remoteExists(cwd, remote)) {
    throw new Error(`Git remote '${remote}' is not configured in this repository.`);
  }

  if (remoteExists(cwd, "origin")) {
    const maybeOriginIdentity = normalizeRemoteIdentity(cwd, "origin");
    const maybeUpstreamIdentity = normalizeRemoteIdentity(cwd, remote);
    if (
      maybeOriginIdentity !== undefined &&
      maybeUpstreamIdentity !== undefined &&
      maybeOriginIdentity === maybeUpstreamIdentity
    ) {
      throw new Error(
        `Cannot sync upstream when '${remote}' points to the same repository as 'origin'. This command is intended for forks and downstream repos.`,
      );
    }
  }

  git(cwd, ["fetch", remote, "--prune"]);

  const upstreamRef = `${remote}/${upstreamBranch}`;
  if (!refExists(cwd, upstreamRef)) {
    throw new Error(`Git ref '${upstreamRef}' does not exist after fetch.`);
  }

  const headBefore = resolveHeadSha(cwd);
  const upstreamHead = resolveHeadSha(cwd, upstreamRef);

  if (isAncestor(cwd, upstreamRef, "HEAD")) {
    return {
      branchChanged: false,
      conflictingPaths: [],
      forkOwnedConflicts: [],
      headAfter: headBefore,
      headBefore,
      mergeCommitCreated: false,
      message: `Already up to date with ${upstreamRef}.`,
      remote,
      sharedConflicts: [],
      status: "up_to_date",
      targetBranch,
      upstreamBranch,
      upstreamHead,
      upstreamRef,
    };
  }

  const mergeResult = git(cwd, ["merge", "--no-commit", upstreamRef], { allowFailure: true });
  const headAfterMerge = resolveHeadSha(cwd);

  if (mergeResult.status === 0) {
    if (hasPendingMerge(cwd)) {
      git(cwd, ["commit", "-m", `chore: sync ${upstreamRef}`]);
      const headAfter = resolveHeadSha(cwd);
      return {
        branchChanged: headAfter !== headBefore,
        conflictingPaths: [],
        forkOwnedConflicts: [],
        headAfter,
        headBefore,
        mergeCommitCreated: true,
        message: `Synchronized ${targetBranch} with ${upstreamRef}.`,
        remote,
        sharedConflicts: [],
        status: "merged",
        targetBranch,
        upstreamBranch,
        upstreamHead,
        upstreamRef,
      };
    }

    return {
      branchChanged: headAfterMerge !== headBefore,
      conflictingPaths: [],
      forkOwnedConflicts: [],
      headAfter: headAfterMerge,
      headBefore,
      mergeCommitCreated: false,
      message: `Fast-forwarded ${targetBranch} to ${upstreamRef}.`,
      remote,
      sharedConflicts: [],
      status: "fast_forwarded",
      targetBranch,
      upstreamBranch,
      upstreamHead,
      upstreamRef,
    };
  }

  const unmergedPaths = listUnmergedPaths(cwd);
  if (unmergedPaths.length === 0) {
    abortMerge(cwd);
    return {
      branchChanged: false,
      conflictingPaths: [],
      forkOwnedConflicts: [],
      headAfter: headBefore,
      headBefore,
      mergeCommitCreated: false,
      message: mergeResult.stderr.trim() || mergeResult.stdout.trim() || "Upstream sync failed.",
      remote,
      sharedConflicts: [],
      status: "failed",
      targetBranch,
      upstreamBranch,
      upstreamHead,
      upstreamRef,
    };
  }

  const conflictResult = resolveConflictResult(cwd, upstreamRef, headBefore);
  const headAfter = resolveHeadSha(cwd);

  return {
    branchChanged: headAfter !== headBefore,
    conflictingPaths: conflictResult.conflictingPaths,
    forkOwnedConflicts: conflictResult.forkOwnedConflicts,
    headAfter,
    headBefore,
    mergeCommitCreated: conflictResult.status === "merged",
    message: conflictResult.message,
    remote,
    sharedConflicts: conflictResult.sharedConflicts,
    status: conflictResult.status,
    targetBranch,
    upstreamBranch,
    upstreamHead,
    upstreamRef,
  };
};
