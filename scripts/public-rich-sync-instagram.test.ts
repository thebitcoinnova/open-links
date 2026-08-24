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

test("overlays Instagram browser counts when profile metadata counts are stale", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

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
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        assert.equal(target.id, "instagram-public-profile");
        return createInstagramBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "instagram-public-profile");
        return captureSuccess(
          {
            followersCount: 100,
            followersCountRaw: "100 followers",
            followingCount: 206,
            followingCountRaw: "206 following",
          },
          "output/playwright/public-rich-sync/instagram-2026-05-12.json",
        );
      },
      fetchFallbackAudienceMetrics: async () => {
        throw new Error("should not use fallback after browser success");
      },
      nowIso: () => "2026-05-12T03:15:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    writtenRegistry?.entries.instagram?.sourceUrl,
    "https://www.instagram.com/peterryszkiewicz/",
  );
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followersCount, 100);
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followersCountRaw, "100 followers");
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followingCount, 206);
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followingCountRaw, "206 following");
  assert.equal(writtenRegistry?.entries.instagram?.metadata.description, undefined);
});

test("uses authoritative Instagram cache metadata when description was pruned", async () => {
  // Arrange
  const registry = emptyRegistry();
  const existingEntry = createInstagramBaseEntry(
    "instagram",
    "2026-05-22T08:07:39.816Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );
  existingEntry.metadata.description = undefined;
  registry.entries.instagram = existingEntry;
  let bootstrapCalls = 0;
  let captureCalls = 0;

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
      writePublicCache: () => {
        throw new Error("should not write unchanged cache");
      },
      bootstrapBaseEntry: async () => {
        bootstrapCalls += 1;
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureSuccess(
          {
            followersCount: 99,
            followersCountRaw: "99 Followers",
            followingCount: 210,
            followingCountRaw: "210 Following",
          },
          "output/playwright/public-rich-sync/instagram-unchanged.json",
        );
      },
      fetchFallbackAudienceMetrics: async () => {
        throw new Error("should not use fallback after browser success");
      },
      nowIso: () => "2026-05-24T09:17:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 0);
  assert.equal(captureCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "skipped",
      reason: "counts_unchanged",
    },
  ]);
});

test("recovers unchanged Instagram audience from public HTML fallback when browser redirects to login", async () => {
  // Arrange
  const registry = emptyRegistry();
  const existingEntry = createInstagramBaseEntry(
    "instagram",
    "2026-05-12T03:00:00.000Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );
  registry.entries.instagram = existingEntry;
  let fallbackCaptureArtifact: string | undefined;
  let wroteRegistry = false;

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
      writePublicCache: () => {
        wroteRegistry = true;
      },
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/instagram-login.json",
        metrics: {
          placeholderSignals: ["login_redirect"],
        },
        error: "Instagram public browser capture saw placeholder content: login_redirect.",
      }),
      fetchFallbackAudienceMetrics: async ({ failedCapture, target }) => {
        fallbackCaptureArtifact = failedCapture.artifactPath;
        assert.equal(target.id, "instagram-public-profile");
        return {
          ok: true,
          source: "public-html",
          metadata: createInstagramBaseEntry(
            "instagram",
            "2026-05-16T15:30:00.000Z",
            "https://www.instagram.com/peterryszkiewicz/",
          ).metadata,
          metrics: {
            placeholderSignals: [],
            followersCount: 99,
            followersCountRaw: "99 Followers",
            followingCount: 210,
            followingCountRaw: "210 Following",
          },
        };
      },
      nowIso: () => "2026-05-16T15:30:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(fallbackCaptureArtifact, "output/playwright/public-rich-sync/instagram-login.json");
  assert.equal(wroteRegistry, false);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "skipped",
      reason: "counts_unchanged",
    },
  ]);
});

test("refreshes Instagram audience from public HTML fallback when browser redirects to login", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.instagram = createInstagramBaseEntry(
    "instagram",
    "2026-05-12T03:00:00.000Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );
  let writtenRegistry: PublicCacheRegistry | undefined;

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
      writePublicCache: (_path, nextRegistry) => {
        writtenRegistry = JSON.parse(JSON.stringify(nextRegistry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/instagram-login.json",
        metrics: {
          placeholderSignals: ["login_redirect"],
        },
        error: "Instagram public browser capture saw placeholder content: login_redirect.",
      }),
      fetchFallbackAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "instagram-public-profile");
        return {
          ok: true,
          source: "public-html",
          metadata: {
            ...createInstagramBaseEntry(
              "instagram",
              "2026-05-16T15:35:00.000Z",
              "https://www.instagram.com/peterryszkiewicz/",
            ).metadata,
            description:
              "104 Followers, 211 Following, 10 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
            followersCount: 104,
            followersCountRaw: "104 Followers",
            followingCount: 211,
            followingCountRaw: "211 Following",
          },
          metrics: {
            placeholderSignals: [],
            followersCount: 104,
            followersCountRaw: "104 Followers",
            followingCount: 211,
            followingCountRaw: "211 Following",
          },
        };
      },
      nowIso: () => "2026-05-16T15:35:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 0);
  assert.equal(result.dirty, true);
  assert.equal(result.registry.entries.instagram?.metadata.followersCount, 104);
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followersCountRaw, "104 Followers");
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followingCount, 211);
  assert.equal(writtenRegistry?.entries.instagram?.metadata.followingCountRaw, "211 Following");
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "synced",
      reason: "counts_refreshed",
      artifactPath: "output/playwright/public-rich-sync/instagram-login.json",
    },
  ]);
});

test("treats Instagram login redirects as non-fatal failures when public HTML fallback also fails", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.instagram = createInstagramBaseEntry(
    "instagram",
    "2026-05-12T03:00:00.000Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );

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
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [instagramLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/instagram-login.json",
        metrics: {
          placeholderSignals: ["login_redirect"],
        },
        error: "Instagram public browser capture saw placeholder content: login_redirect.",
      }),
      fetchFallbackAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "instagram-public-profile");
        return {
          ok: false,
          source: "public-html",
          metrics: {
            placeholderSignals: [],
          },
          detail:
            "https://www.instagram.com/peterryszkiewicz/: Instagram public browser capture did not find follower or following counts.",
        };
      },
      nowIso: () => "2026-05-12T03:30:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.equal(shouldPublicRichSyncExitWithFailure(result, true), false);
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "failed",
      reason: "audience_missing",
      artifactPath: "output/playwright/public-rich-sync/instagram-login.json",
      detail:
        "Instagram public browser capture saw placeholder content: login_redirect. Fallback public-html capture also failed: https://www.instagram.com/peterryszkiewicz/: Instagram public browser capture did not find follower or following counts.",
    },
  ]);
});

test("keeps Instagram not-found placeholders fatal", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.instagram = createInstagramBaseEntry(
    "instagram",
    "2026-05-12T03:00:00.000Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );

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
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/instagram-not-found.json",
        metrics: {
          placeholderSignals: ["not_found"],
        },
        error: "Instagram public browser capture saw placeholder content: not_found.",
      }),
      nowIso: () => "2026-05-12T03:31:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 1);
  assert.equal(shouldPublicRichSyncExitWithFailure(result, true), true);
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

test("treats Instagram login redirect sync errors as non-fatal", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.instagram = createInstagramBaseEntry(
    "instagram",
    "2026-05-12T03:00:00.000Z",
    "https://www.instagram.com/peterryszkiewicz/",
  );

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
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [instagramLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        throw new Error("Instagram browser capture failed after login_redirect");
      },
      nowIso: () => "2026-05-12T03:32:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.equal(shouldPublicRichSyncExitWithFailure(result, true), false);
  assert.deepEqual(result.entries, [
    {
      linkId: "instagram",
      status: "failed",
      reason: "sync_error",
      detail: "Instagram browser capture failed after login_redirect",
    },
  ]);
});
