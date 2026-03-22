import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubRepositoryUrl,
  buildOpenClawBootstrapPrompt,
  buildOpenClawUpdatePrompt,
  buildRawGitHubFileUrl,
  resolveOpenClawPromptDocUrls,
} from "./openclaw-prompts";

test("buildGitHubRepositoryUrl falls back to the upstream repository", () => {
  assert.equal(buildGitHubRepositoryUrl(), "https://github.com/pRizz/open-links");
});

test("buildGitHubRepositoryUrl normalizes supported GitHub repository inputs", () => {
  assert.equal(
    buildGitHubRepositoryUrl("  https://github.com/example/openlinks-fork.git  "),
    "https://github.com/example/openlinks-fork",
  );
});

test("buildRawGitHubFileUrl uses the provided repository slug and ref", () => {
  assert.equal(
    buildRawGitHubFileUrl("docs/openclaw-bootstrap.md", {
      repositoryRef: "release/docs-prompts",
      repositorySlug: "example/openlinks-fork",
    }),
    "https://raw.githubusercontent.com/example/openlinks-fork/release/docs-prompts/docs/openclaw-bootstrap.md",
  );
});

test("buildRawGitHubFileUrl falls back to safe defaults when repository inputs are malformed", () => {
  assert.equal(
    buildRawGitHubFileUrl("/docs/openclaw-bootstrap.md", {
      repositoryRef: "release docs-prompts",
      repositorySlug: "https://example.com/not-github/openlinks-fork",
    }),
    "https://raw.githubusercontent.com/pRizz/open-links/main/docs/openclaw-bootstrap.md",
  );
});

test("resolveOpenClawPromptDocUrls returns raw GitHub doc URLs", () => {
  assert.deepEqual(
    resolveOpenClawPromptDocUrls({
      repositoryRef: "main",
      repositorySlug: "example/openlinks-fork",
    }),
    {
      bootstrapUrl:
        "https://raw.githubusercontent.com/example/openlinks-fork/main/docs/openclaw-bootstrap.md",
      customizationCatalogUrl:
        "https://raw.githubusercontent.com/example/openlinks-fork/main/docs/customization-catalog.md",
      updateCrudUrl:
        "https://raw.githubusercontent.com/example/openlinks-fork/main/docs/openclaw-update-crud.md",
    },
  );
});

test("resolveOpenClawPromptDocUrls trims and normalizes repository inputs", () => {
  assert.deepEqual(
    resolveOpenClawPromptDocUrls({
      repositoryRef: "  release/docs-prompts  ",
      repositorySlug: "  git@github.com:example/openlinks-fork.git  ",
    }),
    {
      bootstrapUrl:
        "https://raw.githubusercontent.com/example/openlinks-fork/release/docs-prompts/docs/openclaw-bootstrap.md",
      customizationCatalogUrl:
        "https://raw.githubusercontent.com/example/openlinks-fork/release/docs-prompts/docs/customization-catalog.md",
      updateCrudUrl:
        "https://raw.githubusercontent.com/example/openlinks-fork/release/docs-prompts/docs/openclaw-update-crud.md",
    },
  );
});

test("buildOpenClawBootstrapPrompt points at absolute doc URLs", () => {
  const prompt = buildOpenClawBootstrapPrompt({
    repositoryRef: "main",
    repositorySlug: "example/openlinks-fork",
  });

  assert.match(
    prompt,
    /^Follow https:\/\/raw\.githubusercontent\.com\/example\/openlinks-fork\/main\/docs\/openclaw-bootstrap\.md exactly/,
  );
  assert.match(
    prompt,
    /switch to https:\/\/raw\.githubusercontent\.com\/example\/openlinks-fork\/main\/docs\/openclaw-update-crud\.md when selected\.$/,
  );
});

test("buildOpenClawBootstrapPrompt falls back to safe defaults when repository inputs are malformed", () => {
  const prompt = buildOpenClawBootstrapPrompt({
    repositoryRef: "release docs-prompts",
    repositorySlug: "https://example.com/not-github/openlinks-fork",
  });

  assert.match(
    prompt,
    /^Follow https:\/\/raw\.githubusercontent\.com\/pRizz\/open-links\/main\/docs\/openclaw-bootstrap\.md exactly/,
  );
});

test("buildOpenClawUpdatePrompt points at absolute doc URLs", () => {
  const prompt = buildOpenClawUpdatePrompt({
    repositoryRef: "main",
    repositorySlug: "example/openlinks-fork",
  });

  assert.match(
    prompt,
    /^Follow https:\/\/raw\.githubusercontent\.com\/example\/openlinks-fork\/main\/docs\/openclaw-update-crud\.md exactly/,
  );
  assert.match(
    prompt,
    /use https:\/\/raw\.githubusercontent\.com\/example\/openlinks-fork\/main\/docs\/customization-catalog\.md as the checklist source\.$/,
  );
});
