import type { PublicCacheEntry, PublicCacheRegistry } from "./enrichment/public-cache";
import type { PublicBrowserAudienceCaptureResult } from "./public-rich-sync-contracts";

export const mediumLink = {
  id: "medium",
  label: "Medium",
  url: "https://medium.com/@peterryszkiewicz",
  type: "rich",
  icon: "medium",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

export const secondMediumLink = {
  id: "medium-two",
  label: "Medium 2",
  url: "https://medium.com/@anotherperson",
  type: "rich",
  icon: "medium",
  metadata: {
    handle: "anotherperson",
  },
} as const;

export const xLink = {
  id: "x",
  label: "X",
  url: "https://x.com/pryszkie",
  type: "rich",
  icon: "x",
  metadata: {
    handle: "pryszkie",
  },
} as const;

export const xCommunityLink = {
  id: "x-community",
  label: "PARANOID BITCOIN ANARCHISTS",
  url: "https://x.com/i/communities/1871996451812769951",
  type: "rich",
  icon: "x",
} as const;

export const instagramLink = {
  id: "instagram",
  label: "Instagram",
  url: "https://www.instagram.com/peterryszkiewicz/",
  type: "rich",
  icon: "instagram",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

export const primalLink = {
  id: "primal",
  label: "Primal",
  url: "https://primal.net/peterryszkiewicz",
  type: "rich",
  icon: "primal",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

export const youtubeLink = {
  id: "youtube",
  label: "YouTube",
  url: "https://www.youtube.com/@peterryszkiewicz4354",
  type: "rich",
  icon: "youtube",
} as const;

export const substackLink = {
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  metadata: {
    handle: "peterryszkiewicz",
  },
} as const;

export const brightBuildsFacebookLink = {
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

export const emptyRegistry = (): PublicCacheRegistry => ({
  version: 1,
  updatedAt: "2026-03-08T14:00:00.000Z",
  entries: {},
});

export const createMediumBaseEntry = (
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

export const createXBaseEntry = (
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

export const createXCommunityBaseEntry = (
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

export const createInstagramBaseEntry = (
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

export const createPrimalBaseEntry = (
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

export const createYoutubeBaseEntry = (
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

export const createSubstackBaseEntry = (
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

export const captureSuccess = (
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

export const captureFailure = (
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
