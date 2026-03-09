import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { mergeMetadataWithManualSocialProfileOverrides } from "../../src/lib/content/social-profile-fields";
import {
  buildPublicCacheEntry,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  isPublicCacheFresh,
  loadPublicCacheRegistry,
  mergePublicCacheMetadataForTarget,
  resolveCachedEntryStatus,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
} from "./public-cache";

const ROOT = process.cwd();

test("loads a missing public cache manifest as an empty registry", () => {
  // Arrange
  const cachePath = "tmp/tests/does-not-exist-public-cache.json";

  // Act
  const registry = loadPublicCacheRegistry({ cachePath });

  // Assert
  assert.equal(registry.version, 1);
  assert.deepEqual(registry.entries, {});
});

test("round-trips stable and runtime public cache manifests through disk with normalized metadata", (t) => {
  // Arrange
  const cachePath = "tmp/tests/rich-public-cache.json";
  const runtimePath = "tmp/tests/rich-public-cache.runtime.json";
  const absoluteCachePath = path.join(ROOT, cachePath);
  const absoluteRuntimePath = path.join(ROOT, runtimePath);
  t.after(() => {
    if (fs.existsSync(absoluteCachePath)) {
      fs.rmSync(absoluteCachePath, { force: true });
    }
    if (fs.existsSync(absoluteRuntimePath)) {
      fs.rmSync(absoluteRuntimePath, { force: true });
    }
  });

  writePublicCacheRegistry(
    cachePath,
    {
      version: 1,
      updatedAt: "2026-03-07T12:00:00.000Z",
      entries: {
        github: {
          linkId: "github",
          sourceUrl: "https://github.com/pRizz",
          capturedAt: "2026-03-07T12:00:00.000Z",
          updatedAt: "2026-03-07T12:05:00.000Z",
          metadata: {
            title: "  Peter Ryszkiewicz  ",
            description: "  Open source and experiments. ",
            profileDescription: "  Builder of agentic OSS. ",
            image: "https://avatars.githubusercontent.com/u/1?v=4",
            ogImage: " https://avatars.githubusercontent.com/u/1?v=4 ",
            twitterImage: " https://avatars.githubusercontent.com/u/1?v=4&twitter=true ",
            handle: " @pRizz ",
            sourceLabel: " github.com ",
            followersCount: 90,
            followersCountRaw: " 90 followers ",
          },
          etag: ' "abc" ',
          cacheControl: " max-age=300 ",
          checkedAt: " 2026-03-07T12:05:00.000Z ",
        },
      },
    },
    {
      runtimePath,
    },
  );

  // Act
  const registry = loadPublicCacheRegistry({ cachePath, runtimePath });
  const stableOnDisk = JSON.parse(fs.readFileSync(absoluteCachePath, "utf8")) as {
    entries: Record<string, Record<string, unknown>>;
  };
  const runtimeOnDisk = JSON.parse(fs.readFileSync(absoluteRuntimePath, "utf8")) as {
    entries: Record<string, Record<string, unknown>>;
  };

  // Assert
  assert.deepEqual(registry.entries.github?.metadata, {
    title: "Peter Ryszkiewicz",
    description: "Open source and experiments.",
    profileDescription: "Builder of agentic OSS.",
    image: "https://avatars.githubusercontent.com/u/1?v=4",
    ogImage: "https://avatars.githubusercontent.com/u/1?v=4",
    twitterImage: "https://avatars.githubusercontent.com/u/1?v=4&twitter=true",
    handle: "@pRizz",
    sourceLabel: "github.com",
    followersCount: 90,
    followersCountRaw: "90 followers",
  });
  assert.equal(registry.entries.github?.etag, '"abc"');
  assert.equal(registry.entries.github?.cacheControl, "max-age=300");
  assert.equal(registry.entries.github?.checkedAt, "2026-03-07T12:05:00.000Z");
  assert.equal("updatedAt" in stableOnDisk, false);
  assert.deepEqual(Object.keys(stableOnDisk.entries), ["github"]);
  assert.equal("etag" in stableOnDisk.entries.github, false);
  assert.equal("cacheControl" in stableOnDisk.entries.github, false);
  assert.equal(runtimeOnDisk.entries.github.etag, '"abc"');
  assert.equal(runtimeOnDisk.entries.github.cacheControl, "max-age=300");
  assert.equal(runtimeOnDisk.entries.github.checkedAt, "2026-03-07T12:05:00.000Z");
});

test("loads a legacy single-file public cache and migrates volatile fields into runtime state", (t) => {
  // Arrange
  const cachePath = "tmp/tests/legacy-rich-public-cache.json";
  const runtimePath = "tmp/tests/legacy-rich-public-cache.runtime.json";
  const absoluteCachePath = path.join(ROOT, cachePath);
  const absoluteRuntimePath = path.join(ROOT, runtimePath);
  t.after(() => {
    if (fs.existsSync(absoluteCachePath)) {
      fs.rmSync(absoluteCachePath, { force: true });
    }
    if (fs.existsSync(absoluteRuntimePath)) {
      fs.rmSync(absoluteRuntimePath, { force: true });
    }
  });

  fs.mkdirSync(path.dirname(absoluteCachePath), { recursive: true });
  fs.writeFileSync(
    absoluteCachePath,
    `${JSON.stringify(
      {
        version: 1,
        updatedAt: "2026-03-08T15:00:00.000Z",
        entries: {
          github: {
            linkId: "github",
            sourceUrl: "https://github.com/pRizz",
            capturedAt: "2026-03-07T12:00:00.000Z",
            updatedAt: "2026-03-07T13:00:00.000Z",
            metadata: {
              title: "pRizz - Overview",
              description: "Open source and experiments.",
              image: "https://avatars.githubusercontent.com/u/1?v=4",
            },
            etag: '"legacy"',
            cacheControl: "max-age=300",
            expiresAt: "2026-03-08T15:05:00.000Z",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  // Act
  const registry = loadPublicCacheRegistry({ cachePath, runtimePath });
  writePublicCacheRegistry(cachePath, registry, { runtimePath });
  const stableOnDisk = JSON.parse(fs.readFileSync(absoluteCachePath, "utf8")) as {
    entries: Record<string, Record<string, unknown>>;
  };
  const runtimeOnDisk = JSON.parse(fs.readFileSync(absoluteRuntimePath, "utf8")) as {
    entries: Record<string, Record<string, unknown>>;
  };

  // Assert
  assert.equal(registry.entries.github?.etag, '"legacy"');
  assert.equal(registry.entries.github?.expiresAt, "2026-03-08T15:05:00.000Z");
  assert.equal(registry.entries.github?.checkedAt, "2026-03-08T15:00:00.000Z");
  assert.equal("updatedAt" in stableOnDisk, false);
  assert.equal("etag" in stableOnDisk.entries.github, false);
  assert.equal(runtimeOnDisk.entries.github.expiresAt, "2026-03-08T15:05:00.000Z");
  assert.equal(runtimeOnDisk.entries.github.checkedAt, "2026-03-08T15:00:00.000Z");
});

test("computes freshness from cache-control and classifies cached metadata completeness", () => {
  // Arrange
  const expiresAt = computePublicCacheExpiresAt(
    "public, max-age=120",
    new Date(Date.now()).toUTCString(),
  );

  // Act
  const fresh = isPublicCacheFresh(expiresAt);
  const fullStatus = resolveCachedEntryStatus({
    title: "Title",
    description: "Description",
    image: "https://example.com/preview.jpg",
  });
  const partialStatus = resolveCachedEntryStatus({
    title: "Title",
    image: "https://example.com/preview.jpg",
  });

  // Assert
  assert.equal(fresh, true);
  assert.deepEqual(fullStatus, {
    status: "fetched",
    missingFields: undefined,
  });
  assert.deepEqual(partialStatus, {
    status: "partial",
    missingFields: ["description"],
  });
});

test("preserves public cache timestamps when only revalidation headers change", () => {
  // Arrange
  const previous = {
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    capturedAt: "2026-03-07T12:00:00.000Z",
    updatedAt: "2026-03-07T13:00:00.000Z",
    metadata: {
      title: "pRizz - Overview",
      description: "Open source and experiments.",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
    etag: '"old"',
    cacheControl: "max-age=60",
    expiresAt: "2026-03-07T13:01:00.000Z",
    checkedAt: "2026-03-07T13:01:00.000Z",
  };

  // Act
  const next = buildPublicCacheEntry({
    previous,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: previous.metadata,
    updatedAt: "2026-03-08T12:00:00.000Z",
    etag: '"new"',
    cacheControl: "max-age=300",
    expiresAt: "2026-03-08T12:05:00.000Z",
    checkedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(next.capturedAt, "2026-03-07T12:00:00.000Z");
  assert.equal(next.updatedAt, "2026-03-07T13:00:00.000Z");
  assert.equal(next.etag, '"new"');
  assert.equal(next.cacheControl, "max-age=300");
  assert.equal(next.expiresAt, "2026-03-08T12:05:00.000Z");
  assert.equal(next.checkedAt, "2026-03-08T12:00:00.000Z");
});

test("preserves capturedAt and bumps updatedAt when public cache metadata changes", () => {
  // Arrange
  const previous = {
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    capturedAt: "2026-03-07T12:00:00.000Z",
    updatedAt: "2026-03-07T13:00:00.000Z",
    metadata: {
      title: "pRizz - Overview",
      description: "Open source and experiments.",
      image: "https://avatars.githubusercontent.com/u/1?v=4",
    },
  };

  // Act
  const next = buildPublicCacheEntry({
    previous,
    linkId: "github",
    sourceUrl: "https://github.com/pRizz",
    metadata: {
      ...previous.metadata,
      description: "Open source, experiments, and projects.",
    },
    updatedAt: "2026-03-08T12:00:00.000Z",
  });

  // Assert
  assert.equal(next.capturedAt, "2026-03-07T12:00:00.000Z");
  assert.equal(next.updatedAt, "2026-03-08T12:00:00.000Z");
  assert.equal(next.metadata.description, "Open source, experiments, and projects.");
});

test("public cache helpers preserve Substack subscriber metadata", () => {
  // Arrange
  const metadata = toPublicCacheMetadata({
    title: "Peter Ryszkiewicz",
    description: "Software Engineer",
    profileDescription: "Builder of agentic OSS.",
    image: "https://substackcdn.com/image/fetch/profile-social-card.jpg",
    ogImage: "https://substackcdn.com/image/fetch/profile-social-card.jpg",
    twitterImage: "https://substackcdn.com/image/fetch/profile-twitter-card.jpg",
    profileImage: "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
    subscribersCount: 10,
    subscribersCountRaw: "10 subscribers",
    sourceLabel: "peter.ryszkiewicz.us",
  });

  // Act
  const enriched = toEnrichmentMetadataFromPublicCache(metadata);

  // Assert
  assert.deepEqual(enriched, {
    title: "Peter Ryszkiewicz",
    description: "Software Engineer",
    profileDescription: "Builder of agentic OSS.",
    image: "https://substackcdn.com/image/fetch/profile-social-card.jpg",
    ogImage: "https://substackcdn.com/image/fetch/profile-social-card.jpg",
    twitterImage: "https://substackcdn.com/image/fetch/profile-twitter-card.jpg",
    profileImage: "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
    subscribersCount: 10,
    subscribersCountRaw: "10 subscribers",
    sourceLabel: "peter.ryszkiewicz.us",
  });
});

test("public cache metadata remains lower precedence than manual overrides", () => {
  // Arrange
  const cached = toEnrichmentMetadataFromPublicCache(
    toPublicCacheMetadata({
      title: "Generated title",
      description: "Generated description",
      profileDescription: "Generated profile description",
      image: "https://example.com/generated.jpg",
      profileImage: "https://example.com/generated-avatar.jpg",
      followersCount: 24,
      followersCountRaw: "24 followers",
    }),
  );

  // Act
  const merged = mergeMetadataWithManualSocialProfileOverrides(
    {
      profileDescription: "Manual profile description",
      profileImage: "https://example.com/manual-avatar.jpg",
      followersCount: 12,
      followersCountRaw: "12 followers",
    },
    cached,
  );

  // Assert
  assert.deepEqual(merged, {
    title: "Generated title",
    description: "Generated description",
    profileDescription: "Manual profile description",
    image: "https://example.com/generated.jpg",
    profileImage: "https://example.com/manual-avatar.jpg",
    followersCount: 12,
    followersCountRaw: "12 followers",
  });
});

test("manual overrides remain higher precedence than cached Substack subscriber metadata", () => {
  // Arrange
  const cached = toEnrichmentMetadataFromPublicCache(
    toPublicCacheMetadata({
      profileImage: "https://example.com/generated-substack-avatar.jpg",
      subscribersCount: 10,
      subscribersCountRaw: "10 subscribers",
      sourceLabel: "peter.ryszkiewicz.us",
    }),
  );

  // Act
  const merged = mergeMetadataWithManualSocialProfileOverrides(
    {
      subscribersCount: 25,
      subscribersCountRaw: "25 subscribers",
    },
    cached,
  );

  // Assert
  assert.deepEqual(merged, {
    profileImage: "https://example.com/generated-substack-avatar.jpg",
    subscribersCount: 25,
    subscribersCountRaw: "25 subscribers",
    sourceLabel: "peter.ryszkiewicz.us",
  });
});

test("ignores source-label-only payloads when deciding whether metadata is cacheable", () => {
  // Arrange
  const metadata = {
    sourceLabel: "example.com",
  };

  // Act
  const cacheable = hasCacheablePublicMetadata(metadata);

  // Assert
  assert.equal(cacheable, false);
});

test("preserves Medium social metrics when feed refresh metadata does not include them", () => {
  // Arrange
  const merged = mergePublicCacheMetadataForTarget({
    targetId: "medium-public-feed",
    previous: {
      title: "Stories by Peter Ryszkiewicz on Medium",
      description: "Stories by Peter Ryszkiewicz on Medium",
      image: "https://cdn-images-1.medium.com/original-avatar.jpg",
      profileImage: "https://cdn-images-1.medium.com/original-avatar.jpg",
      handle: "peterryszkiewicz",
      followersCount: 3300,
      followersCountRaw: "3.3K followers",
    },
    next: {
      title: "Stories by Peter (Justice for the Victims) Ryszkiewicz on Medium",
      description: "Stories by Peter (Justice for the Victims) Ryszkiewicz on Medium",
      image: "https://cdn-images-1.medium.com/refreshed-avatar.jpg",
      profileImage: "https://cdn-images-1.medium.com/refreshed-avatar.jpg",
      handle: "peterryszkiewicz",
      sourceLabel: "medium.com",
    },
  });

  // Assert
  assert.equal(merged.followersCount, 3300);
  assert.equal(merged.followersCountRaw, "3.3K followers");
  assert.equal(merged.title, "Stories by Peter (Justice for the Victims) Ryszkiewicz on Medium");
  assert.equal(merged.image, "https://cdn-images-1.medium.com/refreshed-avatar.jpg");
});

test("preserves X audience metrics when oEmbed refresh metadata does not include them", () => {
  // Arrange
  const merged = mergePublicCacheMetadataForTarget({
    targetId: "x-public-oembed",
    previous: {
      title: "@pryszkie on X",
      description: "Posts and updates from @pryszkie on X.",
      profileDescription:
        "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
      image: "https://unavatar.io/x/pryszkie",
      profileImage: "https://unavatar.io/x/pryszkie",
      followersCount: 1350,
      followersCountRaw: "1,350 Followers",
      followingCount: 643,
      followingCountRaw: "643 Following",
    },
    next: {
      title: "@pryszkie on X",
      description: "Posts and updates from @pryszkie on X.",
      image: "https://unavatar.io/x/pryszkie",
      profileImage: "https://unavatar.io/x/pryszkie",
      sourceLabel: "x.com",
    },
  });

  // Assert
  assert.equal(merged.followersCount, 1350);
  assert.equal(merged.followersCountRaw, "1,350 Followers");
  assert.equal(merged.followingCount, 643);
  assert.equal(merged.followingCountRaw, "643 Following");
  assert.equal(
    merged.profileDescription,
    "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
  );
  assert.equal(merged.sourceLabel, "x.com");
});

test("preserves Primal audience metrics when profile refresh metadata does not include them", () => {
  // Arrange
  const merged = mergePublicCacheMetadataForTarget({
    targetId: "primal-public-profile",
    previous: {
      title: "Peter No Taxation Without Representation Ryszkiewicz",
      description:
        "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
      image: "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
      profileImage: "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
      followersCount: 15,
      followersCountRaw: "15 followers",
      followingCount: 90,
      followingCountRaw: "90 following",
    },
    next: {
      title: "Peter No Taxation Without Representation Ryszkiewicz",
      description:
        "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
      image: "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
      profileImage: "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
      sourceLabel: "primal.net",
    },
  });

  // Assert
  assert.equal(merged.followersCount, 15);
  assert.equal(merged.followersCountRaw, "15 followers");
  assert.equal(merged.followingCount, 90);
  assert.equal(merged.followingCountRaw, "90 following");
  assert.equal(merged.sourceLabel, "primal.net");
});
