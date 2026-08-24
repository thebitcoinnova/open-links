import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink } from "../../src/lib/content/load-content";
import { resolveFreshPublicRichSyncLinkIds, resolveSnapshots } from "../sync-follower-history";
import {
  createBrightBuildsFacebookLink,
  createBrightBuildsFacebookPublicRegistry,
  createPublicRegistry,
  createSubstackLink,
  createSubstackPublicRegistry,
  createXProfileLink,
  createYoutubeLink,
  createYoutubePublicRegistry,
} from "./test-fixtures";

test("resolveSnapshots skips public-cache audience rows without fresh public sync evidence", () => {
  // Arrange
  const links = [createYoutubeLink()];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots skips public-cache audience rows when public sync failed", () => {
  // Arrange
  const links = [createYoutubeLink()];
  const failedLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "youtube", status: "failed" as const, reason: "subscribers_missing" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: failedLinkIds,
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots accepts public-cache audience rows after public sync refreshed counts", () => {
  // Arrange
  const links = [createYoutubeLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "youtube", status: "synced" as const, reason: "counts_refreshed" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.linkId, "youtube");
  assert.equal(snapshots[0]?.row.audienceCountRaw, "9.2K subscribers");
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots accepts public-cache audience rows after fresh unchanged capture", () => {
  // Arrange
  const links = [createYoutubeLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "youtube", status: "skipped" as const, reason: "counts_unchanged" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createYoutubePublicRegistry(),
    null,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceCountRaw, "9.2K subscribers");
});

test("resolveSnapshots skips Substack public-cache rows without fresh public sync evidence", () => {
  // Arrange
  const links = [createSubstackLink()];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots accepts Substack public-cache rows after fresh public sync evidence", () => {
  // Arrange
  const links = [createSubstackLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "substack", status: "synced" as const, reason: "counts_refreshed" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.linkId, "substack");
  assert.equal(snapshots[0]?.row.audienceCountRaw, "15 subscribers");
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots accepts Substack public-cache rows after fresh unchanged capture", () => {
  // Arrange
  const links = [createSubstackLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [{ linkId: "substack", status: "skipped" as const, reason: "counts_unchanged" }],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.audienceCountRaw, "15 subscribers");
});

test("resolveSnapshots skips Substack public-cache rows after stale enrichment fallback only", () => {
  // Arrange
  const links = [createSubstackLink()];
  const staleOnlySummary = {
    entries: [
      {
        linkId: "substack",
        status: "skipped" as const,
        reason: "stale_cache_fallback",
      },
    ],
  };

  // Act
  const snapshots = resolveSnapshots(
    links,
    createSubstackPublicRegistry(),
    null,
    "2026-05-12T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(staleOnlySummary),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots skips Facebook Page metrics rows without fresh Graph sync evidence", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createBrightBuildsFacebookPublicRegistry(),
    null,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots accepts Facebook Page metrics rows after fresh Graph sync evidence", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [
      {
        linkId: "bright-builds-facebook",
        status: "synced" as const,
        reason: "counts_refreshed",
      },
    ],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createBrightBuildsFacebookPublicRegistry(),
    null,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.row.linkId, "bright-builds-facebook");
  assert.equal(snapshots[0]?.row.platform, "facebook");
  assert.equal(snapshots[0]?.row.handle, "bright-builds-llc");
  assert.equal(snapshots[0]?.row.audienceCountRaw, "41 followers");
  assert.equal(snapshots[0]?.row.source, "public-cache");
});

test("resolveSnapshots does not treat Facebook fan_count as follower history", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];
  const fanCountOnlyRegistry = createPublicRegistry({
    "bright-builds-facebook": {
      linkId: "bright-builds-facebook",
      sourceUrl:
        "https://graph.facebook.com/v24.0/1002804269589824?fields=id%2Cname%2Cfollowers_count%2Cfan_count",
      capturedAt: "2026-05-31T12:00:00.000Z",
      updatedAt: "2026-05-31T12:00:00.000Z",
      metadata: {
        sourceLabel: "facebook.com",
        fanCount: 32,
      } as unknown as Parameters<typeof resolveSnapshots>[1]["entries"][string]["metadata"],
    },
  });
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [
      {
        linkId: "bright-builds-facebook",
        status: "synced" as const,
        reason: "counts_refreshed",
      },
    ],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    fanCountOnlyRegistry,
    null,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.deepEqual(snapshots, []);
});

test("resolveSnapshots supplements authenticated metadata with public-cache Facebook audience", () => {
  // Arrange
  const links = [createBrightBuildsFacebookLink()];
  const authenticatedRegistry = {
    entries: {
      "bright-builds-facebook": {
        metadata: {
          title: "Bright Builds LLC on Facebook",
          description: "Profile and updates from Bright Builds LLC on Facebook.",
          image: "cache/rich-authenticated/bright-builds.jpg",
          profileImage: "cache/rich-authenticated/bright-builds.jpg",
          sourceLabel: "facebook.com",
        },
      },
    },
  } as unknown as Parameters<typeof resolveSnapshots>[2];
  const freshLinkIds = resolveFreshPublicRichSyncLinkIds({
    entries: [
      {
        linkId: "bright-builds-facebook",
        status: "skipped" as const,
        reason: "counts_unchanged",
      },
    ],
  });

  // Act
  const snapshots = resolveSnapshots(
    links,
    createBrightBuildsFacebookPublicRegistry(),
    authenticatedRegistry,
    "2026-05-31T13:00:00.000Z",
    {
      freshPublicAudienceLinkIds: freshLinkIds,
    },
  );

  // Assert
  assert.deepEqual(
    snapshots.map((snapshot) => ({
      linkId: snapshot.row.linkId,
      source: snapshot.row.source,
      audienceCountRaw: snapshot.row.audienceCountRaw,
    })),
    [
      {
        linkId: "bright-builds-facebook",
        source: "public-cache",
        audienceCountRaw: "41 followers",
      },
    ],
  );
});

test("resolveSnapshots keeps manual and authenticated snapshots without public sync evidence", () => {
  // Arrange
  const links: OpenLink[] = [
    {
      id: "manual-youtube",
      label: "Manual YouTube",
      url: "https://www.youtube.com/@manual",
      type: "rich",
      icon: "youtube",
      enabled: true,
      metadata: {
        subscribersCount: 1200,
        subscribersCountRaw: "1.2K subscribers",
      },
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      url: "https://www.linkedin.com/in/example/",
      type: "rich",
      icon: "linkedin",
      enabled: true,
      enrichment: {
        authenticatedExtractor: "linkedin-auth-browser",
      },
    },
  ];
  const authenticatedRegistry = {
    entries: {
      linkedin: {
        metadata: {
          followersCount: 90,
          followersCountRaw: "90 followers",
        },
      },
    },
  } as unknown as Parameters<typeof resolveSnapshots>[2];

  // Act
  const snapshots = resolveSnapshots(
    links,
    createPublicRegistry({}),
    authenticatedRegistry,
    "2026-03-12T07:00:00.000Z",
    {
      freshPublicAudienceLinkIds: resolveFreshPublicRichSyncLinkIds(undefined),
    },
  );

  // Assert
  assert.deepEqual(
    snapshots.map((snapshot) => ({
      linkId: snapshot.row.linkId,
      source: snapshot.row.source,
      audienceCountRaw: snapshot.row.audienceCountRaw,
    })),
    [
      {
        linkId: "manual-youtube",
        source: "manual",
        audienceCountRaw: "1.2K subscribers",
      },
      {
        linkId: "linkedin",
        source: "authenticated-cache",
        audienceCountRaw: "90 followers",
      },
    ],
  );
});
