import assert from "node:assert/strict";
import test from "node:test";
import { renderUpstreamSyncCliOutput } from "./upstream-sync-cli-output";

test("renderUpstreamSyncCliOutput separates shared and fork-owned conflicts for mixed blockers", () => {
  const output = renderUpstreamSyncCliOutput({
    conflictingPaths: [
      "AGENTS.md",
      "data/links.json",
      "package.json",
      "public/history/followers/github.csv",
    ],
    forkOwnedConflicts: ["data/links.json", "public/history/followers/github.csv"],
    message:
      "Fork has shared-file conflicts with upstream; manual resolution required (AGENTS.md, package.json).",
    sharedConflicts: ["AGENTS.md", "package.json"],
  });

  assert.match(output, /^Fork has shared-file conflicts with upstream/u);
  assert.match(output, /Shared conflicts: AGENTS\.md, package\.json/u);
  assert.match(
    output,
    /Fork-owned conflicts: data\/links\.json, public\/history\/followers\/github\.csv/u,
  );
  assert.match(output, /shared conflicts are the blocker requiring manual resolution/u);
  assert.doesNotMatch(output, /^Conflicts:/mu);
});

test("renderUpstreamSyncCliOutput only prints shared conflicts when no fork-owned overlap exists", () => {
  const output = renderUpstreamSyncCliOutput({
    conflictingPaths: ["README.md"],
    forkOwnedConflicts: [],
    message:
      "Fork has shared-file conflicts with upstream; manual resolution required (README.md).",
    sharedConflicts: ["README.md"],
  });

  assert.match(output, /Shared conflicts: README\.md/u);
  assert.doesNotMatch(output, /Fork-owned conflicts:/u);
  assert.doesNotMatch(output, /blocker requiring manual resolution/u);
  assert.doesNotMatch(output, /^Conflicts:/mu);
});

test("renderUpstreamSyncCliOutput falls back to generic conflicts when categorized fields are unavailable", () => {
  const output = renderUpstreamSyncCliOutput({
    conflictingPaths: ["README.md", "package.json"],
    message: "Sync failed.",
  });

  assert.match(output, /^Sync failed\./u);
  assert.match(output, /Conflicts: README\.md, package\.json/u);
});

test("renderUpstreamSyncCliOutput keeps push status for publish-capable sync results", () => {
  const output = renderUpstreamSyncCliOutput({
    conflictingPaths: [],
    forkOwnedConflicts: [],
    message: "Synchronized origin/main with upstream/main and pushed the result.",
    pushStatus: "pushed",
    sharedConflicts: [],
  });

  assert.match(output, /^Synchronized origin\/main with upstream\/main and pushed the result\./u);
  assert.match(output, /Push status: pushed/u);
});
