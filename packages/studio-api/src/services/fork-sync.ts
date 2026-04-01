import {
  buildForkOwnedPreservationTree as buildForkOwnedPreservationTreeWithConfig,
  describeSharedForkSyncConflicts,
  summarizeForkSyncConflicts as summarizeForkSyncConflictsWithConfig,
} from "@openlinks/studio-shared/fork-sync";
import { getForkOwnedPathConfig } from "./fork-owned-paths.js";

export type {
  ForkSyncConflictSummary,
  ForkSyncTreeEntry,
  ForkSyncTreeMode,
  ForkSyncTreeType,
} from "@openlinks/studio-shared/fork-sync";
export { describeSharedForkSyncConflicts } from "@openlinks/studio-shared/fork-sync";

export const summarizeForkSyncConflicts = (input: {
  forkChangedPaths: Iterable<string>;
  upstreamChangedPaths: Iterable<string>;
}) =>
  summarizeForkSyncConflictsWithConfig({
    ...input,
    config: getForkOwnedPathConfig(),
  });

export const buildForkOwnedPreservationTree = (input: {
  forkTree: readonly import("@openlinks/studio-shared/fork-sync").ForkSyncTreeEntry[];
  upstreamTree: readonly import("@openlinks/studio-shared/fork-sync").ForkSyncTreeEntry[];
}) =>
  buildForkOwnedPreservationTreeWithConfig({
    ...input,
    config: getForkOwnedPathConfig(),
  });
