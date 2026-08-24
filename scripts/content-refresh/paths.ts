import contentRefreshPathConfigJson from "../../config/content-refresh-paths.json" with {
  type: "json",
};
import type { ContentRefreshPathConfig } from "./contracts";

export const normalizeRepoPath = (repoPath: string): string =>
  repoPath.replace(/\\/gu, "/").replace(/^\.?\//u, "");

const contentRefreshPathConfig = contentRefreshPathConfigJson as ContentRefreshPathConfig;
const exactPathSet = new Set(contentRefreshPathConfig.exactPaths.map(normalizeRepoPath));
const directoryPrefixes = contentRefreshPathConfig.directoryPrefixes.map(normalizeRepoPath);

export const getContentRefreshPathConfig = (): ContentRefreshPathConfig => ({
  directoryPrefixes: [...directoryPrefixes],
  exactPaths: [...exactPathSet],
});

export const isContentRefreshPath = (repoPath: string): boolean => {
  const normalizedPath = normalizeRepoPath(repoPath);
  return (
    exactPathSet.has(normalizedPath) ||
    directoryPrefixes.some((prefix) => normalizedPath.startsWith(prefix))
  );
};

export const classifyContentRefreshPaths = (repoPaths: Iterable<string>) => {
  const contentRefreshPaths: string[] = [];
  const unexpectedPaths: string[] = [];

  for (const repoPath of repoPaths) {
    const normalizedPath = normalizeRepoPath(repoPath);
    if (isContentRefreshPath(normalizedPath)) {
      contentRefreshPaths.push(normalizedPath);
    } else {
      unexpectedPaths.push(normalizedPath);
    }
  }

  contentRefreshPaths.sort();
  unexpectedPaths.sort();
  return { contentRefreshPaths, unexpectedPaths };
};
