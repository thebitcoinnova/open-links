import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildOpenClawBootstrapPrompt,
  buildOpenClawUpdatePrompt,
} from "../src/lib/openclaw-prompts";
import {
  OPENCLAW_BOOTSTRAP_PROMPT_MARKER,
  OPENCLAW_UPDATE_PROMPT_MARKER,
  type OpenClawPromptSyncTarget,
  renderManagedPromptBlock,
  replaceManagedPromptBlock,
  syncOpenClawPrompts,
} from "./sync-openclaw-prompts";

const TEST_REPOSITORY = {
  repositoryRef: "release/docs-prompts",
  repositorySlug: "example/openlinks-fork",
} as const;

const createTempRoot = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-prompts-"));

const writeTextFile = (rootDir: string, relativePath: string, content: string): void => {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
};

const readTextFile = (rootDir: string, relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const createTarget = (
  filePath: string,
  blockKinds: OpenClawPromptSyncTarget["blockKinds"],
): OpenClawPromptSyncTarget => ({
  filePath,
  blockKinds: [...blockKinds],
});

test("replaceManagedPromptBlock updates bootstrap marker blocks", () => {
  // Arrange
  const staleContent = [
    "# Prompt",
    "",
    renderManagedPromptBlock(OPENCLAW_BOOTSTRAP_PROMPT_MARKER, "stale prompt"),
    "",
    "Keep this prose.",
  ].join("\n");

  // Act
  const replacement = replaceManagedPromptBlock(
    staleContent,
    OPENCLAW_BOOTSTRAP_PROMPT_MARKER,
    buildOpenClawBootstrapPrompt(TEST_REPOSITORY),
  );

  // Assert
  assert.equal(replacement.changed, true);
  assert.match(replacement.content, /Keep this prose\./u);
  assert.match(
    replacement.content,
    /Follow https:\/\/raw\.githubusercontent\.com\/example\/openlinks-fork\/release\/docs-prompts\/docs\/openclaw-bootstrap\.md exactly/u,
  );
});

test("syncOpenClawPrompts updates bootstrap and update prompt blocks", () => {
  // Arrange
  const rootDir = createTempRoot();
  writeTextFile(
    rootDir,
    "README.md",
    [
      "# README",
      "",
      renderManagedPromptBlock(OPENCLAW_BOOTSTRAP_PROMPT_MARKER, "stale bootstrap prompt"),
      "",
      renderManagedPromptBlock(OPENCLAW_UPDATE_PROMPT_MARKER, "stale update prompt"),
      "",
    ].join("\n"),
  );

  // Act
  const changedFiles = syncOpenClawPrompts({
    rootDir,
    targets: [createTarget("README.md", ["bootstrap", "update"])],
    ...TEST_REPOSITORY,
  });

  // Assert
  assert.deepEqual(changedFiles, ["README.md"]);
  const syncedContent = readTextFile(rootDir, "README.md");
  assert.equal(syncedContent.includes(buildOpenClawBootstrapPrompt(TEST_REPOSITORY)), true);
  assert.equal(syncedContent.includes(buildOpenClawUpdatePrompt(TEST_REPOSITORY)), true);
});

test("syncOpenClawPrompts is a no-op when prompt blocks are already synchronized", () => {
  // Arrange
  const rootDir = createTempRoot();
  const bootstrapPrompt = buildOpenClawBootstrapPrompt(TEST_REPOSITORY);
  writeTextFile(
    rootDir,
    "docs/quickstart.md",
    renderManagedPromptBlock(OPENCLAW_BOOTSTRAP_PROMPT_MARKER, bootstrapPrompt),
  );

  // Act
  const changedFiles = syncOpenClawPrompts({
    rootDir,
    targets: [createTarget("docs/quickstart.md", ["bootstrap"])],
    ...TEST_REPOSITORY,
  });

  // Assert
  assert.deepEqual(changedFiles, []);
});

test("syncOpenClawPrompts check mode fails when prompt blocks drift", () => {
  // Arrange
  const rootDir = createTempRoot();
  writeTextFile(
    rootDir,
    "docs/openclaw-update-crud.md",
    renderManagedPromptBlock(OPENCLAW_UPDATE_PROMPT_MARKER, "stale update prompt"),
  );

  // Act / Assert
  assert.throws(
    () =>
      syncOpenClawPrompts({
        check: true,
        rootDir,
        targets: [createTarget("docs/openclaw-update-crud.md", ["update"])],
        ...TEST_REPOSITORY,
      }),
    /OpenClaw prompt blocks are out of sync/u,
  );
  assert.match(readTextFile(rootDir, "docs/openclaw-update-crud.md"), /stale update prompt/u);
});

test("replaceManagedPromptBlock rejects missing marker pairs", () => {
  // Arrange / Act / Assert
  assert.throws(
    () =>
      replaceManagedPromptBlock(
        "<!-- OPENCLAW_BOOTSTRAP_PROMPT:start -->\n```text\nstale prompt\n```",
        OPENCLAW_BOOTSTRAP_PROMPT_MARKER,
        buildOpenClawBootstrapPrompt(TEST_REPOSITORY),
      ),
    /Unable to find marker block/u,
  );
});
