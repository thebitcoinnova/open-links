import assert from "node:assert/strict";
import test from "node:test";
import { resolveLiveRegionProps } from "./accessibility";

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
