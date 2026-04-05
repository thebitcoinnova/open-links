const sortUniquePaths = (maybePaths: readonly string[] | undefined): string[] =>
  Array.from(new Set(maybePaths ?? [])).sort();

export interface UpstreamSyncCliRenderableResult {
  conflictingPaths: readonly string[];
  forkOwnedConflicts?: readonly string[];
  message: string;
  pushStatus?: "failed" | "not_attempted" | "not_needed" | "pushed";
  sharedConflicts?: readonly string[];
}

export const renderUpstreamSyncCliOutput = (result: UpstreamSyncCliRenderableResult): string => {
  const lines = [result.message];
  const sharedConflicts = sortUniquePaths(result.sharedConflicts);
  const forkOwnedConflicts = sortUniquePaths(result.forkOwnedConflicts);

  if (sharedConflicts.length > 0 || forkOwnedConflicts.length > 0) {
    if (sharedConflicts.length > 0) {
      lines.push(`Shared conflicts: ${sharedConflicts.join(", ")}`);
    }

    if (forkOwnedConflicts.length > 0) {
      lines.push(`Fork-owned conflicts: ${forkOwnedConflicts.join(", ")}`);
    }

    if (sharedConflicts.length > 0 && forkOwnedConflicts.length > 0) {
      lines.push(
        "Fork-owned conflicts were detected and classified correctly; shared conflicts are the blocker requiring manual resolution.",
      );
    }
  } else if (result.conflictingPaths.length > 0) {
    lines.push(`Conflicts: ${result.conflictingPaths.join(", ")}`);
  }

  if (
    result.pushStatus &&
    result.pushStatus !== "not_attempted" &&
    result.pushStatus !== "not_needed"
  ) {
    lines.push(`Push status: ${result.pushStatus}`);
  }

  return `${lines.join("\n")}\n`;
};
