import assert from "node:assert/strict";
import test from "node:test";
import { buildSetupChildCommands, resolveRequestedTargets } from "./deployment-command-plan";

test("buildSetupChildCommands selects aws and github setup for aws-primary topologies", () => {
  // Arrange / Act
  const commands = buildSetupChildCommands(
    ["aws", "github-pages"],
    {
      repo: "someone/open-links-fork",
      "role-arn": "arn:aws:iam::123456789012:role/open-links-test",
    },
    "apply",
  );

  // Assert
  assert.deepEqual(commands, [
    {
      command: [
        "bun",
        "run",
        "scripts/deploy/setup-github.ts",
        "--check-access",
        "--repo=someone/open-links-fork",
        "--role-arn=arn:aws:iam::123456789012:role/open-links-test",
      ],
      label: "GitHub admin preflight",
    },
    {
      command: [
        "bun",
        "run",
        "scripts/deploy/setup-aws.ts",
        "--apply",
        "--repo=someone/open-links-fork",
      ],
      label: "AWS setup",
    },
    {
      command: [
        "bun",
        "run",
        "scripts/deploy/setup-github.ts",
        "--apply",
        "--repo=someone/open-links-fork",
        "--role-arn=arn:aws:iam::123456789012:role/open-links-test",
      ],
      label: "GitHub setup",
    },
  ]);
});

test("buildSetupChildCommands selects only github setup for pages-only topologies", () => {
  // Arrange / Act
  const commands = buildSetupChildCommands(["github-pages"], {}, "check");

  // Assert
  assert.deepEqual(commands, [
    {
      command: ["bun", "run", "scripts/deploy/setup-github.ts", "--check-access"],
      label: "GitHub admin preflight",
    },
    {
      command: ["bun", "run", "scripts/deploy/setup-github.ts"],
      label: "GitHub setup",
    },
  ]);
});

test("buildSetupChildCommands skips remote setup for provider-only topologies", () => {
  // Arrange / Act / Assert
  assert.deepEqual(buildSetupChildCommands(["render"], {}, "check"), []);
  assert.deepEqual(buildSetupChildCommands(["railway"], {}, "check"), []);
});

test("resolveRequestedTargets parses comma-separated explicit targets", () => {
  // Arrange / Act / Assert
  assert.deepEqual(resolveRequestedTargets("aws, github-pages"), ["aws", "github-pages"]);
  assert.deepEqual(resolveRequestedTargets(undefined), []);
});
