import assert from "node:assert/strict";
import test from "node:test";
import type { SiteData } from "../content/load-content";
import {
  resolveAnalyticsNavigationVisible,
  resolveAnalyticsPageEnabled,
  resolveAnalyticsPageOpenState,
} from "./analytics-page-preferences";

const baseSite = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "sleek",
    available: ["sleek", "daybreak"],
  },
} as const satisfies SiteData;

test("resolveAnalyticsPageEnabled defaults to true when the setting is omitted", () => {
  assert.equal(resolveAnalyticsPageEnabled(baseSite), true);
});

test("resolveAnalyticsPageEnabled respects an explicit disabled setting", () => {
  const site = {
    ...baseSite,
    ui: {
      analytics: {
        pageEnabled: false,
      },
    },
  } as const satisfies SiteData;

  assert.equal(resolveAnalyticsPageEnabled(site), false);
});

test("resolveAnalyticsPageOpenState blocks analytics when the page is disabled", () => {
  assert.equal(resolveAnalyticsPageOpenState(true, false), false);
  assert.equal(resolveAnalyticsPageOpenState(true, true), true);
});

test("resolveAnalyticsNavigationVisible shows analytics navigation only when the page is enabled", () => {
  assert.equal(
    resolveAnalyticsNavigationVisible({
      analyticsAvailable: true,
      analyticsPageEnabled: true,
      analyticsPageOpen: false,
    }),
    true,
  );

  assert.equal(
    resolveAnalyticsNavigationVisible({
      analyticsAvailable: true,
      analyticsPageEnabled: false,
      analyticsPageOpen: false,
    }),
    false,
  );
});
