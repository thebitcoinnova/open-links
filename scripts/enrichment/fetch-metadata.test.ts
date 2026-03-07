import assert from "node:assert/strict";
import test from "node:test";
import { fetchMetadata } from "./fetch-metadata";

test("passes conditional request headers and surfaces 304 revalidation details", async (t) => {
  // Arrange
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("if-none-match"), '"abc123"');
    assert.equal(headers.get("if-modified-since"), "Sat, 07 Mar 2026 12:00:00 GMT");

    return new Response(null, {
      status: 304,
      headers: {
        etag: '"abc123"',
        "cache-control": "max-age=300",
        date: "Sat, 07 Mar 2026 12:05:00 GMT",
      },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Act
  const result = await fetchMetadata("https://example.com/profile", {
    timeoutMs: 1_000,
    retries: 0,
    headers: {
      "if-none-match": '"abc123"',
      "if-modified-since": "Sat, 07 Mar 2026 12:00:00 GMT",
    },
  });

  // Assert
  assert.equal(result.ok, false);
  assert.equal(result.notModified, true);
  assert.equal(result.statusCode, 304);
  assert.equal(result.etag, '"abc123"');
  assert.equal(result.cacheControl, "max-age=300");
  assert.equal(result.responseDate, "Sat, 07 Mar 2026 12:05:00 GMT");
});

test("returns response freshness headers on successful fetches", async (t) => {
  // Arrange
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<html><head><title>Example</title></head></html>", {
      status: 200,
      headers: {
        etag: '"fresh"',
        "last-modified": "Sat, 07 Mar 2026 10:00:00 GMT",
        "cache-control": "max-age=60",
        date: "Sat, 07 Mar 2026 10:00:00 GMT",
      },
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Act
  const result = await fetchMetadata("https://example.com/profile", {
    timeoutMs: 1_000,
    retries: 0,
  });

  // Assert
  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.etag, '"fresh"');
  assert.equal(result.lastModified, "Sat, 07 Mar 2026 10:00:00 GMT");
  assert.equal(result.cacheControl, "max-age=60");
  assert.equal(result.responseDate, "Sat, 07 Mar 2026 10:00:00 GMT");
  assert.match(result.html ?? "", /<title>Example<\/title>/);
});
