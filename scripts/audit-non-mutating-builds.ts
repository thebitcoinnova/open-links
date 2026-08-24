import { createHash } from "node:crypto";
import fs from "node:fs";
import process from "node:process";
import { runCommand } from "./lib/command";

interface AuditCommand {
  args: string[];
  command: string;
  label: string;
}

const AUDIT_COMMANDS: AuditCommand[] = [
  { command: "bun", args: ["run", "build"], label: "standard build" },
  { command: "bun", args: ["run", "build:strict"], label: "strict build" },
  {
    command: "bun",
    args: ["run", "ci:required:hook:build"],
    label: "pre-commit hook build",
  },
  { command: "bun", args: ["run", "build"], label: "screenshot build preparation" },
  {
    command: "bun",
    args: ["run", "deploy:build", "--", "--skip-content-sync"],
    label: "deploy artifact build",
  },
];

const hashTrackedPath = (repoPath: string): string => {
  if (!fs.existsSync(repoPath)) return "missing";
  const stats = fs.lstatSync(repoPath);
  const hash = createHash("sha256");
  hash.update(stats.isSymbolicLink() ? fs.readlinkSync(repoPath) : fs.readFileSync(repoPath));
  return `${stats.mode}:${hash.digest("hex")}`;
};

const snapshotTrackedState = (): Map<string, string> => {
  const trackedFiles = runCommand("git", ["ls-files", "-z"]).stdout.split("\0").filter(Boolean);
  return new Map(trackedFiles.map((repoPath) => [repoPath, hashTrackedPath(repoPath)]));
};

const findChangedPaths = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): string[] => {
  const allPaths = new Set([...before.keys(), ...after.keys()]);
  return [...allPaths].filter((repoPath) => before.get(repoPath) !== after.get(repoPath)).sort();
};

export const auditNonMutatingBuilds = (): void => {
  const baseline = snapshotTrackedState();
  const commandFailures: string[] = [];

  for (const auditCommand of AUDIT_COMMANDS) {
    console.log(`Non-mutating build audit: ${auditCommand.label}...`);
    const result = runCommand(auditCommand.command, auditCommand.args, { allowFailure: true });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    const changedPaths = findChangedPaths(baseline, snapshotTrackedState());
    if (changedPaths.length > 0) {
      throw new Error(
        `${auditCommand.label} changed tracked files:\n${changedPaths.map((repoPath) => `- ${repoPath}`).join("\n")}`,
      );
    }
    if (result.status !== 0) {
      commandFailures.push(`${auditCommand.label} (exit ${result.status})`);
    }
  }

  if (commandFailures.length > 0) {
    throw new Error(
      `Build commands failed without mutating tracked files: ${commandFailures.join(", ")}.`,
    );
  }
  console.log(`Non-mutating build audit passed (${AUDIT_COMMANDS.length} command paths).`);
};

if (import.meta.main) {
  try {
    auditNonMutatingBuilds();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Non-mutating build audit failed: ${message}`);
    process.exit(1);
  }
}
