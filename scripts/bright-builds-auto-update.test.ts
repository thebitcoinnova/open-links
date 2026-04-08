import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const SOURCE_SCRIPT_PATH = path.join(ROOT, "scripts", "bright-builds-auto-update.sh");

type ManagerState = "blocked-install-force" | "blocked-update" | "installed";

const runCommand = (
  command: string,
  args: string[],
  cwd: string,
  extraEnv: NodeJS.ProcessEnv = {},
) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
};

const createAuditManifest = () => `# Coding and Architecture Requirements Audit Trail

## Current installation

- Source repository: \`https://github.com/bright-builds-llc/coding-and-architecture-requirements\`
- Version pin: \`main\`
- Auto-update: \`enabled\`
- Last operation: \`update\`
- Last updated (UTC): \`2026-03-28T14:11:52Z\`
`;

const createFakeManagerScript = () => `#!/usr/bin/env bash
set -euo pipefail

log_path="\${BRIGHT_BUILDS_TEST_LOG:?}"
state_file="\${BRIGHT_BUILDS_TEST_STATE_FILE:?}"

printf '%s\\n' "$*" >> "$log_path"

command_name="\${1:-}"
shift || true
current_state="$(cat "$state_file")"

case "$command_name" in
  status)
    printf 'Target repository: %s\\n' "$PWD"
    case "$current_state" in
      installed)
        printf 'Repo state: installed\\n'
        printf 'Recommended action: update\\n'
        ;;
      blocked-install-force)
        printf 'Repo state: blocked\\n'
        printf 'Recommended action: install --force\\n'
        ;;
      blocked-update)
        printf 'Repo state: blocked\\n'
        printf 'Recommended action: update\\n'
        ;;
      *)
        printf 'Repo state: %s\\n' "$current_state"
        printf 'Recommended action: inspect\\n'
        ;;
    esac
    ;;
  install)
    if [[ "\${1:-}" != "--force" ]]; then
      echo 'expected --force' >&2
      exit 10
    fi

    mkdir -p ".coding-and-architecture-requirements-backups/20260408T000000Z"
    printf 'backup\\n' > ".coding-and-architecture-requirements-backups/20260408T000000Z/AGENTS.bright-builds.md"

    if [[ "$current_state" == "blocked-install-force" ]]; then
      printf 'installed\\n' > "$state_file"
    fi
    ;;
  update)
    ;;
  *)
    echo "unexpected command: $command_name" >&2
    exit 11
    ;;
esac
`;

const initializeRepo = (repoRoot: string) => {
  runCommand("git", ["init"], repoRoot);
  runCommand("git", ["config", "user.name", "Test User"], repoRoot);
  runCommand("git", ["config", "user.email", "test@example.com"], repoRoot);
  runCommand(
    "git",
    [
      "add",
      "coding-and-architecture-requirements.audit.md",
      "scripts/bright-builds-auto-update.sh",
    ],
    repoRoot,
  );
  runCommand("git", ["commit", "-m", "Initial commit"], repoRoot);
};

const createFixture = (t: test.TestContext, initialState: ManagerState) => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-bright-builds-auto-update-"));
  const scriptsDirectory = path.join(repoRoot, "scripts");
  const managerPath = path.join(repoRoot, "fake-manage-downstream.sh");
  const scriptPath = path.join(scriptsDirectory, "bright-builds-auto-update.sh");
  const statePath = path.join(repoRoot, "manager-state.txt");
  const logPath = path.join(repoRoot, "manager.log");

  fs.mkdirSync(scriptsDirectory, { recursive: true });
  fs.copyFileSync(SOURCE_SCRIPT_PATH, scriptPath);
  fs.chmodSync(scriptPath, 0o755);
  fs.writeFileSync(
    path.join(repoRoot, "coding-and-architecture-requirements.audit.md"),
    createAuditManifest(),
    "utf8",
  );
  fs.writeFileSync(statePath, `${initialState}\n`, "utf8");
  fs.writeFileSync(logPath, "", "utf8");
  fs.writeFileSync(managerPath, createFakeManagerScript(), "utf8");
  fs.chmodSync(managerPath, 0o755);

  initializeRepo(repoRoot);

  t.after(() => {
    fs.rmSync(repoRoot, { force: true, recursive: true });
  });

  return {
    logPath,
    managerPath,
    repoRoot,
    scriptPath,
    statePath,
  };
};

const runAutoUpdate = (fixture: ReturnType<typeof createFixture>) =>
  spawnSync("bash", [fixture.scriptPath], {
    cwd: fixture.repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      BRIGHT_BUILDS_MANAGE_DOWNSTREAM_PATH: fixture.managerPath,
      BRIGHT_BUILDS_TEST_LOG: fixture.logPath,
      BRIGHT_BUILDS_TEST_STATE_FILE: fixture.statePath,
    },
  });

const readLogLines = (logPath: string) =>
  fs
    .readFileSync(logPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

test("bright builds auto-update runs update directly when the repo is already installed", (t) => {
  const fixture = createFixture(t, "installed");
  const result = runAutoUpdate(fixture);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Repo state: installed/u);
  assert.match(result.stdout, /No managed-file changes detected\./u);
  assert.deepEqual(readLogLines(fixture.logPath), [
    `status --repo-root ${fixture.repoRoot}`,
    `update --repo-root ${fixture.repoRoot}`,
  ]);
});

test("bright builds auto-update self-heals blocked repos that recommend install --force", (t) => {
  const fixture = createFixture(t, "blocked-install-force");
  const result = runAutoUpdate(fixture);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Repo state: blocked/u);
  assert.match(result.stdout, /Detected blocked repo state; running install --force self-heal\./u);
  assert.match(
    result.stdout,
    /Removed recovery backup \.coding-and-architecture-requirements-backups\/20260408T000000Z/u,
  );
  assert.match(result.stdout, /No managed-file changes detected\./u);
  assert.deepEqual(readLogLines(fixture.logPath), [
    `status --repo-root ${fixture.repoRoot}`,
    `install --force --repo-root ${fixture.repoRoot}`,
    `status --repo-root ${fixture.repoRoot}`,
    `update --repo-root ${fixture.repoRoot}`,
  ]);
  assert.equal(
    fs.existsSync(path.join(fixture.repoRoot, ".coding-and-architecture-requirements-backups")),
    false,
  );
});

test("bright builds auto-update still fails fast for blocked repos with other recommendations", (t) => {
  const fixture = createFixture(t, "blocked-update");
  const result = runAutoUpdate(fixture);

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /auto-update cannot continue from repo state 'blocked' during auto-update \(recommended action: update\)/u,
  );
  assert.deepEqual(readLogLines(fixture.logPath), [`status --repo-root ${fixture.repoRoot}`]);
});
