import assert from "node:assert/strict";
import test from "node:test";
import {
  type RemoteCachePolicyRegistry,
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
