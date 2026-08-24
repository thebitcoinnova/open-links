import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { mergeMetadataWithManualSocialProfileOverrides } from "../../src/lib/content/social-profile-fields";
import {
  applyPublicCachePersistence,
  buildPublicCacheEntry,
  computePublicCacheExpiresAt,
  hasCacheablePublicMetadata,
  isPublicCacheFresh,
  isPublicCacheIdentityMatch,
  loadPublicCacheRegistry,
  mergePublicCacheMetadataForTarget,
  prunePublicCacheMetadataForTarget,
  resolveCachedEntryStatus,
  resolvePublicCacheEntry,
  resolvePublicCacheMetadataRegression,
  toEnrichmentMetadataFromPublicCache,
  toPublicCacheMetadata,
  writePublicCacheRegistry,
  writePublicCacheRuntimeRegistry,
} from "./public-cache";
import type { PublicCacheRegistry } from "./public-cache";

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

test("matches public cache identity by stable link id and exact resolved source URL", () => {
  // Arrange
  const entry = {
    linkId: "x",
    sourceUrl: "https://publish.twitter.com/oembed?url=old",
  };

  // Act / Assert
  assert.equal(
    isPublicCacheIdentityMatch(entry, "x", "https://publish.twitter.com/oembed?url=old"),
    true,
  );
  assert.equal(
    isPublicCacheIdentityMatch(entry, "x", "https://publish.twitter.com/oembed?url=new"),
    false,
  );
  assert.equal(isPublicCacheIdentityMatch(entry, "replacement-x", entry.sourceUrl), false);
});

test("prunes unrelated audience counts from X profile metadata", () => {
  // Arrange
  const metadata = {
    followersCount: 5828,
    followersCountRaw: "5,828 Followers",
    followingCount: 4497,
    followingCountRaw: "4,497 Following",
    membersCount: 1000,
    membersCountRaw: "1K members",
    subscribersCount: 500,
    subscribersCountRaw: "500 subscribers",
  };

  // Act
  const pruned = prunePublicCacheMetadataForTarget({
    targetId: "x-public-oembed",
    metadata,
    audienceMetricsAreAuthoritative: true,
  });

  // Assert
  assert.deepEqual(pruned, {
    followersCount: 5828,
    followersCountRaw: "5,828 Followers",
    followingCount: 4497,
    followingCountRaw: "4,497 Following",
  });
});

test("does not resolve a public cache entry across a renamed source identity", () => {
  // Arrange
  const registry: PublicCacheRegistry = {
    version: 1,
    updatedAt: "2026-07-18T00:00:00.000Z",
    entries: {
      x: {
        linkId: "x",
        sourceUrl: "https://publish.twitter.com/oembed?url=old",
        capturedAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:00.000Z",
        metadata: {
          title: "@old on X",
          description: "Posts and updates from @old on X.",
          image: "https://unavatar.io/x/old",
          followersCount: 100,
        },
      },
    },
  };

  // Act
  const resolved = resolvePublicCacheEntry(
    registry,
    "x",
    "https://publish.twitter.com/oembed?url=new",
  );

  // Assert
  assert.equal(resolved, null);
});

test("resets every inherited cache field when a source identity changes", () => {
  // Arrange
  const previous = {
    linkId: "x",
    sourceUrl: "https://publish.twitter.com/oembed?url=old",
    capturedAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    metadata: {
      title: "@old on X",
      description: "Posts and updates from @old on X.",
      image: "https://unavatar.io/x/old",
      followersCount: 100,
      followersCountRaw: "100 Followers",
    },
    etag: '"old"',
    lastModified: "Fri, 18 Jul 2026 00:00:00 GMT",
    cacheControl: "max-age=300",
    expiresAt: "2026-07-18T00:05:00.000Z",
    checkedAt: "2026-07-18T00:00:00.000Z",
    checkStatus: "fetched" as const,
  };

  // Act
  const next = buildPublicCacheEntry({
    previous,
    linkId: "x",
    sourceUrl: "https://publish.twitter.com/oembed?url=new",
    metadata: {
      title: "@new on X",
      description: "Posts and updates from @new on X.",
      image: "https://unavatar.io/x/new",
    },
    updatedAt: "2026-07-23T00:00:00.000Z",
  });

  // Assert
  assert.deepEqual(next, {
    linkId: "x",
    sourceUrl: "https://publish.twitter.com/oembed?url=new",
    capturedAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    metadata: {
      title: "@new on X",
      description: "Posts and updates from @new on X.",
      image: "https://unavatar.io/x/new",
    },
  });
});

test("retains complete same-source metadata when a refresh regresses", () => {
  // Arrange
  const previous = {
    linkId: "altair-tech",
    sourceUrl: "https://altairtech.io/",
    capturedAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    metadata: {
      title: "Altair",
      description: "Complete last-known-good metadata.",
      image: "https://altairtech.io/preview.jpg",
    },
  };

  // Act
  const fallback = resolvePublicCacheMetadataRegression({
    previous,
    linkId: "altair-tech",
    sourceUrl: "https://altairtech.io/",
    nextMetadata: {
      title: "Altair",
    },
  });

  // Assert
  assert.equal(fallback, previous);
});

test("never treats a source identity change as a metadata regression fallback", () => {
  // Arrange
  const previous = {
    linkId: "x",
    sourceUrl: "https://publish.twitter.com/oembed?url=old",
    capturedAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    metadata: {
      title: "@old on X",
      description: "Posts and updates from @old on X.",
      image: "https://unavatar.io/x/old",
    },
  };

  // Act
  const fallback = resolvePublicCacheMetadataRegression({
    previous,
    linkId: "x",
    sourceUrl: "https://publish.twitter.com/oembed?url=new",
    nextMetadata: {
      title: "@new on X",
    },
  });

  // Assert
  assert.equal(fallback, null);
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
  assert.equal(stableOnDisk.entries.github.etag, '"abc"');
  assert.equal("cacheControl" in stableOnDisk.entries.github, false);
  assert.equal("etag" in runtimeOnDisk.entries.github, false);
  assert.equal(runtimeOnDisk.entries.github.cacheControl, "max-age=300");
  assert.equal(runtimeOnDisk.entries.github.checkedAt, "2026-03-07T12:05:00.000Z");
});

test("writes runtime-only public cache updates without rewriting the stable manifest", (t) => {
  // Arrange
  const cachePath = "tmp/tests/runtime-only-rich-public-cache.json";
  const runtimePath = "tmp/tests/runtime-only-rich-public-cache.runtime.json";
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
            title: "Peter Ryszkiewicz",
            description: "Open source and experiments.",
            image: "https://avatars.githubusercontent.com/u/1?v=4",
          },
          etag: '"old"',
          cacheControl: "max-age=300",
          checkedAt: "2026-03-07T12:05:00.000Z",
        },
      },
    },
    { runtimePath },
  );
  const stableBefore = fs.readFileSync(absoluteCachePath, "utf8");
  const registry = loadPublicCacheRegistry({ cachePath, runtimePath });
  const githubEntry = registry.entries.github;
  assert.ok(githubEntry);
  registry.updatedAt = "2026-03-08T09:00:00.000Z";
  registry.entries.github = {
    ...githubEntry,
    cacheControl: "max-age=900",
    expiresAt: "2026-03-08T09:15:00.000Z",
    checkedAt: "2026-03-08T09:00:00.000Z",
    checkStatus: "get_not_modified",
  };

  // Act
  writePublicCacheRuntimeRegistry(cachePath, registry, { runtimePath });
  const stableAfter = fs.readFileSync(absoluteCachePath, "utf8");
  const runtimeOnDisk = JSON.parse(fs.readFileSync(absoluteRuntimePath, "utf8")) as {
    entries: Record<string, Record<string, unknown>>;
  };

  // Assert
  assert.equal(stableAfter, stableBefore);
  assert.equal("etag" in runtimeOnDisk.entries.github, false);
  assert.equal("lastModified" in runtimeOnDisk.entries.github, false);
  assert.equal(runtimeOnDisk.entries.github.cacheControl, "max-age=900");
  assert.equal(runtimeOnDisk.entries.github.expiresAt, "2026-03-08T09:15:00.000Z");
  assert.equal(runtimeOnDisk.entries.github.checkedAt, "2026-03-08T09:00:00.000Z");
  assert.equal(runtimeOnDisk.entries.github.checkStatus, "get_not_modified");
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
  assert.equal(stableOnDisk.entries.github.etag, '"legacy"');
  assert.equal(runtimeOnDisk.entries.github.expiresAt, "2026-03-08T15:05:00.000Z");
  assert.equal(runtimeOnDisk.entries.github.checkedAt, "2026-03-08T15:00:00.000Z");
});
