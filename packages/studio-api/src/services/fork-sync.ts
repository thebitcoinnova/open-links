import { classifyForkOwnedPaths, isForkOwnedPath } from "./fork-owned-paths.js";

export type ForkSyncTreeMode = "100644" | "100755" | "040000" | "160000" | "120000";
export type ForkSyncTreeType = "blob" | "tree" | "commit";

export interface ForkSyncTreeEntry {
  mode: ForkSyncTreeMode;
  path: string;
  sha: string | null;
  type: ForkSyncTreeType;
}

export interface ForkSyncConflictSummary {
  canAutoResolve: boolean;
  conflictingPaths: string[];
  forkOwnedConflicts: string[];
  sharedConflicts: string[];
}

const sortUniquePaths = (repoPaths: Iterable<string>): string[] =>
  Array.from(new Set(repoPaths)).sort();

export const summarizeForkSyncConflicts = (input: {
  forkChangedPaths: Iterable<string>;
  upstreamChangedPaths: Iterable<string>;
}): ForkSyncConflictSummary => {
  const forkChanged = new Set(sortUniquePaths(input.forkChangedPaths));
  const upstreamChanged = new Set(sortUniquePaths(input.upstreamChangedPaths));
  const conflictingPaths = Array.from(forkChanged).filter((repoPath) =>
    upstreamChanged.has(repoPath),
  );
  const { forkOwnedPaths, sharedPaths } = classifyForkOwnedPaths(conflictingPaths);

  return {
    canAutoResolve: sharedPaths.length === 0,
    conflictingPaths: conflictingPaths.sort(),
    forkOwnedConflicts: forkOwnedPaths,
    sharedConflicts: sharedPaths,
  };
};

const buildTreeMap = (tree: readonly ForkSyncTreeEntry[]): Map<string, ForkSyncTreeEntry> =>
  new Map(tree.map((entry) => [entry.path, entry]));

export const buildForkOwnedPreservationTree = (input: {
  forkTree: readonly ForkSyncTreeEntry[];
  upstreamTree: readonly ForkSyncTreeEntry[];
}): ForkSyncTreeEntry[] => {
  const forkTreeMap = buildTreeMap(input.forkTree);
  const upstreamTreeMap = buildTreeMap(input.upstreamTree);
  const candidatePaths = sortUniquePaths(
    [...forkTreeMap.keys(), ...upstreamTreeMap.keys()].filter((repoPath) =>
      isForkOwnedPath(repoPath),
    ),
  );

  return candidatePaths.map((repoPath) => {
    const forkEntry = forkTreeMap.get(repoPath);
    if (forkEntry) {
      return {
        mode: forkEntry.mode,
        path: forkEntry.path,
        sha: forkEntry.sha,
        type: forkEntry.type,
      };
    }

    const upstreamEntry = upstreamTreeMap.get(repoPath);
    return {
      mode: upstreamEntry?.mode ?? "100644",
      path: repoPath,
      sha: null,
      type: upstreamEntry?.type ?? "blob",
    };
  });
};
