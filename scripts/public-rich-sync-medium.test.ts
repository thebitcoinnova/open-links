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

test("bootstraps a missing Medium cache entry and overlays follower counts", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [mediumLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        return createMediumBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async () =>
        captureSuccess({
          followersCount: 3300,
          followersCountRaw: "3.3K followers",
        }),
      nowIso: () => "2026-03-08T15:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    writtenRegistry?.entries.medium?.sourceUrl,
    "https://medium.com/feed/@peterryszkiewicz",
  );
  assert.equal(writtenRegistry?.entries.medium?.metadata.followersCount, 3300);
  assert.equal(writtenRegistry?.entries.medium?.metadata.followersCountRaw, "3.3K followers");
});

test("refreshes Medium counts without replacing the existing base cache entry fields", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.medium = {
    ...createMediumBaseEntry(
      "medium",
      "2026-03-08T13:00:00.000Z",
      "https://medium.com/feed/@peterryszkiewicz",
    ),
    metadata: {
      ...createMediumBaseEntry(
        "medium",
        "2026-03-08T13:00:00.000Z",
        "https://medium.com/feed/@peterryszkiewicz",
      ).metadata,
      followersCount: 3100,
      followersCountRaw: "3.1K followers",
    },
  };
  let bootstrapCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [mediumLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        bootstrapCalls += 1;
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () =>
        captureSuccess({
          followersCount: 3400,
          followersCountRaw: "3.4K followers",
        }),
      nowIso: () => "2026-03-08T16:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 0);
  assert.equal(result.registry.entries.medium?.capturedAt, "2026-03-08T13:00:00.000Z");
  assert.equal(result.registry.entries.medium?.updatedAt, "2026-03-08T16:00:00.000Z");
  assert.equal(result.registry.entries.medium?.cacheControl, "private, max-age=900");
  assert.equal(
    result.registry.entries.medium?.metadata.title,
    "Stories by Peter Ryszkiewicz on Medium",
  );
  assert.equal(result.registry.entries.medium?.metadata.followersCountRaw, "3.4K followers");
});

test("treats unchanged Medium counts as a no-op without rewriting cache timestamps", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.medium = {
    ...createMediumBaseEntry(
      "medium",
      "2026-03-08T13:00:00.000Z",
      "https://medium.com/feed/@peterryszkiewicz",
    ),
    updatedAt: "2026-03-08T14:00:00.000Z",
    metadata: {
      ...createMediumBaseEntry(
        "medium",
        "2026-03-08T13:00:00.000Z",
        "https://medium.com/feed/@peterryszkiewicz",
      ).metadata,
      followersCount: 3400,
      followersCountRaw: "3.4K followers",
    },
  };
  let wroteRegistry = false;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [mediumLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {
        wroteRegistry = true;
      },
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () =>
        captureSuccess({
          followersCount: 3400,
          followersCountRaw: "3.4K followers",
        }),
      nowIso: () => "2026-03-08T16:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(wroteRegistry, false);
  assert.equal(result.skipped, 1);
  assert.equal(result.processed, 1);
  assert.equal(result.registry.entries.medium?.capturedAt, "2026-03-08T13:00:00.000Z");
  assert.equal(result.registry.entries.medium?.updatedAt, "2026-03-08T14:00:00.000Z");
  assert.deepEqual(result.entries, [
    {
      linkId: "medium",
      status: "skipped",
      reason: "counts_unchanged",
    },
  ]);
});

test("skips Medium sync in only-missing mode when followers are already cached", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.medium = {
    ...createMediumBaseEntry(
      "medium",
      "2026-03-08T13:00:00.000Z",
      "https://medium.com/feed/@peterryszkiewicz",
    ),
    metadata: {
      ...createMediumBaseEntry(
        "medium",
        "2026-03-08T13:00:00.000Z",
        "https://medium.com/feed/@peterryszkiewicz",
      ).metadata,
      followersCount: 3300,
      followersCountRaw: "3.3K followers",
    },
  };
  let captureCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyMissing: true,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [mediumLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureSuccess({
          followersCount: 3300,
          followersCountRaw: "3.3K followers",
        });
      },
      nowIso: () => "2026-03-08T16:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.skipped, 1);
  assert.equal(result.processed, 0);
  assert.equal(captureCalls, 0);
  assert.deepEqual(result.entries, [
    {
      linkId: "medium",
      status: "skipped",
      reason: "followers_present",
    },
  ]);
});

test("force mode overrides only-missing and only-link filters to target the selected Medium link", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries["medium-two"] = {
    ...createMediumBaseEntry(
      "medium-two",
      "2026-03-08T13:00:00.000Z",
      "https://medium.com/feed/@anotherperson",
      "anotherperson",
    ),
    metadata: {
      ...createMediumBaseEntry(
        "medium-two",
        "2026-03-08T13:00:00.000Z",
        "https://medium.com/feed/@anotherperson",
        "anotherperson",
      ).metadata,
      followersCount: 900,
      followersCountRaw: "900 followers",
    },
  };
  let capturedLinkId: string | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "medium-two",
      onlyMissing: true,
      force: true,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [mediumLink, secondMediumLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async ({ link, target, generatedAt }) =>
        createMediumBaseEntry(
          link.id,
          generatedAt,
          target.sourceUrl,
          link.metadata?.handle as string,
        ),
      captureAudienceMetrics: async ({ link }) => {
        capturedLinkId = link.id;
        return captureSuccess({
          followersCount: 901,
          followersCountRaw: "901 followers",
        });
      },
      nowIso: () => "2026-03-08T16:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(capturedLinkId, "medium-two");
  assert.equal(result.processed, 1);
  assert.equal(result.registry.entries.medium?.metadata.followersCountRaw, undefined);
  assert.equal(result.registry.entries["medium-two"]?.metadata.followersCountRaw, "901 followers");
});
