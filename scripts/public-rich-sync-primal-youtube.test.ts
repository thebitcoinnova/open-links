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

test("bootstraps a missing Primal cache entry and overlays follower and following counts", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "primal",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [primalLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        return createPrimalBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "primal-public-profile");
        return captureSuccess(
          {
            followersCount: 15,
            followersCountRaw: "15 followers",
            followingCount: 90,
            followingCountRaw: "90 following",
          },
          "output/playwright/public-rich-sync/primal-2026-03-08.json",
        );
      },
      nowIso: () => "2026-03-08T19:30:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(writtenRegistry?.entries.primal?.sourceUrl, "https://primal.net/peterryszkiewicz");
  assert.equal(writtenRegistry?.entries.primal?.metadata.followersCountRaw, "15 followers");
  assert.equal(writtenRegistry?.entries.primal?.metadata.followingCountRaw, "90 following");
});

test("skips Primal sync in only-missing mode when both audience metrics are already cached", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.primal = {
    ...createPrimalBaseEntry(
      "primal",
      "2026-03-08T18:00:00.000Z",
      "https://primal.net/peterryszkiewicz",
    ),
    metadata: {
      ...createPrimalBaseEntry(
        "primal",
        "2026-03-08T18:00:00.000Z",
        "https://primal.net/peterryszkiewicz",
      ).metadata,
      followersCount: 15,
      followersCountRaw: "15 followers",
      followingCount: 90,
      followingCountRaw: "90 following",
    },
  };
  let captureCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "primal",
      onlyMissing: true,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [primalLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureSuccess({
          followersCount: 15,
          followersCountRaw: "15 followers",
          followingCount: 90,
          followingCountRaw: "90 following",
        });
      },
      nowIso: () => "2026-03-08T19:30:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(captureCalls, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.processed, 0);
  assert.deepEqual(result.entries, [
    {
      linkId: "primal",
      status: "skipped",
      reason: "audience_present",
    },
  ]);
});

test("preserves existing Primal metrics when a refresh attempt fails", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.primal = {
    ...createPrimalBaseEntry(
      "primal",
      "2026-03-08T18:00:00.000Z",
      "https://primal.net/peterryszkiewicz",
    ),
    metadata: {
      ...createPrimalBaseEntry(
        "primal",
        "2026-03-08T18:00:00.000Z",
        "https://primal.net/peterryszkiewicz",
      ).metadata,
      followersCount: 15,
      followersCountRaw: "15 followers",
      followingCount: 90,
      followingCountRaw: "90 following",
    },
  };

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "primal",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [primalLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/primal-failed.json",
        metrics: {
          followersCount: 15,
          followersCountRaw: "15 followers",
          placeholderSignals: [],
        },
        error: "Primal public browser capture did not find a following count.",
      }),
      nowIso: () => "2026-03-08T19:31:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.equal(result.registry.entries.primal?.metadata.followersCountRaw, "15 followers");
  assert.equal(result.registry.entries.primal?.metadata.followingCountRaw, "90 following");
  assert.deepEqual(result.entries, [
    {
      linkId: "primal",
      status: "failed",
      reason: "audience_missing",
      artifactPath: "output/playwright/public-rich-sync/primal-failed.json",
      detail: "Primal public browser capture did not find a following count.",
    },
  ]);
});

test("classifies public source 404 errors as fatal profile-unavailable failures", async () => {
  // Arrange
  let captureCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "youtube",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [youtubeLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error(
          "Unable to fetch public augmentation source 'https://www.youtube.com/@missing/about'. HTTP 404",
        );
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        throw new Error("should not capture after bootstrap failure");
      },
      nowIso: () => "2026-03-08T20:00:30.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(captureCalls, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "youtube",
      status: "failed",
      reason: "profile_unavailable",
      detail:
        "Unable to fetch public augmentation source 'https://www.youtube.com/@missing/about'. HTTP 404",
      fatal: true,
    },
  ]);
});

test("bootstraps a missing YouTube cache entry and overlays subscriber counts", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "youtube",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [youtubeLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        assert.equal(target.id, "youtube-public-profile");
        return createYoutubeBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "youtube-public-profile");
        return captureSuccess(
          {
            subscribersCount: 9200,
            subscribersCountRaw: "9.2K subscribers",
          },
          "output/playwright/public-rich-sync/youtube-2026-03-08.json",
        );
      },
      nowIso: () => "2026-03-08T20:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    writtenRegistry?.entries.youtube?.sourceUrl,
    "https://www.youtube.com/@peterryszkiewicz4354/about",
  );
  assert.equal(writtenRegistry?.entries.youtube?.metadata.subscribersCount, 9200);
  assert.equal(writtenRegistry?.entries.youtube?.metadata.subscribersCountRaw, "9.2K subscribers");
});

test("preserves existing YouTube metrics when a refresh attempt fails", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.youtube = {
    ...createYoutubeBaseEntry(
      "youtube",
      "2026-03-08T19:00:00.000Z",
      "https://www.youtube.com/@peterryszkiewicz4354/about",
    ),
    metadata: {
      ...createYoutubeBaseEntry(
        "youtube",
        "2026-03-08T19:00:00.000Z",
        "https://www.youtube.com/@peterryszkiewicz4354/about",
      ).metadata,
      subscribersCount: 9100,
      subscribersCountRaw: "9.1K subscribers",
    },
  };

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "youtube",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [youtubeLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/youtube-failed.json",
        metrics: {
          placeholderSignals: [],
        },
        error: "YouTube public browser capture did not find a subscriber count.",
      }),
      nowIso: () => "2026-03-08T20:01:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.equal(shouldPublicRichSyncExitWithFailure(result, true), false);
  assert.equal(result.registry.entries.youtube?.metadata.subscribersCountRaw, "9.1K subscribers");
  assert.deepEqual(result.entries, [
    {
      linkId: "youtube",
      status: "failed",
      reason: "subscribers_missing",
      artifactPath: "output/playwright/public-rich-sync/youtube-failed.json",
      detail: "YouTube public browser capture did not find a subscriber count.",
    },
  ]);
});
