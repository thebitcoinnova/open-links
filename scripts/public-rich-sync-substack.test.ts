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

test("bootstraps a missing Substack cache entry and overlays subscriber counts", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "substack",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [substackLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        assert.equal(target.id, "substack-public-profile");
        return createSubstackBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "substack-public-profile");
        return captureSuccess(
          {
            subscribersCount: 15,
            subscribersCountRaw: "15 subscribers",
          },
          "output/playwright/public-rich-sync/substack-2026-05-12.json",
        );
      },
      nowIso: () => "2026-05-12T13:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    writtenRegistry?.entries.substack?.sourceUrl,
    "https://substack.com/@peterryszkiewicz",
  );
  assert.equal(writtenRegistry?.entries.substack?.metadata.subscribersCount, 15);
  assert.equal(writtenRegistry?.entries.substack?.metadata.subscribersCountRaw, "15 subscribers");
});

test("treats unchanged Substack subscriber counts as fresh no-op evidence", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.substack = {
    ...createSubstackBaseEntry(
      "substack",
      "2026-05-12T12:00:00.000Z",
      "https://substack.com/@peterryszkiewicz",
    ),
    updatedAt: "2026-05-12T12:00:00.000Z",
    metadata: {
      ...createSubstackBaseEntry(
        "substack",
        "2026-05-12T12:00:00.000Z",
        "https://substack.com/@peterryszkiewicz",
      ).metadata,
      subscribersCount: 15,
      subscribersCountRaw: "15 subscribers",
    },
  };
  let wroteRegistry = false;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "substack",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [substackLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {
        wroteRegistry = true;
      },
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "substack-public-profile");
        return captureSuccess(
          {
            subscribersCount: 15,
            subscribersCountRaw: "15 subscribers",
          },
          "output/playwright/public-rich-sync/substack-unchanged.json",
        );
      },
      nowIso: () => "2026-05-12T13:05:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(wroteRegistry, false);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "substack",
      status: "skipped",
      reason: "counts_unchanged",
    },
  ]);
});

test("recovers unchanged Substack subscribers from public HTML fallback when browser capture misses counts", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.substack = {
    ...createSubstackBaseEntry(
      "substack",
      "2026-05-12T12:00:00.000Z",
      "https://substack.com/@peterryszkiewicz",
    ),
    updatedAt: "2026-05-12T12:00:00.000Z",
    metadata: {
      ...createSubstackBaseEntry(
        "substack",
        "2026-05-12T12:00:00.000Z",
        "https://substack.com/@peterryszkiewicz",
      ).metadata,
      subscribersCount: 15,
      subscribersCountRaw: "15 subscribers",
    },
  };
  let fallbackCaptureArtifact: string | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "substack",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [substackLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/substack-missing-browser-count.json",
        metrics: {
          placeholderSignals: [],
        },
        error: "Substack public browser capture did not find a subscriber count.",
      }),
      fetchFallbackAudienceMetrics: async ({ failedCapture, target }) => {
        fallbackCaptureArtifact = failedCapture.artifactPath;
        assert.equal(target.id, "substack-public-profile");
        return {
          ok: true,
          source: "public-html",
          metrics: {
            placeholderSignals: [],
            subscribersCount: 15,
            subscribersCountRaw: "15 subscribers",
          },
        };
      },
      nowIso: () => "2026-05-16T07:37:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(
    fallbackCaptureArtifact,
    "output/playwright/public-rich-sync/substack-missing-browser-count.json",
  );
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "substack",
      status: "skipped",
      reason: "counts_unchanged",
    },
  ]);
});

test("refreshes Substack subscribers from public HTML fallback when browser capture misses counts", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.substack = {
    ...createSubstackBaseEntry(
      "substack",
      "2026-05-12T12:00:00.000Z",
      "https://substack.com/@peterryszkiewicz",
    ),
    metadata: {
      ...createSubstackBaseEntry(
        "substack",
        "2026-05-12T12:00:00.000Z",
        "https://substack.com/@peterryszkiewicz",
      ).metadata,
      subscribersCount: 15,
      subscribersCountRaw: "15 subscribers",
    },
  };
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "substack",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [substackLink] }),
      loadPublicCache: () => registry,
      writePublicCache: (_path, nextRegistry) => {
        writtenRegistry = JSON.parse(JSON.stringify(nextRegistry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/substack-missing-browser-count.json",
        metrics: {
          placeholderSignals: [],
        },
        error: "Substack public browser capture did not find a subscriber count.",
      }),
      fetchFallbackAudienceMetrics: async () => ({
        ok: true,
        source: "public-html",
        metrics: {
          placeholderSignals: [],
          subscribersCount: 16,
          subscribersCountRaw: "16 subscribers",
        },
      }),
      nowIso: () => "2026-05-16T07:37:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 0);
  assert.equal(result.dirty, true);
  assert.equal(result.registry.entries.substack?.metadata.subscribersCount, 16);
  assert.equal(writtenRegistry?.entries.substack?.metadata.subscribersCountRaw, "16 subscribers");
  assert.deepEqual(result.entries, [
    {
      linkId: "substack",
      status: "synced",
      reason: "counts_refreshed",
      artifactPath: "output/playwright/public-rich-sync/substack-missing-browser-count.json",
    },
  ]);
});

test("preserves existing Substack metrics when a refresh attempt is blocked", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.substack = {
    ...createSubstackBaseEntry(
      "substack",
      "2026-05-12T12:00:00.000Z",
      "https://substack.com/@peterryszkiewicz",
    ),
    metadata: {
      ...createSubstackBaseEntry(
        "substack",
        "2026-05-12T12:00:00.000Z",
        "https://substack.com/@peterryszkiewicz",
      ).metadata,
      subscribersCount: 15,
      subscribersCountRaw: "15 subscribers",
    },
  };

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "substack",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [substackLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/substack-blocked.json",
        metrics: {
          placeholderSignals: ["access_denied"],
        },
        error: "Substack public browser capture saw placeholder content: access_denied.",
      }),
      nowIso: () => "2026-05-12T13:10:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.equal(shouldPublicRichSyncExitWithFailure(result, true), false);
  assert.equal(result.registry.entries.substack?.metadata.subscribersCountRaw, "15 subscribers");
  assert.deepEqual(result.entries, [
    {
      linkId: "substack",
      status: "failed",
      reason: "subscribers_missing",
      artifactPath: "output/playwright/public-rich-sync/substack-blocked.json",
      detail: "Substack public browser capture saw placeholder content: access_denied.",
    },
  ]);
});
