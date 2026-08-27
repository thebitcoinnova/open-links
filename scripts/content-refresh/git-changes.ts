import { runCommand } from "../lib/command";

export const listGitChangedPaths = (): string[] => {
  const commands: string[][] = [
    ["diff", "--name-only", "HEAD"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const changedPaths = new Set<string>();

  for (const args of commands) {
    const result = runCommand("git", args);
    for (const repoPath of result.stdout.split("\n")) {
      const trimmedPath = repoPath.trim();
      if (trimmedPath) {
        changedPaths.add(trimmedPath);
      }
    }
  }

  return [...changedPaths].sort();
};
