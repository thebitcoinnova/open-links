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

const brightBuildsFacebookLink = {
  id: "bright-builds-facebook",
  label: "Bright Builds LLC",
  url: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
  type: "rich",
  icon: "facebook",
  metadata: {
    title: "Bright Builds LLC",
    sourceLabel: "facebook.com",
  },
  enrichment: {
    enabled: false,
    facebookPageMetrics: {
      enabled: true,
      pageId: "1002804269589824",
    },
  },
} as const;

test("resolves Facebook Page metrics config with the default Graph API version", () => {
  // Arrange / Act
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);

  // Assert
  assert.deepEqual(target, {
    id: "facebook-page-metrics",
    pageId: "1002804269589824",
    apiVersion: "v24.0",
    sourceUrl:
      "https://graph.facebook.com/v24.0/1002804269589824?fields=id%2Cname%2Cfollowers_count%2Cfan_count",
    tokenEnv: "OPENLINKS_FACEBOOK_PAGE_ACCESS_TOKEN",
  });
});

test("ignores disabled Facebook Page metrics config", () => {
  // Arrange / Act
  const target = resolveFacebookPageMetricsTarget({
    enrichment: {
      facebookPageMetrics: {
        enabled: false,
        pageId: "1002804269589824",
      },
    },
  });

  // Assert
  assert.equal(target, null);
});

test("normalizes Facebook Graph followers_count and leaves fan_count diagnostic-only", () => {
  // Arrange
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);
  assert.ok(target);

  // Act
  const metrics = normalizeFacebookPageMetricsResponse(
    {
      id: "1002804269589824",
      name: "Bright Builds LLC",
      followers_count: 41,
      fan_count: 32,
    },
    target,
  );

  // Assert
  assert.deepEqual(metrics, {
    pageId: "1002804269589824",
    pageName: "Bright Builds LLC",
    followersCount: 41,
    followersCountRaw: "41 followers",
    fanCount: 32,
    sourceUrl:
      "https://graph.facebook.com/v24.0/1002804269589824?fields=id%2Cname%2Cfollowers_count%2Cfan_count",
  });
});

test("rejects Facebook Graph responses for a different Page ID", () => {
  // Arrange
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);
  assert.ok(target);

  // Act / Assert
  assert.throws(
    () =>
      normalizeFacebookPageMetricsResponse(
        {
          id: "61588043858384",
          name: "Bright Builds LLC",
          followers_count: 32,
        },
        target,
      ),
    /did not match requested page '1002804269589824'/u,
  );
});

test("does not use Facebook fan_count as a follower fallback", () => {
  // Arrange
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);
  assert.ok(target);

  // Act / Assert
  assert.throws(
    () =>
      normalizeFacebookPageMetricsResponse(
        {
          id: "1002804269589824",
          name: "Bright Builds LLC",
          fan_count: 32,
        },
        target,
      ),
    /followers_count/u,
  );
});

test("fails Facebook Page metrics fetch when the access token is missing", async () => {
  // Arrange
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);
  assert.ok(target);

  // Act / Assert
  await assert.rejects(
    () => fetchFacebookPageMetrics({ target, accessToken: "" }),
    /OPENLINKS_FACEBOOK_PAGE_ACCESS_TOKEN/u,
  );
});

test("adds an actionable hint for Facebook Page ID or permission errors", async () => {
  // Arrange
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);
  assert.ok(target);

  // Act / Assert
  await assert.rejects(
    () =>
      fetchFacebookPageMetrics({
        target,
        accessToken: "test-token",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              error: {
                message:
                  "Unsupported get request. Object with ID '61588043858384' does not exist, cannot be loaded due to missing permissions, or does not support this operation.",
                type: "GraphMethodException",
                code: 100,
                error_subcode: 33,
              },
            }),
            { status: 400 },
          ),
      }),
    /not the Meta Graph Page ID, or the Page token cannot access that Page/u,
  );
});

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

const captureFailure = (
  error: string,
  metrics: Partial<PublicBrowserAudienceCaptureResult["metrics"]>,
  artifactPath = "output/playwright/public-rich-sync/capture-failed.json",
): PublicBrowserAudienceCaptureResult => ({
  ok: false,
  artifactPath,
  metrics: {
    placeholderSignals: [],
    ...metrics,
  },
  error,
});

test("syncs Facebook Page followers from Graph without persisting fan_count", async () => {
  // Arrange
  let writtenRegistry: PublicCacheRegistry | undefined;
  let requestedPageId: string | undefined;

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "bright-builds-facebook",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
    },
    {
      readLinks: () => ({ links: [brightBuildsFacebookLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: (_path, registry) => {
        writtenRegistry = JSON.parse(JSON.stringify(registry)) as PublicCacheRegistry;
      },
      fetchFacebookPageMetrics: async ({ target }) => {
        requestedPageId = target.pageId;
        return {
          pageId: target.pageId,
          pageName: "Bright Builds LLC",
          followersCount: 41,
          followersCountRaw: "41 followers",
          fanCount: 32,
          sourceUrl: target.sourceUrl,
        };
      },
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap public browser metadata");
      },
      captureAudienceMetrics: async () => {
        throw new Error("should not use public browser capture");
      },
      nowIso: () => "2026-05-31T12:00:00.000Z",
      log: () => {},
    },
  );

  // Assert
  const metadata = writtenRegistry?.entries["bright-builds-facebook"]?.metadata as
    | Record<string, unknown>
    | undefined;
  assert.equal(requestedPageId, "1002804269589824");
  assert.equal(result.failed, 0);
  assert.equal(result.processed, 1);
  assert.equal(metadata?.followersCount, 41);
  assert.equal(metadata?.followersCountRaw, "41 followers");
  assert.equal(metadata?.sourceLabel, "facebook.com");
  assert.equal(metadata?.fanCount, undefined);
  assert.deepEqual(result.entries, [
    {
      linkId: "bright-builds-facebook",
      status: "synced",
      reason: "bootstrapped_and_refreshed",
      detail: "followers_count=41; fan_count=32; page=Bright Builds LLC",
    },
  ]);
});

test("reports missing Facebook Page metrics token as a fatal sync failure", async () => {
  // Arrange
  const target = resolveFacebookPageMetricsTarget(brightBuildsFacebookLink);
  assert.ok(target);

  // Act
  const result = await runPublicRichSyncWithDependencies(
    {
      linksPath: "data/links.json",
      publicCachePath: "data/cache/rich-public-cache.json",
      onlyLink: "bright-builds-facebook",
      onlyMissing: false,
      force: false,
      headed: false,
      browserWaitMs: 5000,
      captureRetries: 0,
    },
    {
      readLinks: () => ({ links: [brightBuildsFacebookLink] }),
      loadPublicCache: () => emptyRegistry(),
      writePublicCache: () => {
        throw new Error("should not write failed sync");
      },
      fetchFacebookPageMetrics: () => fetchFacebookPageMetrics({ target, accessToken: "" }),
      bootstrapBaseEntry: async () => {
        throw new Error("should not bootstrap public browser metadata");
      },
      captureAudienceMetrics: async () => {
        throw new Error("should not use public browser capture");
      },
      nowIso: () => "2026-05-31T12:05:00.000Z",
      log: () => {},
    },
  );

  // Assert
  assert.equal(result.failed, 1);
  assert.equal(result.fatalFailed, 1);
  assert.deepEqual(result.entries, [
    {
      linkId: "bright-builds-facebook",
      status: "failed",
      reason: "token_missing",
      detail:
        "Missing OPENLINKS_FACEBOOK_PAGE_ACCESS_TOKEN; configure a Facebook Page access token before syncing '1002804269589824'.",
      fatal: true,
    },
  ]);
});

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
