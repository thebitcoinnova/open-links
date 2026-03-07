import {
  type SupportedSocialProfileTarget,
  normalizeSupportedSocialProfileMetadata,
} from "../../src/lib/content/social-profile-fields";
import { parseAudienceCount } from "../authenticated-extractors/plugins/social-profile-counts";
import type { EnrichmentMetadata } from "./types";

const safeTrim = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const GITHUB_AUDIENCE_PATTERNS = {
  followers:
    /href="[^"]+\?tab=followers"[\s\S]{0,1600}?<span[^>]*class="[^"]*text-bold[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]{0,120}?\bfollowers\b/i,
  following:
    /href="[^"]+\?tab=following"[\s\S]{0,400}?<span[^>]*class="[^"]*text-bold[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]{0,120}?\bfollowing\b/i,
} as const;

export interface GithubProfileMetadata {
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
}

export const parseGithubProfileMetadata = (html: string): GithubProfileMetadata => {
  const metadata: GithubProfileMetadata = {};

  const followersValue = safeTrim(html.match(GITHUB_AUDIENCE_PATTERNS.followers)?.[1]);
  if (followersValue) {
    const rawText = `${followersValue} followers`;
    metadata.followersCount = parseAudienceCount(rawText);
    metadata.followersCountRaw = rawText;
  }

  const followingValue = safeTrim(html.match(GITHUB_AUDIENCE_PATTERNS.following)?.[1]);
  if (followingValue) {
    const rawText = `${followingValue} following`;
    metadata.followingCount = parseAudienceCount(rawText);
    metadata.followingCountRaw = rawText;
  }

  return metadata;
};

export const augmentSupportedSocialProfileMetadata = (input: {
  html: string;
  metadata: EnrichmentMetadata;
  supportedProfile: SupportedSocialProfileTarget | null;
}): EnrichmentMetadata => {
  const augmented: EnrichmentMetadata = {};

  if (input.supportedProfile?.platform === "github") {
    Object.assign(augmented, parseGithubProfileMetadata(input.html));
  }

  return (
    normalizeSupportedSocialProfileMetadata(
      {
        ...input.metadata,
        ...augmented,
      },
      input.supportedProfile,
    ) ?? {
      ...input.metadata,
      ...augmented,
    }
  );
};
