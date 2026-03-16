import {
  mergeMetadataWithManualSocialProfileOverrides,
  normalizeSupportedSocialProfileMetadata,
  resolveSupportedSocialProfile,
} from "./social-profile-fields";

export const CONTENT_IMAGE_FIELDS = ["image", "profileImage", "ogImage", "twitterImage"] as const;
export type ContentImageField = (typeof CONTENT_IMAGE_FIELDS)[number];

export const SITE_SEO_CONTENT_IMAGE_FIELDS = [
  "socialImageFallback",
  "defaults.ogImage",
  "defaults.twitterImage",
  "overrides.profile.ogImage",
  "overrides.profile.twitterImage",
] as const;
export type SiteSeoContentImageField = (typeof SITE_SEO_CONTENT_IMAGE_FIELDS)[number];

export interface ContentImageMetadataLike {
  image?: string;
  profileImage?: string;
  ogImage?: string;
  twitterImage?: string;
  handle?: string;
  [key: string]: unknown;
}

export interface ContentImageLinkInput {
  id?: unknown;
  url?: unknown;
  icon?: unknown;
  metadata?: ContentImageMetadataLike;
}

export interface GeneratedRichMetadataInput {
  links?: Record<string, { metadata?: ContentImageMetadataLike }>;
}

export interface ContentImageSiteInput {
  quality?: {
    seo?: {
      socialImageFallback?: unknown;
      defaults?: {
        ogImage?: unknown;
        twitterImage?: unknown;
      };
      overrides?: {
        profile?: {
          ogImage?: unknown;
          twitterImage?: unknown;
        };
      };
    };
  };
}

export interface ContentImageSlotCandidate {
  slotId: string;
  sourceUrl: string;
}

export interface GeneratedContentImageSlotEntry {
  resolvedPath?: string;
}

const SITE_SEO_CONTENT_IMAGE_SLOT_SEGMENTS: Record<SiteSeoContentImageField, string[]> = {
  socialImageFallback: ["socialImageFallback"],
  "defaults.ogImage": ["defaults", "ogImage"],
  "defaults.twitterImage": ["defaults", "twitterImage"],
  "overrides.profile.ogImage": ["overrides", "profile", "ogImage"],
  "overrides.profile.twitterImage": ["overrides", "profile", "twitterImage"],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const hasUrlScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);

const toCanonicalHttpUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
};

export const resolveContentImageLinkId = (linkId: unknown, index: number): string => {
  const resolved = trimToUndefined(linkId);
  return resolved ?? `links[${index}]`;
};

export const getLinkContentImageSlotId = (linkId: string, field: ContentImageField): string =>
  `link:${linkId}:${field}`;

export const getSiteSeoContentImageSlotId = (field: SiteSeoContentImageField): string =>
  `site:seo:${SITE_SEO_CONTENT_IMAGE_SLOT_SEGMENTS[field].join(":")}`;

const pushSlotCandidate = (
  candidates: ContentImageSlotCandidate[],
  slotId: string,
  value: unknown,
) => {
  const sourceUrl = trimToUndefined(value);
  if (!sourceUrl) {
    return;
  }

  candidates.push({ slotId, sourceUrl });
};

const resolveGeneratedMetadataForLink = (
  generatedRichMetadata: GeneratedRichMetadataInput | null,
  linkId: string,
): ContentImageMetadataLike | undefined => {
  const generatedLinks = isRecord(generatedRichMetadata?.links) ? generatedRichMetadata.links : {};
  const entry = generatedLinks[linkId];
  return isRecord(entry) && isRecord(entry.metadata)
    ? (entry.metadata as ContentImageMetadataLike)
    : undefined;
};

export const resolveEffectiveLinkContentImageMetadata = (input: {
  link: ContentImageLinkInput;
  generatedMetadata?: ContentImageMetadataLike;
}): ContentImageMetadataLike => {
  const manualMetadata = isRecord(input.link.metadata)
    ? (input.link.metadata as ContentImageMetadataLike)
    : undefined;
  const generatedMetadata = isRecord(input.generatedMetadata) ? input.generatedMetadata : undefined;
  const mergedMetadata = (mergeMetadataWithManualSocialProfileOverrides(
    manualMetadata,
    generatedMetadata,
  ) ?? {}) as ContentImageMetadataLike;
  const supportedProfile = resolveSupportedSocialProfile({
    url: trimToUndefined(input.link.url),
    icon: trimToUndefined(input.link.icon),
    metadataHandle: mergedMetadata.handle ?? manualMetadata?.handle ?? generatedMetadata?.handle,
  });

  return (normalizeSupportedSocialProfileMetadata(mergedMetadata, supportedProfile) ??
    mergedMetadata) as ContentImageMetadataLike;
};

export const collectContentImageSlots = (input: {
  linksPayload: { links?: unknown[] };
  generatedRichMetadata: GeneratedRichMetadataInput | null;
  sitePayload: ContentImageSiteInput;
}): ContentImageSlotCandidate[] => {
  const candidates: ContentImageSlotCandidate[] = [];
  const links = Array.isArray(input.linksPayload.links) ? input.linksPayload.links : [];

  links.forEach((link, index) => {
    if (!isRecord(link)) {
      return;
    }

    const resolvedLinkId = resolveContentImageLinkId(link.id, index);
    const effectiveMetadata = resolveEffectiveLinkContentImageMetadata({
      link: link as ContentImageLinkInput,
      generatedMetadata: resolveGeneratedMetadataForLink(
        input.generatedRichMetadata,
        resolvedLinkId,
      ),
    });

    for (const field of CONTENT_IMAGE_FIELDS) {
      pushSlotCandidate(
        candidates,
        getLinkContentImageSlotId(resolvedLinkId, field),
        effectiveMetadata[field],
      );
    }
  });

  const seo = input.sitePayload.quality?.seo;
  pushSlotCandidate(
    candidates,
    getSiteSeoContentImageSlotId("socialImageFallback"),
    seo?.socialImageFallback,
  );
  pushSlotCandidate(
    candidates,
    getSiteSeoContentImageSlotId("defaults.ogImage"),
    seo?.defaults?.ogImage,
  );
  pushSlotCandidate(
    candidates,
    getSiteSeoContentImageSlotId("defaults.twitterImage"),
    seo?.defaults?.twitterImage,
  );
  pushSlotCandidate(
    candidates,
    getSiteSeoContentImageSlotId("overrides.profile.ogImage"),
    seo?.overrides?.profile?.ogImage,
  );
  pushSlotCandidate(
    candidates,
    getSiteSeoContentImageSlotId("overrides.profile.twitterImage"),
    seo?.overrides?.profile?.twitterImage,
  );

  return candidates;
};

export const resolveContentImageResolvedPathForSlot = (input: {
  candidate: string | undefined;
  slotId?: string;
  generatedBySlot: Record<string, GeneratedContentImageSlotEntry>;
}): string | undefined => {
  const candidate = trimToUndefined(input.candidate);
  if (!candidate) {
    return undefined;
  }

  if (!hasUrlScheme(candidate)) {
    return candidate;
  }

  if (!toCanonicalHttpUrl(candidate) || !input.slotId) {
    return undefined;
  }

  const entry = input.generatedBySlot[input.slotId];
  return trimToUndefined(entry?.resolvedPath);
};
