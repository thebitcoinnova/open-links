import assert from "node:assert/strict";
import test from "node:test";
import type { PublicCacheEntry, PublicCacheRegistry } from "./enrichment/public-cache";
import {
  type PublicBrowserAudienceCaptureResult,
  buildPublicRichSyncRunSummary,
  fetchFacebookPageMetrics,
  normalizeFacebookPageMetricsResponse,
  resolveFacebookPageMetricsTarget,
  resolveInstagramPublicHtmlFallbackUrls,
  resolveSubstackPublicHtmlFallbackUrls,
  runPublicRichSyncWithDependencies,
  shouldPublicRichSyncExitWithFailure,
  toPublicHtmlFallbackAudienceMetrics,
} from "./public-rich-sync";

import {
  brightBuildsFacebookLink,
  captureFailure,
  captureSuccess,
  createInstagramBaseEntry,
  createMediumBaseEntry,
  createPrimalBaseEntry,
  createSubstackBaseEntry,
  createXBaseEntry,
  createXCommunityBaseEntry,
  createYoutubeBaseEntry,
  emptyRegistry,
  instagramLink,
  mediumLink,
  primalLink,
  secondMediumLink,
  substackLink,
  xCommunityLink,
  xLink,
  youtubeLink,
} from "./public-rich-sync.test-support";

test("records failure detail in the run summary", () => {
  // Arrange
  const result = {
    dirty: false,
    processed: 3,
    skipped: 1,
    failed: 1,
    fatalFailed: 1,
    entries: [
      {
        linkId: "medium",
        status: "failed" as const,
        reason: "followers_missing",
        artifactPath: "output/playwright/public-rich-sync/medium.json",
        detail: "Medium public browser capture saw placeholder content: cloudflare_challenge.",
        fatal: true,
      },
    ],
  };

  // Act
  const summary = buildPublicRichSyncRunSummary(result);

  // Assert
  assert.deepEqual(summary, result);
});

test("allow-failures suppresses non-zero exit semantics", () => {
  // Arrange
  const failingResult = { failed: 1 };

  // Act / Assert
  assert.equal(shouldPublicRichSyncExitWithFailure(failingResult, false), true);
  assert.equal(shouldPublicRichSyncExitWithFailure(failingResult, true), false);
  assert.equal(shouldPublicRichSyncExitWithFailure({ failed: 0 }, false), false);
});

test("fatal public sync failures exit non-zero even when allow-failures is set", () => {
  // Arrange
  const failingResult = { failed: 1, fatalFailed: 1 };

  // Act / Assert
  assert.equal(shouldPublicRichSyncExitWithFailure(failingResult, true), true);
});

test("deferred public sync failures do not exit non-zero before the final health check", () => {
  // Arrange
  const failingResult = { failed: 1, fatalFailed: 1 };

  // Act / Assert
  assert.equal(shouldPublicRichSyncExitWithFailure(failingResult, false, true), false);
  assert.equal(shouldPublicRichSyncExitWithFailure(failingResult, true, true), false);
});
