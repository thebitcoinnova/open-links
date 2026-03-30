import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCommand } from "./command";
import { runUpstreamSync } from "./upstream-sync";

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

const initializeForkWorkspace = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-sync-upstream-"));
  const upstreamBare = createBareRepo(rootDir, "upstream.git");
  const originBare = createBareRepo(rootDir, "origin.git");
  const seedRepo = path.join(rootDir, "seed");

  git(rootDir, ["init", seedRepo]);
  configureGitIdentity(seedRepo);
  git(seedRepo, ["checkout", "-b", "main"]);

  writeText(path.join(seedRepo, "README.md"), "# OpenLinks\n");
  writeText(path.join(seedRepo, "data/profile.json"), '{ "name": "Starter" }\n');
  writeText(path.join(seedRepo, "public/history/followers/github.csv"), "date,count\n");

  commitAll(seedRepo, "base");
  git(seedRepo, ["remote", "add", "upstream", upstreamBare]);
  git(seedRepo, ["remote", "add", "origin", originBare]);
  git(seedRepo, ["push", "upstream", "main"]);
  git(seedRepo, ["push", "origin", "main"]);

  const forkRepo = cloneRepo(originBare, rootDir, "fork");
  git(forkRepo, ["checkout", "-b", "main", "origin/main"]);
  git(forkRepo, ["remote", "add", "upstream", upstreamBare]);
  const upstreamWorktree = cloneRepo(upstreamBare, rootDir, "upstream-worktree");
  git(upstreamWorktree, ["checkout", "-b", "main", "origin/main"]);

  return {
    cleanup: () => fs.rmSync(rootDir, { force: true, recursive: true }),
    forkRepo,
    rootDir,
    upstreamBare,
    upstreamWorktree,
  };
};

test("runUpstreamSync reports up_to_date when HEAD already contains upstream", () => {
  const workspace = initializeForkWorkspace();

  try {
    const result = runUpstreamSync({ cwd: workspace.forkRepo });
    assert.equal(result.status, "up_to_date");
    assert.equal(result.branchChanged, false);
    assert.match(result.message, /Already up to date/u);
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamSync auto-resolves fork-owned file conflicts by preserving fork content", () => {
  const workspace = initializeForkWorkspace();

  try {
    writeText(path.join(workspace.forkRepo, "data/profile.json"), '{ "name": "Fork" }\n');
    commitAll(workspace.forkRepo, "fork profile update");

    writeText(
      path.join(workspace.upstreamWorktree, "data/profile.json"),
      '{ "name": "Upstream" }\n',
    );
    commitAll(workspace.upstreamWorktree, "upstream profile update");
    git(workspace.upstreamWorktree, ["push", "origin", "main"]);

    const result = runUpstreamSync({ cwd: workspace.forkRepo });
    const profile = fs.readFileSync(path.join(workspace.forkRepo, "data/profile.json"), "utf8");

    assert.equal(result.status, "merged");
    assert.equal(result.mergeCommitCreated, true);
    assert.match(result.message, /preserving fork-owned paths/u);
    assert.equal(profile, '{ "name": "Fork" }\n');
    assert.deepEqual(result.sharedConflicts, []);
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamSync preserves fork deletions for fork-owned paths during modify-delete conflicts", () => {
  const workspace = initializeForkWorkspace();

  try {
    fs.rmSync(path.join(workspace.forkRepo, "public/history/followers/github.csv"));
    commitAll(workspace.forkRepo, "remove fork follower history");

    writeText(
      path.join(workspace.upstreamWorktree, "public/history/followers/github.csv"),
      "date,count\n2026-03-30,42\n",
    );
    commitAll(workspace.upstreamWorktree, "update upstream follower history");
    git(workspace.upstreamWorktree, ["push", "origin", "main"]);

    const result = runUpstreamSync({ cwd: workspace.forkRepo });

    assert.equal(result.status, "merged");
    assert.equal(
      fs.existsSync(path.join(workspace.forkRepo, "public/history/followers/github.csv")),
      false,
    );
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamSync blocks shared-file conflicts and aborts the merge", () => {
  const workspace = initializeForkWorkspace();

  try {
    writeText(path.join(workspace.forkRepo, "README.md"), "# Fork README\n");
    commitAll(workspace.forkRepo, "fork readme update");

    writeText(path.join(workspace.upstreamWorktree, "README.md"), "# Upstream README\n");
    commitAll(workspace.upstreamWorktree, "upstream readme update");
    git(workspace.upstreamWorktree, ["push", "origin", "main"]);

    const headBefore = git(workspace.forkRepo, ["rev-parse", "HEAD"]).stdout.trim();
    const result = runUpstreamSync({ cwd: workspace.forkRepo });
    const headAfter = git(workspace.forkRepo, ["rev-parse", "HEAD"]).stdout.trim();

    assert.equal(result.status, "conflict");
    assert.deepEqual(result.sharedConflicts, ["README.md"]);
    assert.equal(headAfter, headBefore);
    assert.equal(git(workspace.forkRepo, ["status", "--porcelain"]).stdout.trim(), "");
  } finally {
    workspace.cleanup();
  }
});

test("runUpstreamSync fails fast when the upstream remote is missing", () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "open-links-sync-upstream-missing-remote-"),
  );

  try {
    git(rootDir, ["init", "repo"]);
    const repoDir = path.join(rootDir, "repo");
    configureGitIdentity(repoDir);
    git(repoDir, ["checkout", "-b", "main"]);
    writeText(path.join(repoDir, "README.md"), "# Repo\n");
    commitAll(repoDir, "base");

    assert.throws(
      () => runUpstreamSync({ cwd: repoDir }),
      /Git remote 'upstream' is not configured/u,
    );
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test("runUpstreamSync fails fast on a dirty worktree", () => {
  const workspace = initializeForkWorkspace();

  try {
    writeText(path.join(workspace.forkRepo, "README.md"), "# Dirty\n");
    assert.throws(() => runUpstreamSync({ cwd: workspace.forkRepo }), /dirty worktree/u);
  } finally {
    workspace.cleanup();
  }
});
