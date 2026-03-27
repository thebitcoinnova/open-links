import type { OpenLink } from "../content/load-content";
import {
  type SupportedSocialProfilePlatform,
  resolveSupportedSocialProfile,
} from "../content/social-profile-fields";

export interface ResolvedProfileQuickLink {
  id: string;
  label: string;
  url: string;
  icon?: string;
  platform: SupportedSocialProfilePlatform;
  contentOrder: number;
}

export const PROFILE_QUICK_LINK_PRIORITY = [
  "x",
  "youtube",
  "instagram",
  "linkedin",
  "github",
  "facebook",
  "medium",
  "substack",
  "primal",
  "cluborange",
] as const satisfies readonly SupportedSocialProfilePlatform[];

const priorityLookup = new Map<SupportedSocialProfilePlatform, number>(
  PROFILE_QUICK_LINK_PRIORITY.map((platform, index) => [platform, index] as const),
);

const compareByContentOrder = (
  left: ResolvedProfileQuickLink,
  right: ResolvedProfileQuickLink,
): number => {
  if (left.contentOrder !== right.contentOrder) {
    return left.contentOrder - right.contentOrder;
  }

  return left.id.localeCompare(right.id);
};

const resolveContentOrder = (link: OpenLink, index: number): number =>
  typeof link.order === "number" && Number.isFinite(link.order) ? link.order : index;

const compareQuickLinks = (
  left: ResolvedProfileQuickLink,
  right: ResolvedProfileQuickLink,
): number => {
  const leftPriority = priorityLookup.get(left.platform);
  const rightPriority = priorityLookup.get(right.platform);
  const leftRank = leftPriority ?? Number.MAX_SAFE_INTEGER;
  const rightRank = rightPriority ?? Number.MAX_SAFE_INTEGER;

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return compareByContentOrder(left, right);
};

const resolveQuickLinkCandidate = (
  link: OpenLink,
  index: number,
): ResolvedProfileQuickLink | null => {
  if (link.enabled === false || !link.url) {
    return null;
  }

  const maybe_supported_profile = resolveSupportedSocialProfile({
    url: link.url,
    icon: link.icon,
    metadataHandle: link.metadata?.handle,
    profileSemantics: link.enrichment?.profileSemantics,
  });

  if (!maybe_supported_profile) {
    return null;
  }

  return {
    id: link.id,
    label: link.label,
    url: link.url,
    icon: link.icon,
    platform: maybe_supported_profile.platform,
    contentOrder: resolveContentOrder(link, index),
  };
};

export const resolveProfileQuickLinks = (links: OpenLink[]): ResolvedProfileQuickLink[] => {
  const candidates = links
    .map((link, index) => resolveQuickLinkCandidate(link, index))
    .filter((link): link is ResolvedProfileQuickLink => Boolean(link))
    .sort(compareQuickLinks);

  const winners = new Map<SupportedSocialProfilePlatform, ResolvedProfileQuickLink>();

  for (const candidate of candidates) {
    if (!winners.has(candidate.platform)) {
      winners.set(candidate.platform, candidate);
    }
  }

  return Array.from(winners.values()).sort(compareQuickLinks);
};
