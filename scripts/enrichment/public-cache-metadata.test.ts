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

test("keeps Instagram browser-captured audience metrics authoritative over stale metadata", () => {
  // Arrange
  const merged = mergePublicCacheMetadataForTarget({
    targetId: "instagram-public-profile",
    previous: {
      title: "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
      description:
        "89 Followers, 177 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
      image: "https://scontent.cdninstagram.com/original-avatar.jpg",
      profileImage: "https://scontent.cdninstagram.com/original-avatar.jpg",
      followersCount: 100,
      followersCountRaw: "100 followers",
      followingCount: 206,
      followingCountRaw: "206 following",
    },
    next: {
      title: "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
      description:
        "99 Followers, 210 Following, 10 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
      image: "https://scontent.cdninstagram.com/refreshed-avatar.jpg",
      profileImage: "https://scontent.cdninstagram.com/refreshed-avatar.jpg",
      followersCount: 99,
      followersCountRaw: "99 Followers",
      followingCount: 210,
      followingCountRaw: "210 Following",
      sourceLabel: "instagram.com",
    },
  });

  // Assert
  assert.equal(merged.followersCount, 100);
  assert.equal(merged.followersCountRaw, "100 followers");
  assert.equal(merged.followingCount, 206);
  assert.equal(merged.followingCountRaw, "206 following");
  assert.equal(merged.description, undefined);
  assert.equal(merged.image, "https://scontent.cdninstagram.com/refreshed-avatar.jpg");
  assert.equal(merged.sourceLabel, "instagram.com");
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

test("preserves X community member counts when page refresh metadata does not include them", () => {
  // Arrange
  const merged = mergePublicCacheMetadataForTarget({
    targetId: "x-public-community",
    previous: {
      title: "PARANOID BITCOIN ANARCHISTS",
      description:
        "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
      image:
        "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
      membersCount: 785,
      membersCountRaw: "785 Members",
    },
    next: {
      title: "PARANOID BITCOIN ANARCHISTS",
      description:
        "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
      image:
        "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
      sourceLabel: "x.com",
    },
  });

  // Assert
  assert.equal(merged.membersCount, 785);
  assert.equal(merged.membersCountRaw, "785 Members");
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
