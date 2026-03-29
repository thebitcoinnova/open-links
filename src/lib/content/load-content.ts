import linksData from "../../../data/links.json";
import profileData from "../../../data/profile.json";
import siteData from "../../../data/site.json";
import { resolvePrimaryPaymentHref } from "../payments/rails";
import {
  type LinkPaymentConfig,
  type SitePaymentsConfig,
  isPaymentCapableLink,
} from "../payments/types";
import {
  CONTENT_IMAGE_FIELDS,
  getLinkContentImageSlotId,
  resolveContentImageResolvedPathForSlot,
} from "./content-image-slots";
import { type EntityType, resolveEntityType } from "./entity-type";
import type { LinkReferralConfig, ReferralKind } from "./referral-fields";
import {
  type LinkProfileSemantics,
  type SocialProfileMetadataFields,
  mergeMetadataWithManualSocialProfileOverrides,
} from "./social-profile-fields";

export type {
  PaymentCardEffect,
  PaymentCardEffectsConfig,
  PaymentCardGlitterPalette,
  LinkPaymentConfig,
  PaymentAppLink,
  PaymentQrConfig,
  PaymentQrDisplayMode,
  PaymentQrFullscreenMode,
  PaymentQrLogoMode,
  PaymentQrStyle,
  PaymentRail,
  PaymentRailType,
  SitePaymentEffectsDefaults,
  SitePaymentQrDefaults,
  SitePaymentsConfig,
} from "../payments/types";

export type LinkType = "simple" | "rich" | "payment";
export type CompositionMode = "balanced" | "identity-first" | "links-first" | "links-only";
export type GroupingStyle = "subtle" | "none" | "bands";
export type ProfileRichness = "minimal" | "standard" | "rich";
export type DensityMode = "compact" | "medium" | "spacious";
export type ModePolicy = "dark-toggle" | "static-dark" | "static-light";
export type LinkTargetMode = "new-tab-external" | "same-tab" | "new-tab-all";
export type DesktopColumnsMode = "one" | "two";
export type TypographyScaleMode = "fixed" | "compact" | "expressive";
export type TypographyTransformMode = "none" | "uppercase" | "lowercase" | "capitalize";
export type BrandIconColorMode = "brand" | "theme";
export type BrandIconContrastMode = "auto" | "always-theme" | "always-brand";
export type BrandIconSizeMode = "normal" | "large";
export type TargetSizeMode = "comfortable" | "compact" | "large";
export type RichCardRenderMode = "auto" | "simple";
export type SourceLabelDefault = "show" | "hide";
export type RichImageTreatment = "cover" | "thumbnail" | "off";
export type RichCardImageFit = "cover" | "contain";
export type RichCardMobileImageLayout = "inline" | "full-width";
export type RichCardDescriptionSource = "fetched" | "manual";
export type RichCardDescriptionImageRowMode = "auto" | "off";
export type RichCardDescriptionImagePlacement = "top-banner" | "bottom-row";
export type RichCardDescriptionImageNonBannerFallback = "off" | "compact-end";
export type QualityDomain = "seo" | "accessibility" | "performance" | "manual-smoke";

export interface RichCardDescriptionImagePlacementConfig {
  default?: RichCardDescriptionImagePlacement;
  sites?: Record<string, RichCardDescriptionImagePlacement>;
}

export interface RichCardDescriptionImageNonBannerFallbackConfig {
  default?: RichCardDescriptionImageNonBannerFallback;
  sites?: Record<string, RichCardDescriptionImageNonBannerFallback>;
}

export interface RichCardDescriptionImageRowConfig {
  default?: RichCardDescriptionImageRowMode;
  sites?: Record<string, RichCardDescriptionImageRowMode>;
  placement?: RichCardDescriptionImagePlacementConfig;
  bannerMinAspectRatio?: number;
  nonBannerFallback?: RichCardDescriptionImageNonBannerFallbackConfig;
}

export interface QualitySeoMetadata {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

export interface BudgetThreshold {
  warn: number;
  fail: number;
}

export interface PerformanceProfileBudget {
  totalBytes?: BudgetThreshold | number;
  jsBytes?: BudgetThreshold | number;
  cssBytes?: BudgetThreshold | number;
  htmlBytes?: BudgetThreshold | number;
  largestAssetBytes?: BudgetThreshold | number;
  minimumScore?: BudgetThreshold | number;
}

export interface SiteQualityConfig {
  reportPath?: string;
  summaryPath?: string;
  blockingDomains?: QualityDomain[];
  seo?: {
    canonicalBaseUrl?: string;
    socialImageFallback?: string;
    defaults?: QualitySeoMetadata;
    overrides?: {
      profile?: QualitySeoMetadata;
    };
  };
  accessibility?: {
    focusContrastStrict?: boolean;
    manualSmokeChecks?: string[];
  };
  performance?: {
    routes?: string[];
    profiles?: {
      mobile?: PerformanceProfileBudget;
      desktop?: PerformanceProfileBudget;
    };
  };
}

export interface RichLinkMetadata extends SocialProfileMetadataFields {
  title?: string;
  description?: string;
  descriptionSource?: RichCardDescriptionSource;
  image?: string;
  ogImage?: string;
  twitterImage?: string;
  imageFit?: RichCardImageFit;
  mobileImageLayout?: RichCardMobileImageLayout;
  handle?: string;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  enrichmentStatus?: "fetched" | "partial" | "failed" | "skipped";
  enrichmentReason?:
    | "metadata_complete"
    | "metadata_partial"
    | "metadata_missing"
    | "fetch_failed"
    | "public_cache"
    | "authenticated_cache"
    | "authenticated_cache_missing"
    | "known_blocker"
    | "enrichment_disabled";
  enrichedAt?: string;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LinkEnrichmentPolicy {
  enabled?: boolean;
  profileSemantics?: LinkProfileSemantics;
  allowKnownBlocker?: boolean;
  authenticatedExtractor?: string;
  authenticatedCacheKey?: string;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export type { LinkReferralConfig, ReferralKind } from "./referral-fields";

export interface LinkQuickLinksCustomConfig {
  canonical?: boolean;
}

export interface LinkCustomConfig {
  quickLinks?: LinkQuickLinksCustomConfig;
  [key: string]: unknown;
}

export interface OpenLink {
  id: string;
  label: string;
  url?: string;
  type: LinkType;
  icon?: string;
  description?: string;
  group?: string;
  order?: number;
  enabled?: boolean;
  metadata?: RichLinkMetadata;
  enrichment?: LinkEnrichmentPolicy;
  referral?: LinkReferralConfig;
  payment?: LinkPaymentConfig;
  custom?: LinkCustomConfig;
}

export interface LinkGroup {
  id: string;
  label: string;
  order?: number;
}

export interface ProfileData {
  name: string;
  headline: string;
  avatar: string;
  bio: string;
  entityType?: EntityType;
  location?: string;
  pronouns?: string;
  status?: string;
  profileLinks?: Array<{ label: string; url: string }>;
  contact?: Record<string, string>;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

type TypographyTokenValue = string | number;

export interface TypographyOverrides {
  fontDisplay?: string;
  fontBody?: string;
  sizeTitle?: TypographyTokenValue;
  sizeHeadline?: TypographyTokenValue;
  sizeBody?: TypographyTokenValue;
  sizeCaption?: TypographyTokenValue;
  sizeCardTitle?: TypographyTokenValue;
  sizeLinkTitle?: TypographyTokenValue;
  sizeIcon?: TypographyTokenValue;
  lineHeightTitle?: TypographyTokenValue;
  lineHeightBody?: TypographyTokenValue;
  lineHeightCardTitle?: TypographyTokenValue;
  lineHeightCardDescription?: TypographyTokenValue;
  weightCardTitle?: TypographyTokenValue;
  weightLinkTitle?: TypographyTokenValue;
  weightIcon?: TypographyTokenValue;
  trackingUtilityTitle?: TypographyTokenValue;
  trackingSectionHeading?: TypographyTokenValue;
  trackingCardSource?: TypographyTokenValue;
  trackingIcon?: TypographyTokenValue;
  transformUtilityTitle?: TypographyTransformMode;
  transformSectionHeading?: TypographyTransformMode;
  transformContactLabel?: TypographyTransformMode;
}

export interface TypographyConfig {
  global?: TypographyOverrides;
  themes?: Record<string, TypographyOverrides>;
}

export interface SiteFooterPromptConfig {
  enabled?: boolean;
  title?: string;
  explanation?: string;
  text?: string;
}

export interface SiteFooterConfig {
  description?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  showBuildInfo?: boolean;
  showLastUpdated?: boolean;
  prompt?: SiteFooterPromptConfig;
}

export interface SiteBadgeConfig {
  enabled?: boolean;
  message?: string;
}

export interface SiteSharingConfig {
  badge?: SiteBadgeConfig;
}

export interface SiteData {
  title: string;
  description: string;
  baseUrl?: string;
  quality?: SiteQualityConfig;
  sharing?: SiteSharingConfig;
  theme: {
    active: string;
    available: string[];
  };
  ui?: {
    compositionMode?: CompositionMode;
    groupingStyle?: GroupingStyle;
    profileRichness?: ProfileRichness;
    density?: DensityMode;
    modePolicy?: ModePolicy;
    linkTarget?: LinkTargetMode;
    desktopColumns?: DesktopColumnsMode;
    typographyScale?: TypographyScaleMode;
    typography?: TypographyConfig;
    targetSize?: TargetSizeMode;
    profileAvatarScale?: number;
    brandIcons?: {
      colorMode?: BrandIconColorMode;
      contrastMode?: BrandIconContrastMode;
      minContrastRatio?: number;
      sizeMode?: BrandIconSizeMode;
      iconOverrides?: Record<string, string>;
    };
    richCards?: {
      renderMode?: RichCardRenderMode;
      sourceLabelDefault?: SourceLabelDefault;
      descriptionSource?: RichCardDescriptionSource;
      imageTreatment?: RichImageTreatment;
      imageFit?: RichCardImageFit;
      descriptionImageRow?: RichCardDescriptionImageRowConfig;
      mobile?: {
        imageLayout?: RichCardMobileImageLayout;
      };
      enrichment?: {
        enabledByDefault?: boolean;
        timeoutMs?: number;
        retries?: number;
        metadataPath?: string;
        reportPath?: string;
        publicCachePath?: string;
        authenticatedCachePath?: string;
        authenticatedCacheWarnAgeDays?: number;
        failureMode?: "immediate" | "aggregate";
        failOn?: Array<"fetch_failed" | "metadata_missing">;
        allowManualMetadataFallback?: boolean;
      };
    };
    analytics?: {
      pageEnabled?: boolean;
    };
    payments?: SitePaymentsConfig;
    footer?: SiteFooterConfig;
  };
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LinksData {
  links: OpenLink[];
  groups?: LinkGroup[];
  order?: string[];
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

interface GeneratedRichMetadataPayload {
  generatedAt?: string;
  links?: Record<string, { metadata?: RichLinkMetadata }>;
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

const generatedMetadataModules = import.meta.glob<{ default: GeneratedRichMetadataPayload }>(
  "../../../data/generated/rich-metadata.json",
  { eager: true },
);

const generatedProfileAvatarModules = import.meta.glob<{ default: GeneratedProfileAvatarPayload }>(
  "../../../data/cache/profile-avatar.json",
  { eager: true },
);

const cachedContentImageModules = import.meta.glob<{ default: GeneratedContentImagesPayload }>(
  "../../../data/cache/content-images.json",
  { eager: true },
);

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

const resolveGeneratedMetadata = (): Record<string, RichLinkMetadata> => {
  const module = Object.values(generatedMetadataModules)[0];
  const payload = module?.default;

  if (!payload?.links || !isRecord(payload.links)) {
    return {};
  }

  const mapped: Record<string, RichLinkMetadata> = {};

  for (const [linkId, value] of Object.entries(payload.links)) {
    if (!isRecord(value) || !isRecord(value.metadata)) {
      continue;
    }
    mapped[linkId] = value.metadata as RichLinkMetadata;
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

const mergeGeneratedMetadata = (
  links: OpenLink[],
  generatedByLink: Record<string, RichLinkMetadata>,
): OpenLink[] =>
  links.map((link) => {
    const generated = generatedByLink[link.id];
    if (!generated) {
      return link;
    }

    const metadata = mergeMetadataWithManualSocialProfileOverrides(link.metadata, generated);

    return {
      ...link,
      metadata,
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

  const mergedLinks = mergeGeneratedMetadata(linksPayload.links, generatedMetadata);
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
