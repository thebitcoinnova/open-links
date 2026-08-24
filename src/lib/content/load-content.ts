import linksData from "../../../data/links.json";
import profileData from "../../../data/profile.json";
import siteData from "../../../data/site.json";
import { resolvePrimaryPaymentHref } from "../payments/rails";
import { isPaymentCapableLink } from "../payments/types";
import {
  CONTENT_IMAGE_FIELDS,
  getLinkContentImageSlotId,
  resolveContentImageResolvedPathForSlot,
} from "./content-image-slots";
import type {
  GeneratedLinkReferralConfig,
  LinkGroup,
  LinksData,
  OpenLink,
  ProfileData,
  RichLinkMetadata,
  SiteData,
} from "./content-types";
import { resolveEntityType } from "./entity-type";
import { loadReferralCatalog, resolveReferralCatalogForLink } from "./referral-catalog";
import { mergeReferralWithManualOverrides } from "./referral-fields";
import { mergeMetadataWithManualSocialProfileOverrides } from "./social-profile-fields";

export type * from "./content-types";

interface GeneratedRichMetadataPayload {
  generatedAt?: string;
  links?: Record<string, { metadata?: RichLinkMetadata; referral?: GeneratedLinkReferralConfig }>;
}

interface GeneratedProfileAvatarPayload {
  sourceUrl?: string;
  resolvedPath?: string;
  etag?: string;
  lastModified?: string;
  updatedAt?: string;
  contentType?: string;
  bytes?: number;
}

interface GeneratedContentImageEntry {
  resolvedPath?: string;
}

interface GeneratedContentImagesPayload {
  generatedAt?: string;
  bySlot?: Record<string, GeneratedContentImageEntry>;
}

// Keep these as literal import.meta.glob(...) callsites so Vite can statically
// inline the manifest JSON into the browser bundle. Dynamic helper wrappers
// around glob leave runtime with empty manifest maps in production builds.
const generatedMetadataModules = (() => {
  try {
    return import.meta.glob<{ default: GeneratedRichMetadataPayload }>(
      "../../../data/generated/rich-metadata.json",
      { eager: true },
    );
  } catch {
    return {};
  }
})();

const cachedContentImageModules = (() => {
  try {
    return import.meta.glob<{ default: GeneratedContentImagesPayload }>(
      "../../../data/cache/content-images.json",
      { eager: true },
    );
  } catch {
    return {};
  }
})();

const generatedProfileAvatarModules = (() => {
  try {
    return import.meta.glob<{ default: GeneratedProfileAvatarPayload }>(
      "../../../data/cache/profile-avatar.json",
      { eager: true },
    );
  } catch {
    return {};
  }
})();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toLocalAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const trimmedPath = assetPath.replace(/^\/+/, "");
  return `${normalizedBase}${trimmedPath}`;
};

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const PAYMENT_SUPPORT_GROUP: LinkGroup = {
  id: "support",
  label: "Support",
  order: 999,
};

const applyPaymentDefaults = (links: OpenLink[]): OpenLink[] =>
  links.map((link) => {
    const isPaymentLink = isPaymentCapableLink(link);
    const currentUrl = trimToUndefined(link.url);
    const currentGroup = trimToUndefined(link.group);
    const updates: Partial<OpenLink> = {};

    if (isPaymentLink && !currentGroup) {
      updates.group = PAYMENT_SUPPORT_GROUP.id;
    }

    if (link.type === "payment" && !currentUrl) {
      updates.url = resolvePrimaryPaymentHref(link.payment) ?? "";
    } else if (currentUrl !== undefined && currentUrl !== link.url) {
      updates.url = currentUrl;
    }

    if (Object.keys(updates).length === 0) {
      return link;
    }

    return {
      ...link,
      ...updates,
    };
  });

const ensureSupportGroup = (groups: LinkGroup[], links: OpenLink[]): LinkGroup[] => {
  const hasSupportLinks = links.some(
    (link) => trimToUndefined(link.group) === PAYMENT_SUPPORT_GROUP.id,
  );
  const hasSupportGroup = groups.some((group) => group.id === PAYMENT_SUPPORT_GROUP.id);

  if (!hasSupportLinks || hasSupportGroup) {
    return groups;
  }

  return [...groups, PAYMENT_SUPPORT_GROUP];
};

interface GeneratedLinkAugmentation {
  metadata?: RichLinkMetadata;
  referral?: GeneratedLinkReferralConfig;
}

const resolveGeneratedMetadata = (): Record<string, GeneratedLinkAugmentation> => {
  const module = Object.values(generatedMetadataModules)[0];
  const payload = module?.default;

  if (!payload?.links || !isRecord(payload.links)) {
    return {};
  }

  const mapped: Record<string, GeneratedLinkAugmentation> = {};

  for (const [linkId, value] of Object.entries(payload.links)) {
    if (!isRecord(value)) {
      continue;
    }

    const entry: GeneratedLinkAugmentation = {};
    if (isRecord(value.metadata)) {
      entry.metadata = value.metadata as RichLinkMetadata;
    }
    if (isRecord(value.referral)) {
      entry.referral = value.referral as GeneratedLinkReferralConfig;
    }

    if (entry.metadata || entry.referral) {
      mapped[linkId] = entry;
    }
  }

  return mapped;
};

const resolveGeneratedContentImages = (): Record<string, GeneratedContentImageEntry> => {
  const mapped: Record<string, GeneratedContentImageEntry> = {};

  const module = Object.values(cachedContentImageModules)[0];
  const payload = module?.default;
  if (!payload || !isRecord(payload.bySlot)) {
    return mapped;
  }

  for (const [slotId, value] of Object.entries(payload.bySlot)) {
    if (!isRecord(value)) {
      continue;
    }
    mapped[slotId] = value as GeneratedContentImageEntry;
  }

  return mapped;
};

export const resolveGeneratedContentImageUrlForSlot = (input: {
  candidate: string | undefined;
  slotId?: string;
  generatedBySlot: Record<string, GeneratedContentImageEntry>;
}): string | undefined => {
  const resolvedPath = resolveContentImageResolvedPathForSlot({
    candidate: input.candidate,
    slotId: input.slotId,
    generatedBySlot: input.generatedBySlot,
  });
  if (!resolvedPath) {
    return undefined;
  }

  return toLocalAssetUrl(resolvedPath);
};

export const resolveGeneratedContentImageUrl = (input: {
  candidate: string | undefined;
  slotId?: string;
}): string | undefined => {
  const generatedBySlot = resolveGeneratedContentImages();
  return resolveGeneratedContentImageUrlForSlot({
    candidate: input.candidate,
    slotId: input.slotId,
    generatedBySlot,
  });
};

const resolveProfileAvatarPath = (): string => {
  const fallbackPath = "profile-avatar-fallback.svg";
  const module = Object.values(generatedProfileAvatarModules)[0];
  const payload = module?.default;

  if (
    !payload ||
    typeof payload.resolvedPath !== "string" ||
    payload.resolvedPath.trim().length === 0
  ) {
    return toLocalAssetUrl(fallbackPath);
  }

  return toLocalAssetUrl(payload.resolvedPath);
};

const localizeRichMetadataImages = (
  links: OpenLink[],
  generatedBySlot: Record<string, GeneratedContentImageEntry>,
): OpenLink[] =>
  links.map((link) => {
    if (!link.metadata) {
      return link;
    }

    const metadataRecord = { ...link.metadata } as Record<string, unknown>;
    let mutated = false;

    for (const field of CONTENT_IMAGE_FIELDS) {
      const candidate = metadataRecord[field];
      if (typeof candidate !== "string" || candidate.trim().length === 0) {
        continue;
      }

      const resolvedAsset = resolveGeneratedContentImageUrlForSlot({
        candidate,
        slotId: getLinkContentImageSlotId(link.id, field),
        generatedBySlot,
      });
      if (!resolvedAsset) {
        delete metadataRecord[field];
        mutated = true;
        continue;
      }

      if (resolvedAsset !== candidate) {
        metadataRecord[field] = resolvedAsset;
        mutated = true;
      }
    }

    if (!mutated) {
      return link;
    }

    return {
      ...link,
      metadata: metadataRecord as RichLinkMetadata,
    };
  });

export const mergeGeneratedMetadata = (
  links: OpenLink[],
  generatedByLink: Record<string, GeneratedLinkAugmentation>,
  referralCatalog = loadReferralCatalog(),
): OpenLink[] =>
  links.map((link) => {
    const generated = generatedByLink[link.id];
    const catalogResolution = resolveReferralCatalogForLink({
      catalog: referralCatalog,
      sourceUrl: trimToUndefined(link.url),
      referral: link.referral,
    });
    if (!generated) {
      if (!catalogResolution) {
        return link;
      }

      return {
        ...link,
        referral: mergeReferralWithManualOverrides(
          link.referral,
          undefined,
          catalogResolution.referral,
        ),
      };
    }

    const mergedMetadata = generated.metadata
      ? mergeMetadataWithManualSocialProfileOverrides(link.metadata, generated.metadata)
      : link.metadata;
    const manualTitle = trimToUndefined(link.metadata?.title);
    const metadata =
      manualTitle && mergedMetadata ? { ...mergedMetadata, title: manualTitle } : mergedMetadata;
    const referral = mergeReferralWithManualOverrides(
      link.referral,
      generated.referral,
      catalogResolution?.referral,
    );

    return {
      ...link,
      metadata,
      referral,
    };
  });

const rankByExplicitOrder = (links: OpenLink[], explicitOrder: string[] = []): OpenLink[] => {
  const orderIndex = new Map(explicitOrder.map((id, index) => [id, index]));
  return [...links].sort((left, right) => {
    const explicitLeft = orderIndex.get(left.id);
    const explicitRight = orderIndex.get(right.id);

    if (explicitLeft !== undefined || explicitRight !== undefined) {
      if (explicitLeft === undefined) return 1;
      if (explicitRight === undefined) return -1;
      return explicitLeft - explicitRight;
    }

    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
};

export const loadContent = () => {
  const profileSource = profileData as ProfileData;
  const profile: ProfileData = {
    ...profileSource,
    avatar: resolveProfileAvatarPath(),
    entityType: resolveEntityType(profileSource.entityType),
  };
  const site = siteData as SiteData;
  const linksPayload = linksData as LinksData;
  const generatedMetadata = resolveGeneratedMetadata();
  const generatedContentImages = resolveGeneratedContentImages();
  const referralCatalog = loadReferralCatalog();

  const mergedLinks = mergeGeneratedMetadata(
    linksPayload.links,
    generatedMetadata,
    referralCatalog,
  );
  const localizedLinks = localizeRichMetadataImages(mergedLinks, generatedContentImages);
  const paymentReadyLinks = applyPaymentDefaults(localizedLinks);
  const enabledLinks = paymentReadyLinks.filter((link) => link.enabled !== false);
  const links = rankByExplicitOrder(enabledLinks, linksPayload.order);

  const groups = ensureSupportGroup([...(linksPayload.groups ?? [])], links).sort(
    (left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    profile,
    site,
    links,
    groups,
    linksPayload,
  };
};
