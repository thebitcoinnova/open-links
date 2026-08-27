import process from "node:process";
import { listGitChangedPaths } from "./content-refresh/git-changes";
import { classifyNightlyArtifactPaths } from "./content-refresh/nightly-artifacts";
import { runCommand } from "./lib/command";

export const stageNightlyContent = (): string[] => {
  const classification = classifyNightlyArtifactPaths(listGitChangedPaths());
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
