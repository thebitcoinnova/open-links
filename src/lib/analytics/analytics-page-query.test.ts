import assert from "node:assert/strict";
import test from "node:test";
import { readAnalyticsPageStateFromUrl } from "./analytics-page-query";

test("readAnalyticsPageStateFromUrl returns true for the analytics query flag", () => {
  assert.equal(readAnalyticsPageStateFromUrl(new URL("https://openlinks.us/?analytics=all")), true);
});

test("readAnalyticsPageStateFromUrl ignores other analytics query values", () => {
  assert.equal(
    readAnalyticsPageStateFromUrl(new URL("https://openlinks.us/?analytics=30d")),
    false,
  );
});

test("readAnalyticsPageStateFromUrl ignores unrelated query params", () => {
  assert.equal(
    readAnalyticsPageStateFromUrl(new URL("https://openlinks.us/?view=analytics")),
    false,
  );
});
