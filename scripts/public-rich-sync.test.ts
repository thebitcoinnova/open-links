import assert from "node:assert/strict";
import test from "node:test";
import type { PublicCacheEntry, PublicCacheRegistry } from "./enrichment/public-cache";
import {
  type PublicBrowserAudienceCaptureResult,
  buildPublicRichSyncRunSummary,
  runPublicRichSyncWithDependencies,
  shouldPublicRichSyncExitWithFailure,
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

const xCommunityLink = {
  id: "x-community",
  label: "PARANOID BITCOIN ANARCHISTS",
  url: "https://x.com/i/communities/1871996451812769951",
  type: "rich",
  icon: "x",
} as const;

const instagramLink = {
  id: "instagram",
  label: "Instagram",
  url: "https://www.instagram.com/peterryszkiewicz/",
  type: "rich",
  icon: "instagram",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

const primalLink = {
  id: "primal",
  label: "Primal",
  url: "https://primal.net/peterryszkiewicz",
  type: "rich",
  icon: "primal",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

const youtubeLink = {
  id: "youtube",
  label: "YouTube",
  url: "https://www.youtube.com/@peterryszkiewicz4354",
  type: "rich",
  icon: "youtube",
} as const;

const substackLink = {
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  metadata: {
    handle: "peterryszkiewicz",
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

const createXCommunityBaseEntry = (
  linkId: string,
  generatedAt: string,
  sourceUrl: string,
): PublicCacheEntry => ({
  linkId,
  sourceUrl,
  capturedAt: generatedAt,
  updatedAt: generatedAt,
  metadata: {
    title: "PARANOID BITCOIN ANARCHISTS",
    description:
      "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
    image:
      "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
    sourceLabel: "x.com",
  },
  cacheControl: "no-cache, no-store, must-revalidate",
});

const createInstagramBaseEntry = (
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
    title: "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
    description:
      "99 Followers, 210 Following, 10 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
    image: "https://scontent.cdninstagram.com/avatar.jpg",
    profileImage: "https://scontent.cdninstagram.com/avatar.jpg",
    followersCount: 99,
    followersCountRaw: "99 Followers",
    followingCount: 210,
    followingCountRaw: "210 Following",
    handle,
    sourceLabel: "instagram.com",
  },
  cacheControl: "private, no-cache, no-store, must-revalidate",
});

const createPrimalBaseEntry = (
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
    title: "Peter No Taxation Without Representation Ryszkiewicz",
    description: "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
    image: "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
    profileImage: "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
    handle,
    sourceLabel: "primal.net",
  },
  cacheControl: "must-revalidate, proxy-revalidate, max-age=1",
});

const createYoutubeBaseEntry = (
  linkId: string,
  generatedAt: string,
  sourceUrl: string,
): PublicCacheEntry => ({
  linkId,
  sourceUrl,
  capturedAt: generatedAt,
  updatedAt: generatedAt,
  metadata: {
    title: "Peter Ryszkiewicz - YouTube",
    description: "Videos from Peter Ryszkiewicz.",
    image: "https://yt3.googleusercontent.com/avatar.jpg",
    profileImage: "https://yt3.googleusercontent.com/avatar.jpg",
    sourceLabel: "youtube.com",
  },
  cacheControl: "no-cache, no-store, must-revalidate",
});

const createSubstackBaseEntry = (
  linkId: string,
  generatedAt: string,
  sourceUrl: string,
): PublicCacheEntry => ({
  linkId,
  sourceUrl,
  capturedAt: generatedAt,
  updatedAt: generatedAt,
  metadata: {
    title: "Peter Ryszkiewicz",
    description: "I'm an agentic engineer, making things in the AI space.",
    image: "https://substackcdn.com/profile-card.jpg",
    profileImage: "https://substackcdn.com/avatar.jpg",
    handle: "peterryszkiewicz",
    sourceLabel: "peter.ryszkiewicz.us",
  },
  cacheControl: "no-cache",
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

test("treats Instagram login redirects as non-fatal capture failures", async () => {
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
        artifactPath: "output/playwright/public-rich-sync/instagram-login.json",
        metrics: {
          placeholderSignals: ["login_redirect"],
        },
        error: "Instagram public browser capture saw placeholder content: login_redirect.",
      }),
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
      detail: "Instagram public browser capture saw placeholder content: login_redirect.",
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

test("X sync in only-missing mode refreshes when profile description is absent", async () => {
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
          profileDescription:
            "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
        });
      },
      nowIso: () => "2026-03-08T18:12:30.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(captureCalls, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.processed, 1);
  assert.equal(
    result.registry.entries.x?.metadata.profileDescription,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
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
      reason: "profile_metadata_missing",
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
