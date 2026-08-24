import type { OpenLink } from "../../src/lib/content/load-content";
import type { resolveSnapshots } from "../sync-follower-history";

export const createPublicRegistry = (
  entries: Parameters<typeof resolveSnapshots>[1]["entries"],
): Parameters<typeof resolveSnapshots>[1] => ({
  version: 1,
  updatedAt: "2026-03-12T06:00:00.000Z",
  entries,
});

export const createYoutubeLink = (): OpenLink => ({
  id: "youtube",
  label: "YouTube",
  url: "https://www.youtube.com/@example",
  type: "rich",
  icon: "youtube",
  enabled: true,
});

export const createSubstackLink = (): OpenLink => ({
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  enabled: true,
  metadata: {
    handle: "peterryszkiewicz",
  },
});

export const createXProfileLink = (input?: {
  enrichment?: OpenLink["enrichment"];
  metadata?: OpenLink["metadata"];
}): OpenLink => ({
  id: "x",
  label: "X",
  url: "https://x.com/example",
  type: "rich",
  icon: "x",
  enabled: true,
  enrichment: input?.enrichment,
  metadata: input?.metadata,
});

export const createXCommunityLink = (): OpenLink => ({
  id: "x-community",
  label: "X Community",
  url: "https://x.com/i/communities/1871996451812769951",
  type: "rich",
  icon: "x",
  enabled: true,
});

export const createBrightBuildsFacebookLink = (): OpenLink => ({
  id: "bright-builds-facebook",
  label: "Bright Builds LLC",
  url: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
  type: "rich",
  icon: "facebook",
  enabled: true,
  metadata: {
    title: "Bright Builds LLC",
    profileDescription: "Chicago software engineering, open-source work, and business updates.",
  },
  enrichment: {
    enabled: false,
    authenticatedExtractor: "facebook-auth-browser",
    facebookPageMetrics: {
      enabled: true,
      pageId: "1002804269589824",
    },
  },
});

export const createYoutubePublicRegistry = (): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    youtube: {
      linkId: "youtube",
      sourceUrl: "https://www.youtube.com/@example/about",
      capturedAt: "2026-03-12T06:00:00.000Z",
      updatedAt: "2026-03-12T06:00:00.000Z",
      metadata: {
        title: "Example - YouTube",
        description: "Videos from Example.",
        image: "https://yt3.googleusercontent.com/avatar.jpg",
        profileImage: "https://yt3.googleusercontent.com/avatar.jpg",
        sourceLabel: "youtube.com",
        subscribersCount: 9200,
        subscribersCountRaw: "9.2K subscribers",
      },
    },
  });

export const createSubstackPublicRegistry = (): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    substack: {
      linkId: "substack",
      sourceUrl: "https://substack.com/@peterryszkiewicz",
      capturedAt: "2026-05-12T12:00:00.000Z",
      updatedAt: "2026-05-12T12:00:00.000Z",
      metadata: {
        title: "Peter Ryszkiewicz",
        description: "I'm an agentic engineer, making things in the AI space.",
        image: "https://substackcdn.com/profile-card.jpg",
        profileImage: "https://substackcdn.com/avatar.jpg",
        handle: "peterryszkiewicz",
        sourceLabel: "peter.ryszkiewicz.us",
        subscribersCount: 15,
        subscribersCountRaw: "15 subscribers",
      },
    },
  });

export const createXProfilePublicRegistry = (
  metadata: Parameters<typeof resolveSnapshots>[1]["entries"][string]["metadata"],
): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    x: {
      linkId: "x",
      sourceUrl:
        "https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fexample&omit_script=true&hide_thread=true&dnt=true",
      capturedAt: "2026-07-23T17:25:00.000Z",
      updatedAt: "2026-07-23T17:25:00.000Z",
      metadata,
    },
  });

export const createXCommunityPublicRegistry = (
  metadata: Parameters<typeof resolveSnapshots>[1]["entries"][string]["metadata"],
): Parameters<typeof resolveSnapshots>[1] =>
  createPublicRegistry({
    "x-community": {
      linkId: "x-community",
      sourceUrl: "https://x.com/i/communities/1871996451812769951",
      capturedAt: "2026-07-23T17:25:00.000Z",
      updatedAt: "2026-07-23T17:25:00.000Z",
      metadata,
    },
  });

export const createBrightBuildsFacebookPublicRegistry = (): Parameters<
  typeof resolveSnapshots
>[1] =>
  createPublicRegistry({
    "bright-builds-facebook": {
      linkId: "bright-builds-facebook",
      sourceUrl:
        "https://graph.facebook.com/v24.0/1002804269589824?fields=id%2Cname%2Cfollowers_count%2Cfan_count",
      capturedAt: "2026-05-31T12:00:00.000Z",
      updatedAt: "2026-05-31T12:00:00.000Z",
      metadata: {
        sourceLabel: "facebook.com",
        followersCount: 41,
        followersCountRaw: "41 followers",
      },
    },
  });
