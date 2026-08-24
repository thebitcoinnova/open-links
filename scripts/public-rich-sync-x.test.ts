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

test("bootstraps a missing X cache entry and overlays follower, following, and profile description", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "x",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [mediumLink, xLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        return createXBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "x-public-oembed");
        return captureSuccess(
          {
            followersCount: 1350,
            followersCountRaw: "1,350 Followers",
            followingCount: 643,
            followingCountRaw: "643 Following",
            profileDescription:
              "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
          },
          "output/playwright/public-rich-sync/x-2026-03-08.json",
        );
      },
      nowIso: () => "2026-03-08T18:10:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    writtenRegistry?.entries.x?.sourceUrl,
    "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
  );
  assert.equal(writtenRegistry?.entries.x?.metadata.followersCountRaw, "1,350 Followers");
  assert.equal(writtenRegistry?.entries.x?.metadata.followingCountRaw, "643 Following");
  assert.equal(
    writtenRegistry?.entries.x?.metadata.profileDescription,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
});

test("bootstraps a missing X community cache entry without requiring a profile image", async () => {
  // Arrange
  let bootstrapCalls = 0;
  let writtenRegistry: PublicCacheRegistry | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "x-community",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [xCommunityLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      bootstrapBaseEntry: async ({ link, target, generatedAt }) => {
        bootstrapCalls += 1;
        assert.equal(target.id, "x-public-community");
        return createXCommunityBaseEntry(link.id, generatedAt, target.sourceUrl);
      },
      captureAudienceMetrics: async ({ target }) => {
        assert.equal(target.id, "x-public-community");
        return captureSuccess(
          {
            membersCount: 785,
            membersCountRaw: "785 Members",
          },
          "output/playwright/public-rich-sync/x-community-2026-03-08.json",
        );
      },
      nowIso: () => "2026-03-08T18:11:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(bootstrapCalls, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    writtenRegistry?.entries["x-community"]?.sourceUrl,
    "https://x.com/i/communities/1871996451812769951",
  );
  assert.equal(
    writtenRegistry?.entries["x-community"]?.metadata.image,
    "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
  );
  assert.equal(writtenRegistry?.entries["x-community"]?.metadata.profileImage, undefined);
  assert.equal(writtenRegistry?.entries["x-community"]?.metadata.membersCount, 785);
  assert.equal(writtenRegistry?.entries["x-community"]?.metadata.membersCountRaw, "785 Members");
});

test("X sync in only-missing mode still refreshes when one audience metric is absent", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.x = {
    ...createXBaseEntry(
      "x",
      "2026-03-08T17:00:00.000Z",
      "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
    ),
    metadata: {
      ...createXBaseEntry(
        "x",
        "2026-03-08T17:00:00.000Z",
        "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
      ).metadata,
      followersCount: 1350,
      followersCountRaw: "1,350 Followers",
    },
  };
  let captureCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "x",
      onlyMissing: true,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [xLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureSuccess({
          followersCount: 1350,
          followersCountRaw: "1,350 Followers",
          followingCount: 643,
          followingCountRaw: "643 Following",
          profileDescription:
            "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
        });
      },
      nowIso: () => "2026-03-08T18:12:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(captureCalls, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.processed, 1);
  assert.equal(result.registry.entries.x?.metadata.followingCountRaw, "643 Following");
  assert.equal(
    result.registry.entries.x?.metadata.profileDescription,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
});

test("X sync in only-missing mode accepts complete audience counts without a profile description", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.x = {
    ...createXBaseEntry(
      "x",
      "2026-03-08T17:00:00.000Z",
      "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
    ),
    metadata: {
      ...createXBaseEntry(
        "x",
        "2026-03-08T17:00:00.000Z",
        "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
      ).metadata,
      followersCount: 1350,
      followersCountRaw: "1,350 Followers",
      followingCount: 643,
      followingCountRaw: "643 Following",
    },
  };
  let captureCalls = 0;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "x",
      onlyMissing: true,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [xLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => {
        captureCalls += 1;
        return captureSuccess({
          followersCount: 1350,
          followersCountRaw: "1,350 Followers",
          followingCount: 643,
          followingCountRaw: "643 Following",
        });
      },
      nowIso: () => "2026-03-08T18:12:30.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(captureCalls, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.processed, 0);
  assert.equal(result.registry.entries.x?.metadata.profileDescription, undefined);
});

test("preserves existing X metrics when a refresh attempt fails", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.x = {
    ...createXBaseEntry(
      "x",
      "2026-03-08T17:00:00.000Z",
      "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
    ),
    metadata: {
      ...createXBaseEntry(
        "x",
        "2026-03-08T17:00:00.000Z",
        "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
      ).metadata,
      followersCount: 1350,
      followersCountRaw: "1,350 Followers",
      followingCount: 643,
      followingCountRaw: "643 Following",
      profileDescription:
        "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
    },
  };

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "x",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [xLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/x-failed.json",
        metrics: {
          followersCount: 1350,
          followersCountRaw: "1,350 Followers",
          placeholderSignals: [],
        },
        error: "X public browser capture did not find a following count.",
      }),
      nowIso: () => "2026-03-08T18:13:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 0);
  assert.equal(result.registry.entries.x?.metadata.followersCountRaw, "1,350 Followers");
  assert.equal(result.registry.entries.x?.metadata.followingCountRaw, "643 Following");
  assert.equal(
    result.registry.entries.x?.metadata.profileDescription,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
  assert.deepEqual(result.entries, [
    {
      linkId: "x",
      status: "failed",
      reason: "audience_missing",
      artifactPath: "output/playwright/public-rich-sync/x-failed.json",
      detail: "X public browser capture did not find a following count.",
    },
  ]);
});

test("marks terminal X placeholder captures as fatal profile-unavailable failures", async () => {
  // Arrange
  const registry = emptyRegistry();
  registry.entries.x = {
    ...createXBaseEntry(
      "x",
      "2026-03-08T17:00:00.000Z",
      "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
    ),
    metadata: {
      ...createXBaseEntry(
        "x",
        "2026-03-08T17:00:00.000Z",
        "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fpryszkie&omit_script=true&hide_thread=true&dnt=true",
      ).metadata,
      followersCount: 1350,
      followersCountRaw: "1,350 Followers",
      followingCount: 643,
      followingCountRaw: "643 Following",
      profileDescription: "Existing profile description.",
    },
  };

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "x",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [xLink] }),
      loadPublicCache: () => registry,
      writePublicCache: () => {},
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap");
      },
      captureAudienceMetrics: async () => ({
        ok: false,
        artifactPath: "output/playwright/public-rich-sync/x-missing.json",
        metrics: {
          placeholderSignals: ["account_missing"],
        },
        error: "X public browser capture saw placeholder content: account_missing.",
      }),
      nowIso: () => "2026-03-08T18:14:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 1);
  assert.equal(shouldPublicRichSyncExitWithFailure(result, true), true);
  assert.deepEqual(result.entries, [
    {
      linkId: "x",
      status: "failed",
      reason: "profile_unavailable",
      artifactPath: "output/playwright/public-rich-sync/x-missing.json",
      detail:
        "X public browser capture saw fatal profile-unavailable placeholder content: account_missing.",
      fatal: true,
    },
  ]);
});
