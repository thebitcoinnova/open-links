import assert from "node:assert/strict";
import test from "node:test";
import type { PublicCacheEntry, PublicCacheRegistry } from "./enrichment/public-cache";
import {
  type PublicBrowserAudienceCaptureResult,
  runPublicRichSyncWithDependencies,
} from "./public-rich-sync";

const mediumLink = {
  id: "medium",
  label: "Medium",
  url: "https://medium.com/@peterryszkiewicz",
  type: "rich",
  icon: "medium",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

const secondMediumLink = {
  id: "medium-two",
  label: "Medium 2",
  url: "https://medium.com/@anotherperson",
  type: "rich",
  icon: "medium",
  metadata: {
    handle: "anotherperson",
  },
} as const;

const xLink = {
  id: "x",
  label: "X",
  url: "https://x.com/pryszkie",
  type: "rich",
  icon: "x",
  metadata: {
    handle: "pryszkie",
  },
} as const;

const emptyRegistry = (): PublicCacheRegistry => ({
  version: 1,
  updatedAt: "2026-03-08T14:00:00.000Z",
  entries: {},
});

const createMediumBaseEntry = (
  linkId: string,
  generatedAt: string,
  sourceUrl: string,
  handle = "peterryszkiewicz",
): PublicCacheEntry => ({
  linkId,
  sourceUrl,
  capturedAt: generatedAt,
  updatedAt: generatedAt,
  metadata: {
    title: "Stories by Peter Ryszkiewicz on Medium",
    description: "Stories by Peter Ryszkiewicz on Medium",
    image: "https://cdn-images-1.medium.com/avatar.jpg",
    profileImage: "https://cdn-images-1.medium.com/avatar.jpg",
    handle,
    sourceLabel: "medium.com",
  },
  cacheControl: "private, max-age=900",
});

const createXBaseEntry = (
  linkId: string,
  generatedAt: string,
  sourceUrl: string,
  handle = "pryszkie",
): PublicCacheEntry => ({
  linkId,
  sourceUrl,
  capturedAt: generatedAt,
  updatedAt: generatedAt,
  metadata: {
    title: "@pryszkie on X",
    description: "Posts and updates from @pryszkie on X.",
    image: "https://unavatar.io/x/pryszkie",
    profileImage: "https://unavatar.io/x/pryszkie",
    handle,
    sourceLabel: "x.com",
  },
  cacheControl: "must-revalidate, max-age=3153600000",
});

const captureSuccess = (
  metrics: Omit<PublicBrowserAudienceCaptureResult["metrics"], "placeholderSignals">,
  artifactPath = "output/playwright/public-rich-sync/capture.json",
): PublicBrowserAudienceCaptureResult => ({
  ok: true,
  artifactPath,
  metrics: {
    ...metrics,
    placeholderSignals: [],
  },
});

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

test("bootstraps a missing X cache entry and overlays follower and following counts", async () => {
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
  assert.equal(result.registry.entries.x?.metadata.followersCountRaw, "1,350 Followers");
  assert.equal(result.registry.entries.x?.metadata.followingCountRaw, "643 Following");
  assert.deepEqual(result.entries, [
    {
      linkId: "x",
      status: "failed",
      reason: "audience_missing",
      artifactPath: "output/playwright/public-rich-sync/x-failed.json",
    },
  ]);
});
