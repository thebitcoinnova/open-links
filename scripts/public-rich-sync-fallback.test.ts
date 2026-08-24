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

test("resolves Substack fallback sources from canonical, custom domain, and handle URL", () => {
  // Arrange / Act
  const urls = resolveSubstackPublicHtmlFallbackUrls({
    targetSourceUrl: "https://substack.com/@peterryszkiewicz",
    linkUrl: substackLink.url,
    icon: substackLink.icon,
    metadataHandle: substackLink.metadata.handle,
  });

  // Assert
  assert.deepEqual(urls, [
    "https://substack.com/@peterryszkiewicz",
    "https://peter.ryszkiewicz.us/",
    "https://peterryszkiewicz.substack.com/",
  ]);
});

test("resolves Instagram fallback sources from canonical and link URL", () => {
  // Arrange / Act
  const urls = resolveInstagramPublicHtmlFallbackUrls({
    targetSourceUrl: "https://www.instagram.com/peterryszkiewicz/",
    linkUrl: "https://instagram.com/peterryszkiewicz/",
  });

  // Assert
  assert.deepEqual(urls, [
    "https://www.instagram.com/peterryszkiewicz/",
    "https://instagram.com/peterryszkiewicz/",
  ]);
});

test("maps Instagram public HTML metadata to fallback audience metrics", () => {
  // Arrange / Act
  const metrics = toPublicHtmlFallbackAudienceMetrics("instagram-public-profile", {
    followersCount: 104,
    followersCountRaw: "104 Followers",
    followingCount: 211,
    followingCountRaw: "211 Following",
  });

  // Assert
  assert.deepEqual(metrics, {
    placeholderSignals: [],
    followersCount: 104,
    followersCountRaw: "104 Followers",
    followingCount: 211,
    followingCountRaw: "211 Following",
  });
});
