import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicPageView } from "./public-page-view";

test("resolvePublicPageView maps false to links", () => {
  assert.equal(resolvePublicPageView(false), "links");
});

test("resolvePublicPageView maps true to analytics", () => {
  assert.equal(resolvePublicPageView(true), "analytics");
});
