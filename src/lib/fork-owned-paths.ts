import forkOwnedPathConfig from "../../config/fork-owned-paths.json" with { type: "json" };

export interface ForkOwnedPathConfig {
  directoryPrefixes: string[];
  exactPaths: string[];
}

const config = forkOwnedPathConfig as ForkOwnedPathConfig;

export const normalizeRepoPath = (repoPath: string): string =>
  repoPath.replace(/\\/gu, "/").replace(/^\.?\//u, "");

const exactPathSet = new Set(config.exactPaths.map(normalizeRepoPath));
const directoryPrefixes = config.directoryPrefixes.map(normalizeRepoPath);

export const getForkOwnedPathConfig = (): ForkOwnedPathConfig => ({
  directoryPrefixes: [...directoryPrefixes],
  exactPaths: [...exactPathSet],
});

export const isForkOwnedPath = (repoPath: string): boolean => {
  const normalizedPath = normalizeRepoPath(repoPath);
  return (
    exactPathSet.has(normalizedPath) ||
    directoryPrefixes.some((prefix) => normalizedPath.startsWith(prefix))
  );
};

export const classifyForkOwnedPaths = (repoPaths: Iterable<string>) => {
  const forkOwnedPaths: string[] = [];
  const sharedPaths: string[] = [];

  for (const repoPath of repoPaths) {
    const normalizedPath = normalizeRepoPath(repoPath);
    if (isForkOwnedPath(normalizedPath)) {
      forkOwnedPaths.push(normalizedPath);
    } else {
      sharedPaths.push(normalizedPath);
    }
  }

  forkOwnedPaths.sort();
  sharedPaths.sort();

  return {
    forkOwnedPaths,
    sharedPaths,
  };
};
