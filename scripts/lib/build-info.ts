import { execFileSync } from "node:child_process";
import type { BuildInfo } from "../../src/lib/build-info";
import { normalizeGitHubRepositorySlug, trimToUndefined } from "../../src/lib/github-repository";
import { resolveStableBuildTimestamp } from "./build-timestamp";

interface ResolveBuildInfoOptions {
  buildTimestamp?: string;
  fallbackNow?: () => string;
  loadGitCommitSha?: () => string | undefined;
  loadGitCommitShortSha?: () => string | undefined;
  repositorySlug?: string;
}

export const buildGitHubCommitUrl = (
  maybeRepositorySlug?: string,
  maybeCommitSha?: string,
): string => {
  const repositorySlug = normalizeGitHubRepositorySlug(maybeRepositorySlug);
  const commitSha = trimToUndefined(maybeCommitSha);

  if (!repositorySlug || !commitSha) {
    return "";
  }

  return `https://github.com/${repositorySlug}/commit/${commitSha}`;
};

export const serializeBuildInfo = (buildInfo: BuildInfo): string =>
  `${JSON.stringify(buildInfo, null, 2)}\n`;

export function resolveBuildInfo(options: ResolveBuildInfoOptions = {}): BuildInfo {
  const commitSha =
    trimToUndefined(
      (typeof options.loadGitCommitSha === "function"
        ? options.loadGitCommitSha()
        : loadGitCommitShaFromGit()) ?? "",
    ) ?? "";
  const commitShortSha =
    trimToUndefined(
      (typeof options.loadGitCommitShortSha === "function"
        ? options.loadGitCommitShortSha()
        : loadGitCommitShortShaFromGit()) ?? "",
    ) ?? (commitSha ? commitSha.slice(0, 7) : "");

  return {
    builtAtIso: resolveStableBuildTimestamp({
      explicitValue: options.buildTimestamp,
      fallbackNow: options.fallbackNow,
    }),
    commitSha,
    commitShortSha,
    commitUrl: buildGitHubCommitUrl(options.repositorySlug, commitSha),
  };
}

function loadGitCommitShaFromGit(): string | undefined {
  try {
    const output = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}

function loadGitCommitShortShaFromGit(): string | undefined {
  try {
    const output = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}
