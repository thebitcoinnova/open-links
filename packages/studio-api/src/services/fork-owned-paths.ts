import {
  type ForkOwnedPathConfig,
  classifyForkOwnedPaths as classifyForkOwnedPathsWithConfig,
  isForkOwnedPath as isForkOwnedPathWithConfig,
  normalizeRepoPath,
} from "@openlinks/studio-shared/fork-owned-paths";
import forkOwnedPathConfig from "../../../../config/fork-owned-paths.json" with { type: "json" };

const config = forkOwnedPathConfig as ForkOwnedPathConfig;

export type { ForkOwnedPathConfig } from "@openlinks/studio-shared/fork-owned-paths";
export { normalizeRepoPath } from "@openlinks/studio-shared/fork-owned-paths";

export const getForkOwnedPathConfig = (): ForkOwnedPathConfig => ({
  directoryPrefixes: [...config.directoryPrefixes],
  exactPaths: [...config.exactPaths],
});

export const isForkOwnedPath = (repoPath: string): boolean =>
  isForkOwnedPathWithConfig(config, repoPath);

export const classifyForkOwnedPaths = (repoPaths: Iterable<string>) =>
  classifyForkOwnedPathsWithConfig(config, repoPaths);
