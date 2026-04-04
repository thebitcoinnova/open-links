import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "./command";
import { type UpstreamSyncStatus, runUpstreamSync } from "./upstream-sync";

const DEFAULT_PUBLISH_BRANCH = "main";
const DEFAULT_PUBLISH_REMOTE = "origin";
const DEFAULT_TEMP_BRANCH_PREFIX = "codex/sync-main";
const DEFAULT_UPSTREAM_BRANCH = "main";
const DEFAULT_UPSTREAM_REMOTE = "upstream";

export type UpstreamMainPushStatus = "failed" | "not_attempted" | "not_needed" | "pushed";

export interface UpstreamMainSyncOptions {
  cwd?: string;
  onBeforePush?: (() => void) | undefined;
  publishBranch?: string;
  publishRemote?: string;
  maybeTempRoot?: string;
  upstreamBranch?: string;
  upstreamRemote?: string;
}

export interface UpstreamMainSyncResult {
  afterSha?: string;
  baseRef: string;
  beforeSha?: string;
  branchChanged: boolean;
  conflictingPaths: string[];
  forkOwnedConflicts: string[];
  mergeCommitCreated: boolean;
  message: string;
  publishBranch: string;
  publishRemote: string;
  pushStatus: UpstreamMainPushStatus;
  pushed: boolean;
  sharedConflicts: string[];
  status: UpstreamSyncStatus;
  targetBranch: string;
  upstreamBranch: string;
  upstreamHead?: string;
  upstreamRef: string;
}

const trimStdout = (value: string) => value.trim();

const git = (cwd: string, args: string[], options: { allowFailure?: boolean } = {}) =>
  runCommand("git", args, { allowFailure: options.allowFailure, cwd });

const resolveRootDir = (cwd?: string) => cwd ?? process.cwd();

const refExists = (cwd: string, ref: string): boolean =>
  git(cwd, ["rev-parse", "--verify", ref], { allowFailure: true }).status === 0;

const remoteExists = (cwd: string, remote: string): boolean =>
  git(cwd, ["remote", "get-url", remote], { allowFailure: true }).status === 0;

const resolveRefSha = (cwd: string, ref: string): string =>
  trimStdout(git(cwd, ["rev-parse", ref]).stdout);

const isAncestor = (cwd: string, ancestorRef: string, descendantRef: string): boolean =>
  git(cwd, ["merge-base", "--is-ancestor", ancestorRef, descendantRef], { allowFailure: true })
    .status === 0;

const renderFailure = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const createTempBranchName = (publishBranch: string) =>
  `${DEFAULT_TEMP_BRANCH_PREFIX}-${publishBranch}-${Date.now()}-${process.pid}`;

const createResult = (
  options: {
    baseRef: string;
    publishBranch: string;
    publishRemote: string;
    upstreamBranch: string;
    upstreamRef: string;
  },
  overrides: Partial<UpstreamMainSyncResult>,
): UpstreamMainSyncResult => ({
  baseRef: options.baseRef,
  branchChanged: false,
  conflictingPaths: [],
  forkOwnedConflicts: [],
  mergeCommitCreated: false,
  message: "",
  publishBranch: options.publishBranch,
  publishRemote: options.publishRemote,
  pushStatus: "not_attempted",
  pushed: false,
  sharedConflicts: [],
  status: "failed",
  targetBranch: options.publishBranch,
  upstreamBranch: options.upstreamBranch,
  upstreamRef: options.upstreamRef,
  ...overrides,
});

const createPushFailureMessage = (
  publishRemote: string,
  publishBranch: string,
  pushFailure: string,
  beforeSha: string,
  maybeCurrentRemoteSha?: string,
) => {
  if (maybeCurrentRemoteSha && maybeCurrentRemoteSha !== beforeSha) {
    return [
      `Push to ${publishRemote}/${publishBranch} failed because the remote branch advanced during publish.`,
      "Fetch the latest remote state and rerun `bun run sync:upstream:main`.",
    ].join(" ");
  }

  return [
    `Push to ${publishRemote}/${publishBranch} failed after the upstream sync completed.`,
    pushFailure,
  ]
    .filter(Boolean)
    .join(" ");
};

const appendCleanupWarning = (
  result: UpstreamMainSyncResult,
  cleanupWarnings: string[],
): UpstreamMainSyncResult => {
  if (cleanupWarnings.length === 0) {
    return result;
  }

  return {
    ...result,
    message: `${result.message} Cleanup warning: ${cleanupWarnings.join(" ")}`.trim(),
  };
};

export const runUpstreamMainSync = (
  options: UpstreamMainSyncOptions = {},
): UpstreamMainSyncResult => {
  const cwd = resolveRootDir(options.cwd);
  const publishBranch = options.publishBranch ?? DEFAULT_PUBLISH_BRANCH;
  const publishRemote = options.publishRemote ?? DEFAULT_PUBLISH_REMOTE;
  const upstreamBranch = options.upstreamBranch ?? DEFAULT_UPSTREAM_BRANCH;
  const upstreamRemote = options.upstreamRemote ?? DEFAULT_UPSTREAM_REMOTE;
  const baseRef = `${publishRemote}/${publishBranch}`;
  const upstreamRef = `${upstreamRemote}/${upstreamBranch}`;
  const tempRootParent = options.maybeTempRoot ?? os.tmpdir();
  const localBranchRef = `refs/heads/${publishBranch}`;

  let maybeTempRoot: string | undefined;
  let maybeTempWorktree: string | undefined;
  let maybeTempBranch: string | undefined;
  let result = createResult(
    {
      baseRef,
      publishBranch,
      publishRemote,
      upstreamBranch,
      upstreamRef,
    },
    {},
  );
  const cleanupWarnings: string[] = [];

  try {
    if (!remoteExists(cwd, publishRemote)) {
      result = createResult(
        {
          baseRef,
          publishBranch,
          publishRemote,
          upstreamBranch,
          upstreamRef,
        },
        {
          message: `Git remote '${publishRemote}' is not configured in this repository.`,
        },
      );
    } else if (!remoteExists(cwd, upstreamRemote)) {
      result = createResult(
        {
          baseRef,
          publishBranch,
          publishRemote,
          upstreamBranch,
          upstreamRef,
        },
        {
          message: `Git remote '${upstreamRemote}' is not configured in this repository.`,
        },
      );
    } else {
      git(cwd, ["fetch", publishRemote, "--prune"]);
      git(cwd, ["fetch", upstreamRemote, "--prune"]);

      if (!refExists(cwd, baseRef)) {
        result = createResult(
          {
            baseRef,
            publishBranch,
            publishRemote,
            upstreamBranch,
            upstreamRef,
          },
          {
            message: `Git ref '${baseRef}' does not exist after fetch.`,
            upstreamHead: refExists(cwd, upstreamRef) ? resolveRefSha(cwd, upstreamRef) : undefined,
          },
        );
      } else if (!refExists(cwd, upstreamRef)) {
        const beforeSha = resolveRefSha(cwd, baseRef);
        result = createResult(
          {
            baseRef,
            publishBranch,
            publishRemote,
            upstreamBranch,
            upstreamRef,
          },
          {
            afterSha: beforeSha,
            beforeSha,
            message: `Git ref '${upstreamRef}' does not exist after fetch.`,
          },
        );
      } else {
        const beforeSha = resolveRefSha(cwd, baseRef);
        const upstreamHead = resolveRefSha(cwd, upstreamRef);

        result = createResult(
          {
            baseRef,
            publishBranch,
            publishRemote,
            upstreamBranch,
            upstreamRef,
          },
          {
            afterSha: beforeSha,
            beforeSha,
            upstreamHead,
          },
        );

        if (refExists(cwd, localBranchRef) && !isAncestor(cwd, localBranchRef, baseRef)) {
          result = {
            ...result,
            message: [
              `Local ${localBranchRef} has commits that are not contained in ${baseRef}.`,
              `Reconcile local ${publishBranch} before publishing a new synced ${publishRemote}/${publishBranch}.`,
            ].join(" "),
          };
        } else {
          maybeTempRoot = fs.mkdtempSync(path.join(tempRootParent, "open-links-sync-main-"));
          maybeTempWorktree = path.join(maybeTempRoot, "worktree");
          maybeTempBranch = createTempBranchName(publishBranch);
          git(cwd, ["worktree", "add", "-b", maybeTempBranch, maybeTempWorktree, beforeSha]);

          const syncResult = runUpstreamSync({
            branch: upstreamBranch,
            cwd: maybeTempWorktree,
            remote: upstreamRemote,
          });

          result = createResult(
            {
              baseRef,
              publishBranch,
              publishRemote,
              upstreamBranch,
              upstreamRef,
            },
            {
              afterSha: syncResult.headAfter,
              beforeSha,
              branchChanged: syncResult.headAfter !== beforeSha,
              conflictingPaths: syncResult.conflictingPaths,
              forkOwnedConflicts: syncResult.forkOwnedConflicts,
              mergeCommitCreated: syncResult.mergeCommitCreated,
              message: syncResult.message,
              sharedConflicts: syncResult.sharedConflicts,
              status: syncResult.status,
              upstreamHead,
            },
          );

          if (syncResult.status !== "conflict" && syncResult.status !== "failed") {
            if (syncResult.headAfter === beforeSha) {
              result = {
                ...result,
                pushStatus: "not_needed",
              };
            } else {
              options.onBeforePush?.();

              const pushResult = git(
                maybeTempWorktree,
                ["push", publishRemote, `HEAD:${publishBranch}`],
                { allowFailure: true },
              );

              if (pushResult.status === 0) {
                result = {
                  ...result,
                  pushed: true,
                  pushStatus: "pushed",
                };
              } else {
                git(cwd, ["fetch", publishRemote, "--prune"]);
                const maybeCurrentRemoteSha = refExists(cwd, baseRef)
                  ? resolveRefSha(cwd, baseRef)
                  : undefined;

                result = {
                  ...result,
                  message: createPushFailureMessage(
                    publishRemote,
                    publishBranch,
                    [pushResult.stderr.trim(), pushResult.stdout.trim()].filter(Boolean).join(" "),
                    beforeSha,
                    maybeCurrentRemoteSha,
                  ),
                  pushStatus: "failed",
                };
              }
            }
          }
        }
      }
    }
  } catch (error) {
    result = {
      ...result,
      message: renderFailure(error),
      pushStatus: result.pushStatus === "pushed" ? result.pushStatus : "not_attempted",
      status: "failed",
    };
  } finally {
    if (maybeTempWorktree) {
      const removeResult = git(cwd, ["worktree", "remove", "--force", maybeTempWorktree], {
        allowFailure: true,
      });
      if (removeResult.status !== 0) {
        cleanupWarnings.push(
          [
            `Failed to remove temporary worktree '${maybeTempWorktree}'.`,
            removeResult.stderr.trim() || removeResult.stdout.trim(),
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
    }

    if (maybeTempBranch) {
      const deleteResult = git(cwd, ["branch", "-D", maybeTempBranch], { allowFailure: true });
      if (deleteResult.status !== 0) {
        cleanupWarnings.push(
          [
            `Failed to delete temporary branch '${maybeTempBranch}'.`,
            deleteResult.stderr.trim() || deleteResult.stdout.trim(),
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
    }

    if (maybeTempRoot) {
      try {
        fs.rmSync(maybeTempRoot, { force: true, recursive: true });
      } catch (error) {
        cleanupWarnings.push(`Failed to clean '${maybeTempRoot}': ${renderFailure(error)}`);
      }
    }

    result = appendCleanupWarning(result, cleanupWarnings);
  }

  return result;
};
