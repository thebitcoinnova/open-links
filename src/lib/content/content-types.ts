import type { LinkPaymentConfig, SitePaymentsConfig } from "../payments/types";
import type { EntityType } from "./entity-type";
import type {
  GeneratedLinkReferralConfig,
  LinkReferralConfig,
  ReferralKind,
  ResolvedLinkReferralConfig,
} from "./referral-fields";
import type { LinkProfileSemantics, SocialProfileMetadataFields } from "./social-profile-fields";

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
export type ProfileHeaderAlignment = "leading" | "center";
export type TypographyTransformMode = "none" | "uppercase" | "lowercase" | "capitalize";
export type CardStyleMode = "standard" | "glassy";
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
    | "metadata_regression"
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
  facebookPageMetrics?: {
    enabled?: boolean;
    pageId?: string;
    apiVersion?: string;
  };
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export type {
  GeneratedLinkReferralConfig,
  LinkReferralConfig,
  ReferralKind,
  ResolvedLinkReferralConfig,
} from "./referral-fields";

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
  referral?: ResolvedLinkReferralConfig;
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

export interface ProfileHeaderAlignmentConfig {
  default?: ProfileHeaderAlignment;
  small?: ProfileHeaderAlignment;
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

export interface SiteSharingVCardFieldsConfig {
  email?: string;
  phone?: string;
  organization?: string;
  title?: string;
  role?: string;
  note?: string;
}

export interface SiteSharingVCardCustomUrl {
  label?: string;
  url: string;
}

export interface SiteSharingVCardIncludeConfig {
  photo?: boolean;
  profileUrl?: boolean;
  linkIds?: string[];
  customUrls?: SiteSharingVCardCustomUrl[];
}

export interface SiteSharingVCardConfig {
  enabled?: boolean;
  filename?: string;
  fields?: SiteSharingVCardFieldsConfig;
  include?: SiteSharingVCardIncludeConfig;
  custom?: Record<string, unknown>;
}

export interface SiteSharingConfig {
  badge?: SiteBadgeConfig;
  vcard?: SiteSharingVCardConfig;
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
    cardStyle?: CardStyleMode;
    profileAvatarScale?: number;
    profileHeaderAlignment?: ProfileHeaderAlignment | ProfileHeaderAlignmentConfig;
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
