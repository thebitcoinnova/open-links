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

export interface ResolvedProfileQuickLinksState {
  hasAny: boolean;
  items: ResolvedProfileQuickLink[];
}

interface QuickLinkCandidate extends ResolvedProfileQuickLink {
  isCanonical: boolean;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveCanonicalQuickLink = (link: OpenLink): boolean => {
  const maybe_custom = link.custom;

  if (!isRecord(maybe_custom)) {
    return false;
  }

  const maybe_quick_links = maybe_custom.quickLinks;
  if (!isRecord(maybe_quick_links)) {
    return false;
  }

  return maybe_quick_links.canonical === true;
};

const compareCandidatesWithinPlatform = (
  left: QuickLinkCandidate,
  right: QuickLinkCandidate,
): number => {
  if (left.isCanonical !== right.isCanonical) {
    return left.isCanonical ? -1 : 1;
  }

  return compareByContentOrder(left, right);
};

const resolveQuickLinkCandidate = (link: OpenLink, index: number): QuickLinkCandidate | null => {
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
    isCanonical: resolveCanonicalQuickLink(link),
  };
};

export const resolveProfileQuickLinks = (links: OpenLink[]): ResolvedProfileQuickLink[] => {
  const candidates = links
    .map((link, index) => resolveQuickLinkCandidate(link, index))
    .filter((link): link is QuickLinkCandidate => Boolean(link))
    .sort(compareQuickLinks);

  const winners = new Map<SupportedSocialProfilePlatform, QuickLinkCandidate>();

  for (const candidate of candidates) {
    const maybe_existing = winners.get(candidate.platform);
    if (!maybe_existing) {
      winners.set(candidate.platform, candidate);
      continue;
    }

    if (compareCandidatesWithinPlatform(candidate, maybe_existing) < 0) {
      winners.set(candidate.platform, candidate);
    }
  }

  return Array.from(winners.values())
    .sort(compareQuickLinks)
    .map(({ isCanonical: _isCanonical, ...quickLink }) => quickLink);
};

export const resolveProfileQuickLinksState = (
  links: OpenLink[],
): ResolvedProfileQuickLinksState => {
  const items = resolveProfileQuickLinks(links);

  return {
    hasAny: items.length > 0,
    items,
  };
};
