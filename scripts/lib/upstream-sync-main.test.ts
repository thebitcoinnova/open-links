import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCommand } from "./command";
import { runUpstreamMainSync } from "./upstream-sync-main";

const writeText = (absolutePath: string, content: string) => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
};

const git = (cwd: string, args: string[], allowFailure = false) =>
  runCommand("git", args, { allowFailure, cwd });

const configureGitIdentity = (cwd: string) => {
  git(cwd, ["config", "user.name", "OpenLinks Tests"]);
  git(cwd, ["config", "user.email", "openlinks-tests@example.com"]);
};

const createBareRepo = (parentDir: string, name: string) => {
  const repoPath = path.join(parentDir, name);
  git(parentDir, ["init", "--bare", repoPath]);
  return repoPath;
};

const cloneRepo = (remotePath: string, parentDir: string, name: string) => {
  const repoPath = path.join(parentDir, name);
  git(parentDir, ["clone", remotePath, repoPath]);
  configureGitIdentity(repoPath);
  return repoPath;
};

const commitAll = (cwd: string, message: string) => {
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", message]);
};

const pushMain = (cwd: string, remote = "origin") => {
  git(cwd, ["push", remote, "main"]);
};

const readBareFile = (bareRepoPath: string, repoPath: string) =>
  git(path.dirname(bareRepoPath), [
    "--git-dir",
    bareRepoPath,
    "show",
    `refs/heads/main:${repoPath}`,
  ]).stdout;

const countWorktrees = (cwd: string) =>
  git(cwd, ["worktree", "list", "--porcelain"])
    .stdout.split("\n")
    .filter((line) => line.startsWith("worktree ")).length;

const listSyncBranches = (cwd: string) =>
  git(cwd, ["branch", "--list", "codex/sync-main-*"]).stdout.trim();

const initializePublishedMainWorkspace = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-sync-main-"));
  const upstreamBare = createBareRepo(rootDir, "upstream.git");
  const originBare = createBareRepo(rootDir, "origin.git");
  const seedRepo = path.join(rootDir, "seed");

  git(rootDir, ["init", seedRepo]);
  configureGitIdentity(seedRepo);
  git(seedRepo, ["checkout", "-b", "main"]);

  writeText(path.join(seedRepo, "README.md"), "# OpenLinks\n");
  writeText(path.join(seedRepo, "data/profile.json"), '{ "name": "Starter" }\n');
  writeText(path.join(seedRepo, "data/cache/rich-public-cache.json"), '{ "links": [] }\n');
  writeText(
    path.join(seedRepo, "public/history/followers/github.csv"),
    "date,count\n2026-01-01,1\n",
  );
  writeText(
    path.join(seedRepo, "public/history/followers/index.json"),
    '{ "series": ["github"] }\n',
  );

  commitAll(seedRepo, "base");
  git(seedRepo, ["remote", "add", "upstream", upstreamBare]);
  git(seedRepo, ["remote", "add", "origin", originBare]);
  pushMain(seedRepo, "upstream");
  pushMain(seedRepo, "origin");

  const repoMain = cloneRepo(originBare, rootDir, "repo-main");
  git(repoMain, ["checkout", "-B", "main", "origin/main"]);
  git(repoMain, ["remote", "add", "upstream", upstreamBare]);

  const detachedCaller = path.join(rootDir, "caller");
  git(repoMain, ["worktree", "add", "--detach", detachedCaller, "origin/main"]);
  configureGitIdentity(detachedCaller);

  const upstreamWorktree = cloneRepo(upstreamBare, rootDir, "upstream-worktree");
  git(upstreamWorktree, ["checkout", "-B", "main", "origin/main"]);

  return {
    cleanup: () => fs.rmSync(rootDir, { force: true, recursive: true }),
    detachedCaller,
    originBare,
    repoMain,
    rootDir,
    upstreamBare,
    upstreamWorktree,
  };
};

test("runUpstreamMainSync reports up_to_date from a detached worktree and leaves caller HEAD unchanged", () => {
  const workspace = initializePublishedMainWorkspace();

  try {
    const callerHeadBefore = git(workspace.detachedCaller, ["rev-parse", "HEAD"]).stdout.trim();
    const result = runUpstreamMainSync({ cwd: workspace.detachedCaller });
    const callerHeadAfter = git(workspace.detachedCaller, ["rev-parse", "HEAD"]).stdout.trim();

    assert.equal(result.status, "up_to_date");
    assert.equal(result.pushStatus, "not_needed");
    assert.equal(result.pushed, false);
    assert.equal(result.branchChanged, false);
    assert.equal(result.beforeSha, result.afterSha);
    assert.equal(callerHeadAfter, callerHeadBefore);
    assert.equal(countWorktrees(workspace.repoMain), 2);
    assert.equal(listSyncBranches(workspace.repoMain), "");
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamMainSync publishes merged fork-owned conflicts to origin/main without moving the detached caller", () => {
  const workspace = initializePublishedMainWorkspace();

  try {
    writeText(path.join(workspace.repoMain, "data/profile.json"), '{ "name": "Fork" }\n');
    commitAll(workspace.repoMain, "fork profile update");
    pushMain(workspace.repoMain);

    writeText(
      path.join(workspace.upstreamWorktree, "data/profile.json"),
      '{ "name": "Upstream" }\n',
    );
    commitAll(workspace.upstreamWorktree, "upstream profile update");
    pushMain(workspace.upstreamWorktree);

    const callerHeadBefore = git(workspace.detachedCaller, ["rev-parse", "HEAD"]).stdout.trim();
    const originHeadBefore = git(workspace.repoMain, ["rev-parse", "origin/main"]).stdout.trim();
    const result = runUpstreamMainSync({ cwd: workspace.detachedCaller });
    const callerHeadAfter = git(workspace.detachedCaller, ["rev-parse", "HEAD"]).stdout.trim();
    const originHeadAfter = git(workspace.repoMain, [
      "--git-dir",
      workspace.originBare,
      "rev-parse",
      "refs/heads/main",
    ]).stdout.trim();

    assert.equal(result.status, "merged");
    assert.equal(result.pushStatus, "pushed");
    assert.equal(result.pushed, true);
    assert.equal(result.beforeSha, originHeadBefore);
    assert.equal(result.afterSha, originHeadAfter);
    assert.notEqual(result.beforeSha, result.afterSha);
    assert.equal(readBareFile(workspace.originBare, "data/profile.json"), '{ "name": "Fork" }\n');
    assert.equal(callerHeadAfter, callerHeadBefore);
    assert.equal(countWorktrees(workspace.repoMain), 2);
    assert.equal(listSyncBranches(workspace.repoMain), "");
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamMainSync stops on shared-file conflicts and cleans up the disposable integration branch", () => {
  const workspace = initializePublishedMainWorkspace();

  try {
    writeText(path.join(workspace.repoMain, "README.md"), "# Fork README\n");
    commitAll(workspace.repoMain, "fork readme update");
    pushMain(workspace.repoMain);

    writeText(path.join(workspace.upstreamWorktree, "README.md"), "# Upstream README\n");
    commitAll(workspace.upstreamWorktree, "upstream readme update");
    pushMain(workspace.upstreamWorktree);

    const originHeadBefore = git(workspace.repoMain, ["rev-parse", "origin/main"]).stdout.trim();
    const result = runUpstreamMainSync({ cwd: workspace.detachedCaller });
    const originHeadAfter = git(workspace.repoMain, [
      "--git-dir",
      workspace.originBare,
      "rev-parse",
      "refs/heads/main",
    ]).stdout.trim();

    assert.equal(result.status, "conflict");
    assert.equal(result.pushStatus, "not_attempted");
    assert.equal(result.pushed, false);
    assert.deepEqual(result.sharedConflicts, ["README.md"]);
    assert.equal(originHeadAfter, originHeadBefore);
    assert.equal(countWorktrees(workspace.repoMain), 2);
    assert.equal(listSyncBranches(workspace.repoMain), "");
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamMainSync fails when local main has unpublished commits", () => {
  const workspace = initializePublishedMainWorkspace();

  try {
    writeText(path.join(workspace.repoMain, "README.md"), "# Local main ahead\n");
    commitAll(workspace.repoMain, "local main ahead");

    const result = runUpstreamMainSync({ cwd: workspace.detachedCaller });

    assert.equal(result.status, "failed");
    assert.equal(result.pushStatus, "not_attempted");
    assert.equal(result.pushed, false);
    assert.match(result.message, /Local refs\/heads\/main has commits/u);
    assert.equal(countWorktrees(workspace.repoMain), 2);
    assert.equal(listSyncBranches(workspace.repoMain), "");
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamMainSync reports a retryable push failure when origin/main advances before publish", () => {
  const workspace = initializePublishedMainWorkspace();

  try {
    writeText(path.join(workspace.upstreamWorktree, "README.md"), "# Upstream change\n");
    commitAll(workspace.upstreamWorktree, "upstream readme update");
    pushMain(workspace.upstreamWorktree);

    const originAdvancer = cloneRepo(workspace.originBare, workspace.rootDir, "origin-advancer");
    git(originAdvancer, ["checkout", "-B", "main", "origin/main"]);

    const result = runUpstreamMainSync({
      cwd: workspace.detachedCaller,
      onBeforePush: () => {
        writeText(path.join(originAdvancer, "README.md"), "# Origin race\n");
        commitAll(originAdvancer, "origin race update");
        pushMain(originAdvancer);
      },
    });

    assert.equal(result.status, "fast_forwarded");
    assert.equal(result.pushStatus, "failed");
    assert.equal(result.pushed, false);
    assert.match(result.message, /advanced during publish/u);
    assert.equal(readBareFile(workspace.originBare, "README.md"), "# Origin race\n");
    assert.equal(countWorktrees(workspace.repoMain), 2);
    assert.equal(listSyncBranches(workspace.repoMain), "");
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamMainSync ignores a dirty detached caller worktree and leaves its local changes untouched", () => {
  const workspace = initializePublishedMainWorkspace();

  try {
    writeText(path.join(workspace.upstreamWorktree, "README.md"), "# Upstream change\n");
    commitAll(workspace.upstreamWorktree, "upstream readme update");
    pushMain(workspace.upstreamWorktree);

    writeText(path.join(workspace.detachedCaller, "CALLER_DIRTY.txt"), "dirty\n");

    const result = runUpstreamMainSync({ cwd: workspace.detachedCaller });
    const callerStatus = git(workspace.detachedCaller, ["status", "--porcelain"]).stdout;

    assert.equal(result.pushStatus, "pushed");
    assert.equal(result.pushed, true);
    assert.match(callerStatus, /\?\? CALLER_DIRTY\.txt/u);
    assert.equal(countWorktrees(workspace.repoMain), 2);
    assert.equal(listSyncBranches(workspace.repoMain), "");
  } finally {
    workspace.cleanup();
  }
});
