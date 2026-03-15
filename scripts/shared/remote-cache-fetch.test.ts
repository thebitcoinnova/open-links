import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRemoteCachePolicy } from "./remote-cache-fetch";
import type { RemoteCachePolicyRegistry } from "./remote-cache-policy";

const TEST_POLICY_REGISTRY: RemoteCachePolicyRegistry = {
  version: 1,
  updatedAt: "2026-03-15T00:00:00.000Z",
  rules: [
    {
      id: "head-images",
      pipelines: ["content_images"],
      domains: ["example.com"],
      matchSubdomains: true,
      checkMode: "head_then_get",
      summary: "HEAD-first image revalidation.",
      docs: ["scripts/shared/remote-cache-fetch.test.ts"],
    },
    {
      id: "conditional-metadata",
      pipelines: ["public_rich_metadata"],
      domains: ["example.com"],
      matchSubdomains: true,
      checkMode: "conditional_get",
      summary: "Conditional GET metadata revalidation.",
      docs: ["scripts/shared/remote-cache-fetch.test.ts"],
    },
  ],
};

test("head_then_get skips GET when HEAD proves the cached asset is unchanged", async (t) => {
  // Arrange
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    methods.push(init?.method ?? "GET");
    return new Response(null, {
      status: 200,
      headers: {
        etag: '"avatar-1"',
        "cache-control": "max-age=300",
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Act
  const result = await fetchWithRemoteCachePolicy({
    url: "https://example.com/avatar.jpg",
    pipeline: "content_images",
    policyRegistry: TEST_POLICY_REGISTRY,
    timeoutMs: 1_000,
    userAgent: "test-agent",
    bodyType: "buffer",
    previous: {
      etag: '"avatar-1"',
      bytes: 321,
    },
    cacheValueAvailable: true,
  });

  // Assert
  assert.equal(result.kind, "not_modified");
  assert.equal(result.method, "HEAD");
  assert.equal(result.checkStatus, "head_unchanged");
  assert.equal(result.bytesSkipped, 321);
  assert.deepEqual(methods, ["HEAD"]);
});

test("head_then_get falls back to conditional GET when HEAD is unsupported", async (t) => {
  // Arrange
  const originalFetch = globalThis.fetch;
  const seenMethods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const method = init?.method ?? "GET";
    seenMethods.push(method);
    const headers = new Headers(init?.headers);

    if (method === "HEAD") {
      return new Response(null, { status: 405 });
    }

    assert.equal(headers.get("if-none-match"), '"asset-1"');
    assert.equal(headers.get("if-modified-since"), "Sat, 07 Mar 2026 12:00:00 GMT");
    return new Response("fresh-body", {
      status: 200,
      headers: {
        etag: '"asset-2"',
        "content-type": "text/plain",
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Act
  const result = await fetchWithRemoteCachePolicy({
    url: "https://example.com/file.txt",
    pipeline: "content_images",
    policyRegistry: TEST_POLICY_REGISTRY,
    timeoutMs: 1_000,
    userAgent: "test-agent",
    bodyType: "text",
    previous: {
      etag: '"asset-1"',
      lastModified: "Sat, 07 Mar 2026 12:00:00 GMT",
    },
    cacheValueAvailable: true,
  });

  // Assert
  assert.equal(result.kind, "fetched");
  assert.equal(result.attemptedHead, true);
  assert.equal(result.headFallbackReason, "status_not_ok");
  assert.deepEqual(seenMethods, ["HEAD", "GET"]);
});

test("head_then_get falls back to GET when HEAD omits validators", async (t) => {
  // Arrange
  const originalFetch = globalThis.fetch;
  let getCalls = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "HEAD") {
      return new Response(null, { status: 200 });
    }

    getCalls += 1;
    return new Response("image-bytes", {
      status: 200,
      headers: {
        "content-type": "text/plain",
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Act
  const result = await fetchWithRemoteCachePolicy({
    url: "https://example.com/file.txt",
    pipeline: "content_images",
    policyRegistry: TEST_POLICY_REGISTRY,
    timeoutMs: 1_000,
    userAgent: "test-agent",
    bodyType: "text",
    previous: {
      etag: '"asset-1"',
    },
    cacheValueAvailable: true,
  });

  // Assert
  assert.equal(result.kind, "fetched");
  assert.equal(result.headFallbackReason, "missing_validators");
  assert.equal(getCalls, 1);
});

test("conditional_get returns not_modified on HTTP 304", async (t) => {
  // Arrange
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("if-none-match"), '"meta-1"');
    return new Response(null, {
      status: 304,
      headers: {
        etag: '"meta-1"',
        "cache-control": "max-age=300",
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Act
  const result = await fetchWithRemoteCachePolicy({
    url: "https://example.com/profile",
    pipeline: "public_rich_metadata",
    policyRegistry: TEST_POLICY_REGISTRY,
    timeoutMs: 1_000,
    userAgent: "test-agent",
    bodyType: "text",
    previous: {
      etag: '"meta-1"',
      bytes: 123,
    },
    cacheValueAvailable: true,
  });

  // Assert
  assert.equal(result.kind, "not_modified");
  assert.equal(result.method, "GET");
  assert.equal(result.checkStatus, "get_not_modified");
  assert.equal(result.bytesSkipped, 123);
});
