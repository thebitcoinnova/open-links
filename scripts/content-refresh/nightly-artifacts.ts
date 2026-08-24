import { classifyContentRefreshPaths, normalizeRepoPath } from "./paths";

const FOLLOWER_HISTORY_INDEX_PATH = "public/history/followers/index.json";
const FOLLOWER_HISTORY_DIRECTORY_PREFIX = "public/history/followers/";

export const isFollowerHistoryPath = (repoPath: string): boolean => {
  const normalizedPath = normalizeRepoPath(repoPath);
  return (
    normalizedPath === FOLLOWER_HISTORY_INDEX_PATH ||
    (normalizedPath.startsWith(FOLLOWER_HISTORY_DIRECTORY_PREFIX) &&
      normalizedPath.endsWith(".csv"))
  );
};

export const classifyNightlyArtifactPaths = (repoPaths: Iterable<string>) => {
  const normalizedPaths = [...repoPaths].map(normalizeRepoPath);
  const contentRefreshClassification = classifyContentRefreshPaths(normalizedPaths);
  const followerHistoryPaths =
    contentRefreshClassification.unexpectedPaths.filter(isFollowerHistoryPath);
  const unexpectedPaths = contentRefreshClassification.unexpectedPaths.filter(
    (repoPath) => !isFollowerHistoryPath(repoPath),
  );

  return {
    allowedPaths: [
      ...contentRefreshClassification.contentRefreshPaths,
      ...followerHistoryPaths,
    ].sort(),
    unexpectedPaths: unexpectedPaths.sort(),
  };
};
