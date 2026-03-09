import type {
  OpenLink,
  RichCardDescriptionImageRowMode,
  RichCardDescriptionSource,
  RichCardImageFit,
  RichImageTreatment,
  SiteData,
  SourceLabelDefault,
} from "../content/load-content";
import { resolveKnownSite } from "../icons/known-sites-data";
import {
  type ResolvedSocialProfileMetadata,
  resolveSocialProfileMetadata,
} from "./social-profile-metadata";

export type ResolvedCardVariant = "simple" | "rich";

export type NonPaymentCardLeadKind = "preview" | "avatar" | "icon";
export type NonPaymentCardMetaKind = "handle" | "metric" | "source";
export type NonPaymentCardVariant = ResolvedCardVariant;

export interface NonPaymentCardMetaItem {
  kind: NonPaymentCardMetaKind;
  text: string;
}

export interface NonPaymentCardViewModel {
  title: string;
  description: string;
  socialProfile: ResolvedSocialProfileMetadata;
  leadKind: NonPaymentCardLeadKind;
  leadImageUrl?: string;
  showDescriptionImageRow: boolean;
  descriptionImageUrl?: string;
  headerMetaItems: NonPaymentCardMetaItem[];
  imageTreatment: RichImageTreatment;
  imageFit: RichCardImageFit;
  sourceLabel?: string;
  showSourceLabel: boolean;
  footerSourceLabel?: string;
  showFooterIcon: boolean;
}

export type RichCardViewModel = NonPaymentCardViewModel;

export const resolveRichRenderMode = (site: SiteData): "auto" | "simple" =>
  site.ui?.richCards?.renderMode === "simple" ? "simple" : "auto";

const resolveSourceDefault = (site: SiteData): SourceLabelDefault =>
  site.ui?.richCards?.sourceLabelDefault === "hide" ? "hide" : "show";

const resolveImageTreatment = (site: SiteData): RichImageTreatment => {
  const value = site.ui?.richCards?.imageTreatment;
  if (value === "thumbnail" || value === "off") {
    return value;
  }
  return "cover";
};

const isImageFit = (value: unknown): value is RichCardImageFit =>
  value === "cover" || value === "contain";

const resolveImageFit = (site: SiteData, link: OpenLink): RichCardImageFit => {
  const linkValue = link.metadata?.imageFit;
  if (isImageFit(linkValue)) {
    return linkValue;
  }

  const siteValue = site.ui?.richCards?.imageFit;
  if (isImageFit(siteValue)) {
    return siteValue;
  }

  // Preserve image content by default to avoid clipping wide social preview assets.
  return "contain";
};

const isDescriptionImageRowMode = (value: unknown): value is RichCardDescriptionImageRowMode =>
  value === "auto" || value === "off";

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const extractNormalizedHostFromUrl = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return undefined;
  }
};

const urlDomain = (url: string | undefined): string => {
  if (!url) {
    return "link";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const resolveMetadataText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const isDescriptionSource = (value: unknown): value is RichCardDescriptionSource =>
  value === "fetched" || value === "manual";

const normalizeHostLikeLabel = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || /\s/u.test(trimmed) || !trimmed.includes(".")) {
    return undefined;
  }

  try {
    const normalizedInput = trimmed.toLowerCase().replace(/^www\./u, "");
    const resolvedHost = new URL(`https://${trimmed}`).hostname
      .toLowerCase()
      .replace(/^www\./u, "");
    return resolvedHost === normalizedInput ? resolvedHost : undefined;
  } catch {
    return undefined;
  }
};

const isCanonicalKnownSiteDomain = (
  normalizedHostLabel: string,
  domains: readonly string[],
): boolean =>
  domains.some((domain) => {
    const normalizedDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^www\./u, "");
    return (
      normalizedHostLabel === normalizedDomain ||
      normalizedHostLabel.endsWith(`.${normalizedDomain}`)
    );
  });

export interface LinkSourcePresentation {
  sourceLabel?: string;
  showSourceLabel: boolean;
}

export const resolveLinkSourcePresentation = (
  site: SiteData,
  link: OpenLink,
): LinkSourcePresentation => {
  const metadata = link.metadata ?? {};
  const sourceDefault = resolveSourceDefault(site);

  return {
    sourceLabel: metadata.sourceLabel ?? link.enrichment?.sourceLabel ?? urlDomain(link.url),
    showSourceLabel:
      metadata.sourceLabelVisible ??
      link.enrichment?.sourceLabelVisible ??
      sourceDefault === "show",
  };
};

const resolveDescriptionImageRowMode = (
  site: SiteData,
  link: OpenLink,
  sourcePresentation: LinkSourcePresentation,
): RichCardDescriptionImageRowMode => {
  const rowConfig = site.ui?.richCards?.descriptionImageRow;
  const siteOverrides = rowConfig?.sites ?? {};
  const overrideCandidates = new Set<string>();
  const normalizedUrlHost = extractNormalizedHostFromUrl(link.url);
  const normalizedSourceLabel = normalizeHostLikeLabel(sourcePresentation.sourceLabel);
  const knownSite = resolveKnownSite(link.icon, link.url);

  if (normalizedUrlHost) {
    overrideCandidates.add(normalizedUrlHost);
  }

  if (normalizedSourceLabel) {
    overrideCandidates.add(normalizedSourceLabel);
  }

  if (knownSite?.id) {
    overrideCandidates.add(knownSite.id);
  }

  for (const key of overrideCandidates) {
    if (isDescriptionImageRowMode(siteOverrides[key])) {
      return siteOverrides[key];
    }
  }

  return rowConfig?.default === "off" ? "off" : "auto";
};

export const resolveFooterSourceLabel = (
  link: Pick<OpenLink, "icon" | "url">,
  sourceLabel: string | undefined,
): string | undefined => {
  if (!sourceLabel) {
    return undefined;
  }

  const normalizedHostLabel = normalizeHostLikeLabel(sourceLabel);
  if (!normalizedHostLabel) {
    return sourceLabel;
  }

  const knownSite = resolveKnownSite(link.icon, link.url);
  if (!knownSite || isCanonicalKnownSiteDomain(normalizedHostLabel, knownSite.domains)) {
    return sourceLabel;
  }

  return `${knownSite.label} · ${sourceLabel}`;
};

const resolveDescriptionSource = (site: SiteData, link: OpenLink): RichCardDescriptionSource => {
  if (isDescriptionSource(link.metadata?.descriptionSource)) {
    return link.metadata.descriptionSource;
  }

  if (isDescriptionSource(site.ui?.richCards?.descriptionSource)) {
    return site.ui.richCards.descriptionSource;
  }

  return "fetched";
};

export const resolveLinkCardDescription = (
  site: SiteData,
  link: OpenLink,
  socialProfile = resolveSocialProfileMetadata(link),
): string => {
  if (socialProfile.platform && socialProfile.profileDescription) {
    return socialProfile.profileDescription;
  }

  const metadataDescription = resolveMetadataText(link.metadata?.description);
  const manualDescription = resolveMetadataText(link.description);
  const fallbackDescription = urlDomain(link.url);
  const descriptionSource = resolveDescriptionSource(site, link);

  if (descriptionSource === "manual") {
    return manualDescription ?? metadataDescription ?? fallbackDescription;
  }

  return metadataDescription ?? manualDescription ?? fallbackDescription;
};

export const resolveRichCardVariant = (site: SiteData, link: OpenLink): ResolvedCardVariant => {
  if (link.type !== "rich") {
    return "simple";
  }

  if (resolveRichRenderMode(site) === "simple") {
    return "simple";
  }

  return "rich";
};

const resolveLeadVisual = (
  variant: NonPaymentCardVariant,
  socialProfile: ResolvedSocialProfileMetadata,
  imageTreatment: RichImageTreatment,
): Pick<NonPaymentCardViewModel, "leadKind" | "leadImageUrl"> => {
  if (socialProfile.usesProfileLayout) {
    return {
      leadKind: "avatar",
      leadImageUrl: socialProfile.profileImageUrl,
    };
  }

  if (
    variant === "rich" &&
    imageTreatment !== "off" &&
    socialProfile.hasDistinctPreviewImage &&
    socialProfile.previewImageUrl
  ) {
    return {
      leadKind: "preview",
      leadImageUrl: socialProfile.previewImageUrl,
    };
  }

  return {
    leadKind: "icon",
    leadImageUrl: undefined,
  };
};

const buildHeaderMetaItems = (
  variant: NonPaymentCardVariant,
  socialProfile: ResolvedSocialProfileMetadata,
  sourcePresentation: LinkSourcePresentation,
): NonPaymentCardMetaItem[] => {
  const items: NonPaymentCardMetaItem[] = [];

  if (socialProfile.handleDisplay) {
    items.push({
      kind: "handle",
      text: socialProfile.handleDisplay,
    });
  }

  for (const metric of socialProfile.metrics) {
    items.push({
      kind: "metric",
      text: metric.displayText,
    });
  }

  if (
    items.length === 0 &&
    variant === "rich" &&
    sourcePresentation.showSourceLabel &&
    sourcePresentation.sourceLabel
  ) {
    items.push({
      kind: "source",
      text: sourcePresentation.sourceLabel,
    });
  }

  return items;
};

export const buildNonPaymentCardViewModel = (
  site: SiteData,
  link: OpenLink,
  variant: NonPaymentCardVariant,
): NonPaymentCardViewModel => {
  const metadata = link.metadata ?? {};
  const socialProfile = resolveSocialProfileMetadata(link);
  const configuredImageTreatment = resolveImageTreatment(site);
  const sourcePresentation = resolveLinkSourcePresentation(site, link);
  const enrichmentDisabled =
    link.enrichment?.enabled === false || metadata.enrichmentReason === "enrichment_disabled";
  const imageTreatment: RichImageTreatment =
    configuredImageTreatment === "off" ||
    (enrichmentDisabled && !socialProfile.hasDistinctPreviewImage)
      ? "off"
      : configuredImageTreatment;
  const imageFit = resolveImageFit(site, link);
  const leadVisual = resolveLeadVisual(variant, socialProfile, imageTreatment);
  const descriptionImageRowMode = resolveDescriptionImageRowMode(site, link, sourcePresentation);
  const showDescriptionImageRow =
    variant === "rich" &&
    socialProfile.usesProfileLayout &&
    imageTreatment !== "off" &&
    descriptionImageRowMode !== "off" &&
    socialProfile.hasDistinctPreviewImage &&
    Boolean(socialProfile.previewImageUrl);
  const headerMetaItems = buildHeaderMetaItems(variant, socialProfile, sourcePresentation);
  const footerSourceLabel =
    sourcePresentation.showSourceLabel && sourcePresentation.sourceLabel
      ? resolveFooterSourceLabel(link, sourcePresentation.sourceLabel)
      : undefined;
  const title =
    variant === "simple" && !socialProfile.usesProfileLayout
      ? link.label
      : (socialProfile.displayName ?? metadata.title ?? link.label);

  return {
    title,
    description: resolveLinkCardDescription(site, link, socialProfile),
    socialProfile,
    leadKind: leadVisual.leadKind,
    leadImageUrl: leadVisual.leadImageUrl,
    showDescriptionImageRow,
    descriptionImageUrl: showDescriptionImageRow ? socialProfile.previewImageUrl : undefined,
    headerMetaItems,
    imageTreatment,
    imageFit,
    sourceLabel: sourcePresentation.sourceLabel,
    showSourceLabel: sourcePresentation.showSourceLabel,
    footerSourceLabel,
    showFooterIcon: leadVisual.leadKind !== "icon",
  };
};

export const buildRichCardViewModel = (site: SiteData, link: OpenLink): RichCardViewModel =>
  buildNonPaymentCardViewModel(site, link, "rich");

export const buildSimpleCardViewModel = (site: SiteData, link: OpenLink): NonPaymentCardViewModel =>
  buildNonPaymentCardViewModel(site, link, "simple");
