import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  type RemoteCachePolicyRegistry,
  loadRemoteCachePolicyRegistry,
  resolveRemoteCachePolicyRule,
} from "./remote-cache-policy";

const TEST_POLICY_REGISTRY: RemoteCachePolicyRegistry = {
  version: 1,
  updatedAt: "2026-03-15T00:00:00.000Z",
  rules: [
    {
      id: "content-images",
      pipelines: ["content_images"],
      domains: ["githubusercontent.com"],
      matchSubdomains: true,
      checkMode: "head_then_get",
      summary: "GitHub-hosted content images.",
      docs: ["scripts/shared/remote-cache-policy.test.ts"],
    },
    {
      id: "public-metadata",
      pipelines: ["public_rich_metadata"],
      domains: ["example.com"],
      matchSubdomains: false,
      checkMode: "conditional_get",
      summary: "Exact-match HTML fetches.",
      docs: ["scripts/shared/remote-cache-policy.test.ts"],
    },
  ],
};

const writeRegistry = (filePath: string, registry: RemoteCachePolicyRegistry) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(registry, null, 2)}\n`);
};

const withTempPolicyFiles = (
  callback: (paths: { localPolicyPath: string; policyPath: string }) => void,
) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "openlinks-remote-cache-policy-"));

  try {
    callback({
      localPolicyPath: path.join(rootDir, "remote-cache-policy.local.json"),
      policyPath: path.join(rootDir, "remote-cache-policy.json"),
    });
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
};

test("matches subdomains when rule coverage allows them", () => {
  // Act
  const match = resolveRemoteCachePolicyRule({
    registry: TEST_POLICY_REGISTRY,
    pipeline: "content_images",
    url: "https://avatars.githubusercontent.com/u/1?v=4",
  });

  // Assert
  assert.equal(match?.rule.id, "content-images");
  assert.equal(match?.matchedDomain, "githubusercontent.com");
  assert.equal(match?.host, "avatars.githubusercontent.com");
});

test("keeps exact-match domains scoped when subdomains are not allowed", () => {
  // Act
  const exactMatch = resolveRemoteCachePolicyRule({
    registry: TEST_POLICY_REGISTRY,
    pipeline: "public_rich_metadata",
    url: "https://example.com/profile",
  });
  const subdomainMiss = resolveRemoteCachePolicyRule({
    registry: TEST_POLICY_REGISTRY,
    pipeline: "public_rich_metadata",
    url: "https://www.example.com/profile",
  });

  // Assert
  assert.equal(exactMatch?.rule.id, "public-metadata");
  assert.equal(subdomainMiss, null);
});

test("loads the shared remote cache policy when no local overlay exists", () => {
  withTempPolicyFiles(({ localPolicyPath, policyPath }) => {
    // Arrange
    writeRegistry(policyPath, TEST_POLICY_REGISTRY);

    // Act
    const registry = loadRemoteCachePolicyRegistry({
      maybeLocalPolicyPath: localPolicyPath,
      policyPath,
    });

    // Assert
    assert.deepEqual(registry, TEST_POLICY_REGISTRY);
  });
});

test("local remote cache policy overlay extends an existing rule", () => {
  withTempPolicyFiles(({ localPolicyPath, policyPath }) => {
    // Arrange
    writeRegistry(policyPath, TEST_POLICY_REGISTRY);
    writeRegistry(localPolicyPath, {
      version: 1,
      updatedAt: "2026-03-16T00:00:00.000Z",
      rules: [
        {
          id: "content-images",
          pipelines: ["content_images"],
          domains: ["example-cdn.test"],
          matchSubdomains: true,
          checkMode: "head_then_get",
          summary: "Fork-only content image host.",
          docs: ["data/policy/remote-cache-policy.local.json"],
        },
      ],
    });

    // Act
    const registry = loadRemoteCachePolicyRegistry({
      maybeLocalPolicyPath: localPolicyPath,
      policyPath,
    });
    const match = resolveRemoteCachePolicyRule({
      registry,
      pipeline: "content_images",
      url: "https://img.example-cdn.test/preview.jpg",
    });

    // Assert
    assert.equal(registry.updatedAt, "2026-03-16T00:00:00.000Z");
    assert.equal(match?.matchedDomain, "example-cdn.test");
    assert.equal(match?.rule.id, "content-images");
    assert.deepEqual(match?.rule.domains, ["example-cdn.test", "githubusercontent.com"]);
    assert.deepEqual(match?.rule.docs, [
      "data/policy/remote-cache-policy.local.json",
      "scripts/shared/remote-cache-policy.test.ts",
    ]);
  });
});

test("local remote cache policy overlay can add a local-only rule", () => {
  withTempPolicyFiles(({ localPolicyPath, policyPath }) => {
    // Arrange
    writeRegistry(policyPath, TEST_POLICY_REGISTRY);
    writeRegistry(localPolicyPath, {
      version: 1,
      updatedAt: "2026-03-16T00:00:00.000Z",
      rules: [
        {
          id: "fork-only-profile-avatar",
          pipelines: ["profile_avatar"],
          domains: ["avatar.example.test"],
          matchSubdomains: false,
          checkMode: "conditional_get",
          summary: "Fork-only avatar host.",
          docs: ["data/policy/remote-cache-policy.local.json"],
        },
      ],
    });

    // Act
    const registry = loadRemoteCachePolicyRegistry({
      maybeLocalPolicyPath: localPolicyPath,
      policyPath,
    });
    const match = resolveRemoteCachePolicyRule({
      registry,
      pipeline: "profile_avatar",
      url: "https://avatar.example.test/profile.png",
    });

    // Assert
    assert.equal(match?.matchedDomain, "avatar.example.test");
    assert.equal(match?.rule.id, "fork-only-profile-avatar");
    assert.equal(match?.rule.checkMode, "conditional_get");
  });
});

test("local remote cache policy overlay rejects incompatible shared rule behavior", () => {
  withTempPolicyFiles(({ localPolicyPath, policyPath }) => {
    // Arrange
    writeRegistry(policyPath, TEST_POLICY_REGISTRY);
    writeRegistry(localPolicyPath, {
      version: 1,
      updatedAt: "2026-03-16T00:00:00.000Z",
      rules: [
        {
          id: "content-images",
          pipelines: ["content_images"],
          domains: ["example-cdn.test"],
          matchSubdomains: true,
          checkMode: "always_get",
          summary: "Fork-only content image host.",
          docs: ["data/policy/remote-cache-policy.local.json"],
        },
      ],
    });

    // Act / Assert
    assert.throws(
      () =>
        loadRemoteCachePolicyRegistry({
          maybeLocalPolicyPath: localPolicyPath,
          policyPath,
        }),
      /Rule 'content-images' must keep the same pipelines, matchSubdomains, and checkMode/u,
    );
  });
});
