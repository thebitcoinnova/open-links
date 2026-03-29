import { describe, expect, test } from "bun:test";
import {
  type ForkSyncTreeEntry,
  buildForkOwnedPreservationTree,
  summarizeForkSyncConflicts,
} from "../../src/services/fork-sync.js";

describe("fork sync helpers", () => {
  test("auto-resolves conflicts when only fork-owned paths overlap", () => {
    expect(
      summarizeForkSyncConflicts({
        forkChangedPaths: ["data/profile.json", "public/cache/content-images/avatar.png"],
        upstreamChangedPaths: ["data/profile.json", "src/lib/deployment-config.ts"],
      }),
    ).toEqual({
      canAutoResolve: true,
      conflictingPaths: ["data/profile.json"],
      forkOwnedConflicts: ["data/profile.json"],
      sharedConflicts: [],
    });
  });

  test("requires manual resolution when shared paths conflict", () => {
    expect(
      summarizeForkSyncConflicts({
        forkChangedPaths: ["data/profile.json", "src/lib/deployment-config.ts"],
        upstreamChangedPaths: ["src/lib/deployment-config.ts"],
      }),
    ).toEqual({
      canAutoResolve: false,
      conflictingPaths: ["src/lib/deployment-config.ts"],
      forkOwnedConflicts: [],
      sharedConflicts: ["src/lib/deployment-config.ts"],
    });
  });

  test("preserves fork-owned files from the fork tree and deletes missing fork-owned upstream files", () => {
    const upstreamTree: ForkSyncTreeEntry[] = [
      {
        mode: "100644",
        path: "data/profile.json",
        sha: "upstream-profile",
        type: "blob",
      },
      {
        mode: "100644",
        path: "public/cache/content-images/stale.png",
        sha: "upstream-image",
        type: "blob",
      },
      {
        mode: "100644",
        path: "src/lib/deployment-config.ts",
        sha: "upstream-shared",
        type: "blob",
      },
    ];

    const forkTree: ForkSyncTreeEntry[] = [
      {
        mode: "100644",
        path: "data/profile.json",
        sha: "fork-profile",
        type: "blob",
      },
      {
        mode: "100644",
        path: "public/cache/content-images/fresh.png",
        sha: "fork-image",
        type: "blob",
      },
      {
        mode: "100644",
        path: "src/lib/deployment-config.ts",
        sha: "fork-shared",
        type: "blob",
      },
    ];

    expect(buildForkOwnedPreservationTree({ forkTree, upstreamTree })).toEqual([
      {
        mode: "100644",
        path: "data/profile.json",
        sha: "fork-profile",
        type: "blob",
      },
      {
        mode: "100644",
        path: "public/cache/content-images/fresh.png",
        sha: "fork-image",
        type: "blob",
      },
      {
        mode: "100644",
        path: "public/cache/content-images/stale.png",
        sha: null,
        type: "blob",
      },
    ]);
  });
});
