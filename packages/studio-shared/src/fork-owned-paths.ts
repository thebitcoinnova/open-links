export interface ForkOwnedPathConfig {
  directoryPrefixes: string[];
  exactPaths: string[];
}

export const normalizeRepoPath = (repoPath: string): string =>
  repoPath.replace(/\\/gu, "/").replace(/^\.?\//u, "");

const normalizeConfig = (config: ForkOwnedPathConfig) => ({
  directoryPrefixes: config.directoryPrefixes.map(normalizeRepoPath),
  exactPathSet: new Set(config.exactPaths.map(normalizeRepoPath)),
});

export const isForkOwnedPath = (config: ForkOwnedPathConfig, repoPath: string): boolean => {
  const normalizedConfig = normalizeConfig(config);
  const normalizedPath = normalizeRepoPath(repoPath);
  return (
    normalizedConfig.exactPathSet.has(normalizedPath) ||
    normalizedConfig.directoryPrefixes.some((prefix) => normalizedPath.startsWith(prefix))
  );
};

export const classifyForkOwnedPaths = (
  config: ForkOwnedPathConfig,
  repoPaths: Iterable<string>,
) => {
  const forkOwnedPaths: string[] = [];
  const sharedPaths: string[] = [];

  for (const repoPath of repoPaths) {
    const normalizedPath = normalizeRepoPath(repoPath);
    if (isForkOwnedPath(config, normalizedPath)) {
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
