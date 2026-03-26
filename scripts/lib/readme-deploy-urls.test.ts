import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReadmeDeployUrlRows,
  replaceReadmeDeployUrlBlock,
  upsertReadmeDeployUrlRow,
} from "./readme-deploy-urls";

const README_FIXTURE = `
before
OPENCLAW_DEPLOY_URLS_START
| target | status | primary_url | additional_urls | evidence |
|--------|--------|-------------|-----------------|----------|
| aws | active | https://openlinks.us | none | Deploy Production -> Deploy AWS Canonical Site |
| github-pages | active | https://prizz.github.io/open-links | canonical=https://openlinks.us | Deploy Production -> Deploy GitHub Pages Mirror |
OPENCLAW_DEPLOY_URLS_END
after
`;

test("parseReadmeDeployUrlRows reads marker-bounded deployment rows", () => {
  // Arrange / Act
  const rows = parseReadmeDeployUrlRows(README_FIXTURE);

  // Assert
  assert.deepEqual(rows, [
    {
      additionalUrls: "none",
      evidence: "Deploy Production -> Deploy AWS Canonical Site",
      primaryUrl: "https://openlinks.us",
      status: "active",
      target: "aws",
    },
    {
      additionalUrls: "canonical=https://openlinks.us",
      evidence: "Deploy Production -> Deploy GitHub Pages Mirror",
      primaryUrl: "https://prizz.github.io/open-links",
      status: "active",
      target: "github-pages",
    },
  ]);
});

test("upsertReadmeDeployUrlRow inserts a render row without touching surrounding content", () => {
  // Arrange / Act
  const updated = upsertReadmeDeployUrlRow(README_FIXTURE, {
    additionalUrls: "canonical=https://prizz.github.io/open-links",
    evidence: "Render -> live /build-info.json",
    primaryUrl: "https://open-links.onrender.com/",
    status: "active",
    target: "render",
  });

  // Assert
  assert.equal(updated.changed, true);
  assert.match(updated.content, /before/u);
  assert.match(updated.content, /after/u);
  assert.match(
    updated.content,
    /\| render \| active \| https:\/\/open-links\.onrender\.com \| canonical=https:\/\/prizz\.github\.io\/open-links \| Render -> live \/build-info\.json \|/u,
  );
});

test("replaceReadmeDeployUrlBlock preserves the stable header and normalizes row order", () => {
  // Arrange / Act
  const updated = replaceReadmeDeployUrlBlock(README_FIXTURE, [
    {
      additionalUrls: "canonical=https://links.example.com",
      evidence: "Railway -> live /build-info.json",
      primaryUrl: "https://open-links.up.railway.app",
      status: "active",
      target: "railway",
    },
    {
      additionalUrls: "none",
      evidence: "Render -> live /build-info.json",
      primaryUrl: "https://links.example.com",
      status: "active",
      target: "render",
    },
    {
      additionalUrls: "canonical=https://links.example.com",
      evidence: "Deploy Production -> Deploy GitHub Pages Mirror",
      primaryUrl: "https://prizz.github.io/open-links",
      status: "active",
      target: "github-pages",
    },
  ]);

  // Assert
  assert.match(
    updated.content,
    /\| github-pages \| active \| https:\/\/prizz\.github\.io\/open-links \| canonical=https:\/\/links\.example\.com \| Deploy Production -> Deploy GitHub Pages Mirror \|\n\| render \| active \| https:\/\/links\.example\.com \| none \| Render -> live \/build-info\.json \|\n\| railway \| active \| https:\/\/open-links\.up\.railway\.app \| canonical=https:\/\/links\.example\.com \| Railway -> live \/build-info\.json \|/u,
  );
});
