import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const LOCKFILE_PATH = "bun.lock";
const LOCKFILE_IMPACT_KEYS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "resolutions",
  "workspaces",
  "packageManager",
] as const;

type PackageJsonLike = Record<string, unknown>;

const readCommandOutput = (command: string, args: string[]): string =>
  execFileSync(command, args, { encoding: "utf8" }).trim();

const readGitObject = (spec: string): string | null => {
  try {
    return execFileSync("git", ["show", spec], { encoding: "utf8" });
  } catch {
    return null;
  }
};

const parseJson = (content: string, pathLabel: string): PackageJsonLike => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON root is not an object");
    }
    return parsed as PackageJsonLike;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${pathLabel}: ${message}`);
  }
};

const isManifestPath = (path: string): boolean =>
  path === "package.json" || /^packages\/[^/]+\/package\.json$/.test(path);

const run = (): void => {
  const stagedFiles = readCommandOutput("git", [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
  ])
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (stagedFiles.length === 0) {
    console.log("pre-commit: lockfile sync guard skipped (no staged files).");
    return;
  }

  const stagedManifests = stagedFiles.filter(isManifestPath);
  if (stagedManifests.length === 0) {
    console.log("pre-commit: lockfile sync guard skipped (no staged package manifests).");
    return;
  }

  const changedManifests: Array<{ path: string; changedKeys: string[] }> = [];

  for (const manifestPath of stagedManifests) {
    const stagedContent = readGitObject(`:${manifestPath}`);
    if (!stagedContent) {
      continue;
    }

    const stagedJson = parseJson(stagedContent, `staged ${manifestPath}`);
    const headContent = readGitObject(`HEAD:${manifestPath}`);
    const headJson = headContent ? parseJson(headContent, `HEAD ${manifestPath}`) : {};

    const changedKeys = LOCKFILE_IMPACT_KEYS.filter(
      (key) => !isDeepStrictEqual(headJson[key], stagedJson[key]),
    );

    if (changedKeys.length > 0) {
      changedManifests.push({
        path: manifestPath,
        changedKeys,
      });
    }
  }

  if (changedManifests.length === 0) {
    console.log("pre-commit: lockfile sync guard passed (no lockfile-impacting manifest changes).");
    return;
  }

  const lockfileStaged = stagedFiles.includes(LOCKFILE_PATH);
  if (lockfileStaged) {
    console.log(
      "pre-commit: lockfile sync guard passed (lockfile-impacting changes include bun.lock).",
    );
    return;
  }

  console.error("pre-commit: lockfile sync guard failed.");
  console.error("Detected lockfile-impacting package manifest changes without staged bun.lock:");
  for (const entry of changedManifests) {
    console.error(`- ${entry.path}: ${entry.changedKeys.join(", ")}`);
  }
  console.error("Action: run `bun install`, stage bun.lock, and retry commit.");
  process.exit(1);
};

run();
