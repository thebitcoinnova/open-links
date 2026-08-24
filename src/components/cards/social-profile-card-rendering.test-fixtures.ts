import assert from "node:assert/strict";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import {
  buildNonPaymentCardViewModel,
  buildRichCardViewModel,
  buildSimpleCardViewModel,
  resolveLinkCardDescription,
  resolveLinkSourcePresentation,
  resolveProfilePreviewRenderKind,
} from "../../lib/ui/rich-card-policy";
import { resolveSocialProfileMetadata } from "../../lib/ui/social-profile-metadata";

export const site = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
  ui: {
    richCards: {
      renderMode: "auto",
      sourceLabelDefault: "show",
      imageTreatment: "cover",
      mobile: {
        imageLayout: "inline",
      },
    },
  },
} as const satisfies SiteData;

export const instagramProfileLink = {
  id: "instagram",
  label: "Instagram",
  url: "https://www.instagram.com/peterryszkiewicz/",
  type: "rich",
  icon: "instagram",
  description: "Photos and stories",
  metadata: {
    title:
      "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz) • Instagram photos and videos",
    description:
      "86 Followers, 169 Following, 36 Posts - See Instagram photos and videos from Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
    sourceLabel: "instagram.com",
    handle: "peterryszkiewicz",
    profileImage: "/cache/content-images/avatar.jpg",
    image: "/cache/content-images/avatar.jpg",
    followersCount: 86,
    followersCountRaw: "86 Followers",
    followingCount: 169,
    followingCountRaw: "169 Following",
  },
} as const satisfies OpenLink;

export const githubRichLink = {
  id: "github",
  label: "GitHub",
  url: "https://github.com/pRizz",
  type: "rich",
  icon: "github",
  description: "Code, experiments, and open-source projects",
  metadata: {
    title: "pRizz - Overview",
    description:
      "An agentic engineer, making things in the AI space, Bitcoin space, and many others. - pRizz",
    sourceLabel: "github.com",
    handle: "prizz",
    image: "/cache/content-images/github-avatar.jpg",
    followersCount: 90,
    followersCountRaw: "90 followers",
    followingCount: 87,
    followingCountRaw: "87 following",
  },
} as const satisfies OpenLink;

export const xRichLink = {
  id: "x",
  label: "X",
  url: "https://x.com/pryszkie",
  type: "rich",
  icon: "x",
  description: "Short updates and project notes",
  metadata: {
    title: "@pryszkie on X",
    description: "Posts and updates from @pryszkie on X.",
    profileDescription:
      "We the people demand justice for the victims. Otherwise, our politicians no longer represent us. Therefore, no taxation without representation.",
    sourceLabel: "x.com",
    handle: "pryszkie",
    image: "/cache/content-images/x-avatar.jpg",
    profileImage: "/cache/content-images/x-avatar.jpg",
    followersCount: 1350,
    followersCountRaw: "1,350 Followers",
    followingCount: 648,
    followingCountRaw: "648 Following",
  },
} as const satisfies OpenLink;

export const xCommunityRichLink = {
  id: "x-community",
  label: "PARANOID BITCOIN ANARCHISTS",
  url: "https://x.com/i/communities/1871996451812769951",
  type: "rich",
  icon: "x",
  description: "Bitcoin community",
  metadata: {
    title: "PARANOID BITCOIN ANARCHISTS",
    description:
      "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
    sourceLabel: "x.com",
    image:
      "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
    membersCount: 785,
    membersCountRaw: "785 Members",
  },
} as const satisfies OpenLink;

export const primalRichLink = {
  id: "primal",
  label: "Primal",
  url: "https://primal.net/peterryszkiewicz",
  type: "rich",
  icon: "primal",
  description: "Nostr profile and notes",
  metadata: {
    title: "Peter No Taxation Without Representation Ryszkiewicz",
    description: "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
    sourceLabel: "primal.net",
    handle: "peterryszkiewicz",
    image: "/cache/content-images/primal-avatar.jpg",
    profileImage: "/cache/content-images/primal-avatar.jpg",
    followersCount: 15,
    followersCountRaw: "15 followers",
    followingCount: 90,
    followingCountRaw: "90 following",
  },
} as const satisfies OpenLink;

export const rumbleImageOnlyRichLink = {
  id: "rumble",
  label: "Rumble",
  url: "https://rumble.com/c/InTheLitterBox",
  type: "rich",
  icon: "rumble",
  description: "Channel videos and livestreams",
  metadata: {
    title: "In The Litter Box w/ Jewels & Catturd",
    description:
      'Browse the most recent videos from channel "In The Litter Box w/ Jewels & Catturd" uploaded to Rumble.com',
    sourceLabel: "rumble.com",
    image: "/cache/content-images/rumble-avatar.jpg",
    followersCount: 112000,
    followersCountRaw: "112K Followers",
  },
} as const satisfies OpenLink;

export const linkedinRichLink = {
  id: "linkedin",
  label: "LinkedIn",
  url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
  type: "rich",
  icon: "linkedin",
  description: "Professional profile and recent work",
  metadata: {
    title: "Peter Ryszkiewicz | LinkedIn",
    description:
      "Talented software engineer, excited to work on new and challenging problems. · Experience: Venmo · Education: Illinois Institute of Technology · Location: Chicago · 190 connections on LinkedIn. View Peter Ryszkiewicz’s profile on LinkedIn, a professional community of 1 billion members.",
    profileDescription:
      "Talented software engineer, excited to work on new and challenging problems.",
    sourceLabel: "linkedin.com",
    image: "/cache/rich-authenticated/linkedin-avatar.jpg",
  },
} as const satisfies OpenLink;

export const mediumRichLink = {
  id: "medium",
  label: "Medium",
  url: "https://medium.com/@peterryszkiewicz",
  type: "rich",
  icon: "medium",
  description: "Articles and blog posts",
  metadata: {
    title: "Stories by Peter Ryszkiewicz on Medium",
    description: "Stories by Peter Ryszkiewicz on Medium",
    sourceLabel: "medium.com",
    handle: "peterryszkiewicz",
    image: "/cache/content-images/medium-avatar.jpg",
    profileImage: "/cache/content-images/medium-avatar.jpg",
    followersCount: 3300,
    followersCountRaw: "3.3K followers",
  },
} as const satisfies OpenLink;

export const substackRichLink = {
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  description: "Newsletter and long-form writing",
  metadata: {
    title: "Peter Ryszkiewicz | Substack",
    description: "Software Engineer",
    sourceLabel: "peter.ryszkiewicz.us",
    handle: "peterryszkiewicz",
    image: "/cache/content-images/substack-preview.jpg",
    profileImage: "/cache/content-images/substack-avatar.jpg",
  },
} as const satisfies OpenLink;

export const articleRichLink = {
  id: "article",
  label: "Engineering Notes",
  url: "https://notes.openlinks.dev/launch-notes",
  type: "rich",
  icon: "notion",
  description: "Shipping notes and technical writeups",
  metadata: {
    title: "Engineering Notes",
    description: "Shipping notes and technical writeups",
    image: "/cache/content-images/article-preview.jpg",
    sourceLabel: "notes.openlinks.dev",
  },
} as const satisfies OpenLink;

export const blogRichLink = {
  id: "blog",
  label: "Engineering Notes",
  url: "https://notes.openlinks.dev/launch-notes",
  type: "rich",
  icon: "notion",
  description: "Shipping notes and technical writeups",
  metadata: {
    title: "Engineering Notes",
    description: "Shipping notes and technical writeups",
    sourceLabel: "notes.openlinks.dev",
  },
} as const satisfies OpenLink;

export const clubOrangeReferralRichLink = {
  id: "cluborange-referral",
  label: "Join Club Orange",
  url: "https://app.cluborange.org/pryszkie",
  type: "rich",
  icon: "cluborange",
  description: "Manual signup copy",
  metadata: {
    title: "Join Club Orange",
    description: "Fetched signup copy",
    sourceLabel: "app.cluborange.org",
    image: "/cache/content-images/cluborange-referral-preview.jpg",
    profileImage: "/cache/content-images/cluborange-referral-avatar.jpg",
  },
  enrichment: {
    profileSemantics: "non_profile",
  },
  referral: {
    kind: "referral",
    visitorBenefit: "Join Club Orange starting at $40/year",
    ownerBenefit: "Supports the project",
    offerSummary: "Get Club Orange access and connect with Bitcoin builders.",
    termsSummary: "Pricing varies by plan. Terms apply.",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
  },
} as const satisfies OpenLink;

export const instagramSimpleLink = {
  ...instagramProfileLink,
  id: "instagram-simple",
  type: "simple",
} as const satisfies OpenLink;

export const substackSimpleLink = {
  ...substackRichLink,
  id: "substack-simple",
  type: "simple",
} as const satisfies OpenLink;

export const workSimpleLink = {
  id: "work",
  label: "OpenLinks",
  url: "https://openlinks.dev",
  type: "simple",
  icon: "globe",
  description: "Open source links site",
  metadata: {
    title: "OpenLinks project site",
    description: "Open source links site",
    sourceLabel: "openlinks.dev",
  },
} as const satisfies OpenLink;

export const emailSimpleLink = {
  id: "email",
  label: "Email",
  url: "mailto:Hello.Team@example.com?subject=Hi%20there",
  type: "simple",
} as const satisfies OpenLink;

export const customEmailSimpleLink = {
  id: "business-email",
  label: "Business Email",
  url: "mailto:hello@example.com",
  type: "simple",
} as const satisfies OpenLink;

export const describedEmailSimpleLink = {
  id: "press-email",
  label: "Press Email",
  url: "mailto:press@example.com",
  type: "simple",
  description: "For media requests and interview coordination",
} as const satisfies OpenLink;
