import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProviderDeployEnvironment,
  normalizeCanonicalBaseUrl,
  parseProviderDeployTarget,
  resolveProviderDeployPublicOrigin,
} from "./provider-deploy";

test("parseProviderDeployTarget accepts render and railway only", () => {
  // Arrange / Act / Assert
  assert.equal(parseProviderDeployTarget("render"), "render");
  assert.equal(parseProviderDeployTarget("railway"), "railway");
  assert.throws(
    () => parseProviderDeployTarget("github-pages"),
    /Unsupported provider deploy target/u,
  );
});

test("buildProviderDeployEnvironment resolves repository slug from env and render public url", () => {
  // Arrange
  const env = {
    GITHUB_REPOSITORY: "someone/open-links-fork",
    RENDER_EXTERNAL_URL: "https://open-links-fork.onrender.com",
  };

  // Act
  const buildEnv = buildProviderDeployEnvironment("render", { env });

  // Assert
  assert.deepEqual(buildEnv, {
    GITHUB_REPOSITORY: "someone/open-links-fork",
    OPENLINKS_DEPLOY_PUBLIC_ORIGIN: "https://open-links-fork.onrender.com",
    OPENLINKS_DEPLOY_TARGET: "render",
  });
});

test("buildProviderDeployEnvironment falls back to git remote resolution for railway", () => {
  // Arrange
  const env = {
    RAILWAY_PUBLIC_DOMAIN: "open-links-production.up.railway.app",
  };

  // Act
  const buildEnv = buildProviderDeployEnvironment("railway", {
    env,
    runCommandImpl: () => ({
      args: ["remote", "get-url", "origin"],
      command: "git",
      status: 0,
      stderr: "",
      stdout: "git@github.com:someone/open-links-fork.git\n",
    }),
  });

  // Assert
  assert.deepEqual(buildEnv, {
    GITHUB_REPOSITORY: "someone/open-links-fork",
    OPENLINKS_DEPLOY_PUBLIC_ORIGIN: "https://open-links-production.up.railway.app",
    OPENLINKS_DEPLOY_TARGET: "railway",
  });
});

test("resolveProviderDeployPublicOrigin honors explicit override", () => {
  // Arrange / Act / Assert
  assert.equal(
    resolveProviderDeployPublicOrigin("railway", {
      env: {
        OPENLINKS_DEPLOY_PUBLIC_ORIGIN: "https://links.example.com",
        RAILWAY_PUBLIC_DOMAIN: "ignored.up.railway.app",
      },
    }),
    "https://links.example.com",
  );
  assert.equal(
    normalizeCanonicalBaseUrl("https://links.example.com/"),
    "https://links.example.com/",
  );
});
