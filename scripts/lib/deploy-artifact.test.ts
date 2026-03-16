import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { DeployManifest } from "./deploy-artifact";
import {
  assertArtifactMatchesTarget,
  assertDeployArtifactIntegrity,
  classifyArtifactPath,
  diffDeployManifests,
  getInvalidationPaths,
} from "./deploy-artifact";

test("classifyArtifactPath marks hashed build assets immutable", () => {
  // Arrange / Act / Assert
  assert.equal(classifyArtifactPath("assets/app-abcdef12.js"), "immutable");
  assert.equal(classifyArtifactPath("about/index.html"), "html");
  assert.equal(classifyArtifactPath("robots.txt"), "metadata");
});

test("diffDeployManifests identifies uploads and deletes", () => {
  // Arrange
  const remoteManifest: DeployManifest = {
    artifactHash: "remote",
    basePath: "/",
    canonicalOrigin: "https://openlinks.us",
    files: [
      { cacheClass: "html", path: "index.html", sha256: "one", size: 1 },
      { cacheClass: "immutable", path: "assets/app-abcdef12.js", sha256: "two", size: 2 },
    ],
    publicOrigin: "https://openlinks.us",
    routes: ["/"],
    target: "aws",
    version: 1,
  };
  const localManifest: DeployManifest = {
    ...remoteManifest,
    artifactHash: "local",
    files: [
      { cacheClass: "html", path: "index.html", sha256: "three", size: 3 },
      { cacheClass: "metadata", path: "robots.txt", sha256: "four", size: 4 },
    ],
  };

  // Act
  const diff = diffDeployManifests(localManifest, remoteManifest);

  // Assert
  assert.equal(diff.changed, true);
  assert.deepEqual(
    diff.uploads.map((file) => file.path),
    ["index.html", "robots.txt"],
  );
  assert.deepEqual(diff.deletes, ["assets/app-abcdef12.js"]);
});

test("getInvalidationPaths expands pretty urls and skips immutable assets", () => {
  // Arrange / Act
  const invalidationPaths = getInvalidationPaths([
    "index.html",
    "about/index.html",
    "robots.txt",
    "assets/app-abcdef12.js",
  ]);

  // Assert
  assert.deepEqual(invalidationPaths, [
    "/",
    "/about",
    "/about/",
    "/about/index.html",
    "/index.html",
    "/robots.txt",
  ]);
});

test("assertDeployArtifactIntegrity fails when manifest-listed files are missing", async () => {
  // Arrange
  const artifactDir = await mkdtemp(path.join(tmpdir(), "open-links-deploy-artifact-"));

  try {
    await mkdir(path.join(artifactDir, "assets"), { recursive: true });
    await writeFile(path.join(artifactDir, "index.html"), "<!doctype html>", "utf8");

    const manifest: DeployManifest = {
      artifactHash: "artifact",
      basePath: "/",
      canonicalOrigin: "https://openlinks.us",
      files: [
        { cacheClass: "html", path: "index.html", sha256: "one", size: 1 },
        { cacheClass: "metadata", path: ".nojekyll", sha256: "two", size: 2 },
        { cacheClass: "asset", path: "assets/manifest.json", sha256: "three", size: 3 },
      ],
      publicOrigin: "https://openlinks.us",
      routes: ["/"],
      target: "aws",
      version: 1,
    };

    // Act / Assert
    await assert.rejects(
      assertDeployArtifactIntegrity(artifactDir, manifest),
      /missing 2 file\(s\).*\.nojekyll.*assets\/manifest\.json/su,
    );
  } finally {
    await rm(artifactDir, { force: true, recursive: true });
  }
});

test("assertArtifactMatchesTarget allows external github links on aws artifacts", async () => {
  // Arrange
  const artifactDir = await mkdtemp(path.join(tmpdir(), "open-links-deploy-artifact-"));

  try {
    await writeFile(
      path.join(artifactDir, "index.html"),
      [
        "<!doctype html>",
        '<meta name="robots" content="index, follow">',
        '<link rel="modulepreload" href="/assets/app.js">',
        '<a href="https://github.com/pRizz/open-links/commit/0123456789abcdef">Commit</a>',
      ].join(""),
      "utf8",
    );

    // Act / Assert
    await assert.doesNotReject(() => assertArtifactMatchesTarget(artifactDir, "aws"));
  } finally {
    await rm(artifactDir, { force: true, recursive: true });
  }
});

test("assertArtifactMatchesTarget rejects unprefixed root references for github pages", async () => {
  // Arrange
  const artifactDir = await mkdtemp(path.join(tmpdir(), "open-links-deploy-artifact-"));

  try {
    await writeFile(
      path.join(artifactDir, "index.html"),
      [
        "<!doctype html>",
        '<meta name="robots" content="noindex, nofollow">',
        '<link rel="modulepreload" href="/open-links/assets/app.js">',
        '<img src="/favicon.ico" alt="favicon">',
      ].join(""),
      "utf8",
    );

    // Act / Assert
    await assert.rejects(
      assertArtifactMatchesTarget(artifactDir, "github-pages"),
      /unprefixed root reference/u,
    );
  } finally {
    await rm(artifactDir, { force: true, recursive: true });
  }
});
