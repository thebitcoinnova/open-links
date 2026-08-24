import process from "node:process";
import { classifyNightlyArtifactPaths } from "./content-refresh/nightly-artifacts";
import { runCommand } from "./lib/command";

const listTrackedChanges = (): string[] => {
  const result = runCommand("git", ["diff", "--name-only", "HEAD"]);
  return result.stdout
    .split("\n")
    .map((repoPath) => repoPath.trim())
    .filter(Boolean);
};

export const stageNightlyContent = (): string[] => {
  const classification = classifyNightlyArtifactPaths(listTrackedChanges());
  if (classification.unexpectedPaths.length > 0) {
    throw new Error(
      `Nightly refresh changed tracked paths outside its ownership contract: ${classification.unexpectedPaths.join(", ")}.`,
    );
  }

  if (classification.allowedPaths.length > 0) {
    runCommand("git", ["add", "-A", "--", ...classification.allowedPaths]);
  }
  return classification.allowedPaths;
};

if (import.meta.main) {
  try {
    const stagedPaths = stageNightlyContent();
    console.log(`Nightly content staging passed: staged=${stagedPaths.length}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
