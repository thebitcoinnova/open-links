import assert from "node:assert/strict";
import test from "node:test";
import { resolveLiveRegionProps, resolveNextTabValue } from "./accessibility";

test("resolveLiveRegionProps maps status messages to a polite live region", () => {
  assert.deepEqual(resolveLiveRegionProps("status"), {
    "aria-live": "polite",
    role: "status",
  });
});

test("resolveLiveRegionProps maps alerts to an assertive live region", () => {
  assert.deepEqual(resolveLiveRegionProps("alert"), {
    "aria-live": "assertive",
    role: "alert",
  });
});

test("resolveNextTabValue cycles through tabs with arrow keys and home/end", () => {
  const tabs = ["profile", "links", "site", "advanced"] as const;

  assert.equal(resolveNextTabValue(tabs, "profile", "ArrowRight"), "links");
  assert.equal(resolveNextTabValue(tabs, "profile", "ArrowLeft"), "advanced");
  assert.equal(resolveNextTabValue(tabs, "links", "Home"), "profile");
  assert.equal(resolveNextTabValue(tabs, "links", "End"), "advanced");
  assert.equal(resolveNextTabValue(tabs, "links", "Enter"), null);
});
