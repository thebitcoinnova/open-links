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

test("retries nonfatal browser capture failures with the default delayed retry budget", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.medium = createMediumBaseEntry(
    "medium",
    "2026-03-08T13:00:00.000Z",
    "https://medium.com/feed/@peterryszkiewicz",
  );
  const retryDelays: number[] = [];
  let captureCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "medium",
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
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        if (captureCalls === 1) {
          return captureFailure(
            "Medium public browser capture saw placeholder content: cloudflare_challenge.",
            { placeholderSignals: ["cloudflare_challenge"] },
            "output/playwright/public-rich-sync/medium-first.json",
          );
        }

        return captureSuccess(
          {
            followersCount: 3300,
            followersCountRaw: "3.3K followers",
          },
          "output/playwright/public-rich-sync/medium-second.json",
        );
      },
      nowIso: () => "2026-05-24T09:15:00.000Z",
      log: () => {},
      sleep: async (milliseconds) => {
        retryDelays.push(milliseconds);
      },
    },
  );

  // Assert
  assert.equal(captureCalls, 2);
  assert.deepEqual(retryDelays, [120000]);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "medium",
      status: "synced",
      reason: "counts_refreshed",
      artifactPath: "output/playwright/public-rich-sync/medium-second.json",
      attempts: 2,
    },
  ]);
});

test("source rename stages a fresh base and preserves the old cache until audience capture succeeds", async () => {
  // Arrange
  const renamedMediumLink = {
    ...mediumLink,
    url: "https://medium.com/@renamedperson",
    metadata: {
      handle: "renamedperson",
    },
  };
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
    etag: '"old-handle"',
  };
  const oldEntry = structuredClone(registry.entries.medium);
  let bootstrapCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "medium",
      onlyMissing: true,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [renamedMediumLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {
        throw new Error("failed capture must not replace the old cache identity");
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        return createMediumBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async () =>
        captureFailure("renamed profile audience was temporarily unavailable", {}),
      nowIso: () => "2026-07-23T12:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.registry.entries.medium, oldEntry);
});

test("successful source rename publishes only the fresh identity and new audience data", async () => {
  // Arrange
  const renamedMediumLink = {
    ...mediumLink,
    url: "https://medium.com/@renamedperson",
    metadata: {
      handle: "renamedperson",
    },
  };
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
    etag: '"old-handle"',
    lastModified: "Wed, 08 Mar 2026 13:00:00 GMT",
  };

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "medium",
      onlyMissing: true,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [renamedMediumLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => ({
        ...createMediumBaseEntry(link.id, generatedAt, target.sourceUrl),
        metadata: {
          title: "Renamed Person on Medium",
          description: "Fresh profile metadata.",
          image: "https://cdn-images-1.medium.com/renamed.jpg",
          profileImage: "https://cdn-images-1.medium.com/renamed.jpg",
          handle: "renamedperson",
          sourceLabel: "medium.com",
        },
      }),
      captureAudienceMetrics: async () =>
        captureSuccess({
          followersCount: 25,
          followersCountRaw: "25 followers",
        }),
      nowIso: () => "2026-07-23T12:05:00.000Z",
      log: () => {},
    },
  );

  // Assert
  const entry = result.registry.entries.medium;
  assert.equal(result.failed, 0);
  assert.equal(entry?.sourceUrl, "https://medium.com/feed/@renamedperson");
  assert.equal(entry?.capturedAt, "2026-07-23T12:05:00.000Z");
  assert.equal(entry?.metadata.handle, "renamedperson");
  assert.equal(entry?.metadata.followersCount, 25);
  assert.equal(entry?.metadata.followersCountRaw, "25 followers");
  assert.equal(entry?.etag, undefined);
  assert.equal(entry?.lastModified, undefined);
  assert.equal(result.entries[0]?.reason, "bootstrapped_and_refreshed");
});

test("retries nonfatal bootstrap sync errors before capturing audience metrics", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let captureCalls = 0;
  const retryDelays: number[] = [];

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "instagram",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [instagramLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: () => {},
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        if (bootstrapCalls === 1) {
          throw new Error(
            "Instagram public augmentation captured placeholder content: login_wall.",
          );
        }

        return createInstagramBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureSuccess(
          {
            followersCount: 104,
            followersCountRaw: "104 Followers",
            followingCount: 211,
            followingCountRaw: "211 Following",
          },
          "output/playwright/public-rich-sync/instagram-second.json",
        );
      },
      nowIso: () => "2026-05-24T09:16:00.000Z",
      log: () => {},
      sleep: async (milliseconds) => {
        retryDelays.push(milliseconds);
      },
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 2);
  assert.equal(captureCalls, 1);
  assert.deepEqual(retryDelays, [120000]);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "synced",
      reason: "bootstrapped_and_refreshed",
      artifactPath: "output/playwright/public-rich-sync/instagram-second.json",
      attempts: 2,
    },
  ]);
});

test("records one final failure after default nonfatal capture retries are exhausted", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.substack = createSubstackBaseEntry(
    "substack",
    "2026-05-12T12:00:00.000Z",
    "https://substack.com/@peterryszkiewicz",
  );
  const retryDelays: number[] = [];
  let captureCalls = 0;

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
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureFailure(
          "Substack public browser capture did not find a subscriber count.",
          { placeholderSignals: [] },
          `output/playwright/public-rich-sync/substack-${captureCalls}.json`,
        );
      },
      nowIso: () => "2026-05-24T09:17:00.000Z",
      log: () => {},
      sleep: async (milliseconds) => {
        retryDelays.push(milliseconds);
      },
    },
  );

  // Assert
  assert.equal(captureCalls, 3);
  assert.deepEqual(retryDelays, [120000, 120000]);
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.deepEqual(result.entries, [
    {
      linkId: "substack",
      status: "failed",
      reason: "subscribers_missing",
      artifactPath: "output/playwright/public-rich-sync/substack-3.json",
      detail: "Substack public browser capture did not find a subscriber count.",
      attempts: 3,
    },
  ]);
});

test("does not retry fatal profile-unavailable capture failures", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.instagram = createInstagramBaseEntry(
    "instagram",
    "2026-05-12T03:00:00.000Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );
  let captureCalls = 0;
  const retryDelays: number[] = [];

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "instagram",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [instagramLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureFailure(
          "Instagram public browser capture saw placeholder content: not_found.",
          { placeholderSignals: ["not_found"] },
          "output/playwright/public-rich-sync/instagram-not-found.json",
        );
      },
      nowIso: () => "2026-05-24T09:18:00.000Z",
      log: () => {},
      sleep: async (milliseconds) => {
        retryDelays.push(milliseconds);
      },
    },
  );

  // Assert
  assert.equal(captureCalls, 1);
  assert.deepEqual(retryDelays, []);
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "failed",
      reason: "profile_unavailable",
      artifactPath: "output/playwright/public-rich-sync/instagram-not-found.json",
      detail:
        "Instagram public browser capture saw fatal profile-unavailable placeholder content: not_found.",
      fatal: true,
    },
  ]);
});

test("captureRetries zero disables retry attempts", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.medium = createMediumBaseEntry(
    "medium",
    "2026-03-08T13:00:00.000Z",
    "https://medium.com/feed/@peterryszkiewicz",
  );
  let captureCalls = 0;
  const retryDelays: number[] = [];

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "medium",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
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
        return captureFailure(
          "Medium public browser capture saw placeholder content: cloudflare_challenge.",
          { placeholderSignals: ["cloudflare_challenge"] },
          "output/playwright/public-rich-sync/medium-first.json",
        );
      },
      nowIso: () => "2026-05-24T09:19:00.000Z",
      log: () => {},
      sleep: async (milliseconds) => {
        retryDelays.push(milliseconds);
      },
    },
  );

  // Assert
  assert.equal(captureCalls, 1);
  assert.deepEqual(retryDelays, []);
  assert.deepEqual(result.entries, [
    {
      linkId: "medium",
      status: "failed",
      reason: "followers_missing",
      artifactPath: "output/playwright/public-rich-sync/medium-first.json",
      detail: "Medium public browser capture saw placeholder content: cloudflare_challenge.",
    },
  ]);
});
