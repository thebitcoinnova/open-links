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
