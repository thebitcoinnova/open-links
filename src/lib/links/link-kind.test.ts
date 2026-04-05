import assert from "node:assert/strict";
import test from "node:test";
import { resolveLinkKind } from "./link-kind";

test("resolveLinkKind treats the Strike icon alias as a known site", () => {
  // Act
  const resolved = resolveLinkKind("strike");

  // Assert
  assert.equal(resolved.kind, "known-site");
  assert.equal(resolved.site.id, "strike");
});

test("resolveLinkKind resolves strike.me URLs as the Strike known site", () => {
  // Act
  const resolved = resolveLinkKind(undefined, "https://strike.me/pryszkie");

  // Assert
  assert.equal(resolved.kind, "known-site");
  assert.equal(resolved.site.id, "strike");
  assert.equal(resolved.scheme, "https");
});

test("resolveLinkKind treats the Lemonade icon alias as a known site", () => {
  // Act
  const resolved = resolveLinkKind("lemonade");

  // Assert
  assert.equal(resolved.kind, "known-site");
  assert.equal(resolved.site.id, "lemonade");
});

test("resolveLinkKind resolves lemonade.com referral URLs as the Lemonade known site", () => {
  // Act
  const resolved = resolveLinkKind(undefined, "https://www.lemonade.com/r/pryszkie");

  // Assert
  assert.equal(resolved.kind, "known-site");
  assert.equal(resolved.site.id, "lemonade");
  assert.equal(resolved.scheme, "https");
});
