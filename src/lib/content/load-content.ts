import linksData from "../../../data/links.json";
import profileData from "../../../data/profile.json";
import siteData from "../../../data/site.json";
import { resolvePrimaryPaymentHref } from "../payments/rails";
import {
  isPaymentCapableLink,
  type LinkPaymentConfig,
  type SitePaymentsConfig
} from "../payments/types";

export type {
  LinkPaymentConfig,
  PaymentAppLink,
  PaymentQrConfig,
  PaymentQrDisplayMode,
  PaymentQrFullscreenMode,
  PaymentQrLogoMode,
  PaymentQrStyle,
  PaymentRail,
  PaymentRailType,
  SitePaymentQrDefaults,
  SitePaymentsConfig
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
export type QualityDomain = "seo" | "accessibility" | "performance" | "manual-smoke";

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

export interface RichLinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  imageFit?: RichCardImageFit;
  mobileImageLayout?: RichCardMobileImageLayout;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  enrichmentStatus?: "fetched" | "partial" | "failed" | "skipped";
  enrichmentReason?:
    | "metadata_complete"
    | "metadata_partial"
    | "metadata_missing"
    | "fetch_failed"
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
  allowKnownBlocker?: boolean;
  authenticatedExtractor?: string;
  authenticatedCacheKey?: string;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  custom?: Record<string, unknown>;
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
  payment?: LinkPaymentConfig;
  custom?: Record<string, unknown>;
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

export interface SiteFooterConfig {
  description?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  showLastUpdated?: boolean;
}

export interface SiteData {
  title: string;
  description: string;
  baseUrl?: string;
  quality?: SiteQualityConfig;
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
      imageTreatment?: RichImageTreatment;
      imageFit?: RichCardImageFit;
      mobile?: {
        imageLayout?: RichCardMobileImageLayout;
      };
      enrichment?: {
        enabledByDefault?: boolean;
        timeoutMs?: number;
        retries?: number;
        metadataPath?: string;
        reportPath?: string;
        authenticatedCachePath?: string;
        authenticatedCacheWarnAgeDays?: number;
        failureMode?: "immediate" | "aggregate";
        failOn?: Array<"fetch_failed" | "metadata_missing">;
        allowManualMetadataFallback?: boolean;
      };
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
  status?: "fetched" | "not_modified" | "cache_fresh" | "cache_on_error" | "fallback_on_error";
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
  updatedAt?: string;
  warning?: string;
}

interface GeneratedContentImageEntry {
  sourceUrl?: string;
  resolvedPath?: string;
  status?: "fetched" | "not_modified" | "cache_fresh" | "cache_on_error" | "fallback_on_error";
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
  contentType?: string;
  bytes?: number;
  warning?: string;
  updatedAt?: string;
}

interface GeneratedContentImagesPayload {
  generatedAt?: string;
  byUrl?: Record<string, GeneratedContentImageEntry>;
}

const generatedMetadataModules = import.meta.glob<{ default: GeneratedRichMetadataPayload }>(
  "../../../data/generated/rich-metadata.json",
  { eager: true }
);

const generatedProfileAvatarModules = import.meta.glob<{ default: GeneratedProfileAvatarPayload }>(
  "../../../data/generated/profile-avatar.json",
  { eager: true }
);

const generatedContentImageModules = import.meta.glob<{ default: GeneratedContentImagesPayload }>(
  "../../../data/generated/content-images.json",
  { eager: true }
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
  order: 999
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
      ...updates
    };
  });

const ensureSupportGroup = (groups: LinkGroup[], links: OpenLink[]): LinkGroup[] => {
  const hasSupportLinks = links.some((link) => trimToUndefined(link.group) === PAYMENT_SUPPORT_GROUP.id);
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
  const module = Object.values(generatedContentImageModules)[0];
  const payload = module?.default;

  if (!payload || !isRecord(payload.byUrl)) {
    return {};
  }

  const mapped: Record<string, GeneratedContentImageEntry> = {};

  for (const [url, value] of Object.entries(payload.byUrl)) {
    if (!isRecord(value)) {
      continue;
    }
    mapped[url] = value as GeneratedContentImageEntry;
  }

  return mapped;
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

const resolveImageFromGeneratedMap = (
  candidate: string,
  generatedByUrl: Record<string, GeneratedContentImageEntry>
): string | undefined => {
  const canonical = toCanonicalHttpUrl(candidate);
  if (!canonical) {
    return undefined;
  }

  const entry = generatedByUrl[canonical] ?? generatedByUrl[candidate];
  if (!entry || typeof entry.resolvedPath !== "string" || entry.resolvedPath.trim().length === 0) {
    return undefined;
  }

  return toLocalAssetUrl(entry.resolvedPath);
};

export const resolveGeneratedContentImageUrl = (candidate: string | undefined): string | undefined => {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return undefined;
  }

  const trimmed = candidate.trim();
  const generatedByUrl = resolveGeneratedContentImages();

  if (!hasUrlScheme(trimmed)) {
    return toLocalAssetUrl(trimmed);
  }

  return resolveImageFromGeneratedMap(trimmed, generatedByUrl);
};

const resolveProfileAvatarPath = (): string => {
  const fallbackPath = "profile-avatar-fallback.svg";
  const module = Object.values(generatedProfileAvatarModules)[0];
  const payload = module?.default;

  if (!payload || typeof payload.resolvedPath !== "string" || payload.resolvedPath.trim().length === 0) {
    return toLocalAssetUrl(fallbackPath);
  }

  return toLocalAssetUrl(payload.resolvedPath);
};

const localizeRichMetadataImages = (
  links: OpenLink[],
  generatedByUrl: Record<string, GeneratedContentImageEntry>
): OpenLink[] =>
  links.map((link) => {
    if (!link.metadata) {
      return link;
    }

    const imageCandidate = link.metadata.image;
    if (typeof imageCandidate !== "string" || imageCandidate.trim().length === 0) {
      return link;
    }

    const trimmed = imageCandidate.trim();
    let resolvedImage: string | undefined;

    if (!hasUrlScheme(trimmed)) {
      resolvedImage = toLocalAssetUrl(trimmed);
    } else {
      resolvedImage = resolveImageFromGeneratedMap(trimmed, generatedByUrl);
    }

    if (!resolvedImage) {
      const { image: _image, ...metadataWithoutImage } = link.metadata;
      return {
        ...link,
        metadata: metadataWithoutImage
      };
    }

    return {
      ...link,
      metadata: {
        ...link.metadata,
        image: resolvedImage
      }
    };
  });

const mergeGeneratedMetadata = (
  links: OpenLink[],
  generatedByLink: Record<string, RichLinkMetadata>
): OpenLink[] =>
  links.map((link) => {
    const generated = generatedByLink[link.id];
    if (!generated) {
      return link;
    }

    return {
      ...link,
      metadata: {
        ...(link.metadata ?? {}),
        ...generated
      }
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
    avatar: resolveProfileAvatarPath()
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
    (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
  );

  return {
    profile,
    site,
    links,
    groups,
    linksPayload
  };
};
