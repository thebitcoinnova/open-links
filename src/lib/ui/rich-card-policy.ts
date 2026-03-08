import type {
  OpenLink,
  RichCardDescriptionSource,
  RichCardImageFit,
  RichImageTreatment,
  SiteData,
  SourceLabelDefault,
} from "../content/load-content";
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

const resolveDescriptionSource = (site: SiteData, link: OpenLink): RichCardDescriptionSource => {
  if (isDescriptionSource(link.metadata?.descriptionSource)) {
    return link.metadata.descriptionSource;
  }

  if (isDescriptionSource(site.ui?.richCards?.descriptionSource)) {
    return site.ui.richCards.descriptionSource;
  }

  return "fetched";
};

export const resolveLinkCardDescription = (site: SiteData, link: OpenLink): string => {
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

  if (socialProfile.usesProfileLayout) {
    return {
      leadKind: "avatar",
      leadImageUrl: socialProfile.profileImageUrl,
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
  const headerMetaItems = buildHeaderMetaItems(variant, socialProfile, sourcePresentation);
  const footerSourceLabel =
    sourcePresentation.showSourceLabel && sourcePresentation.sourceLabel
      ? sourcePresentation.sourceLabel
      : undefined;
  const title =
    variant === "simple" && !socialProfile.usesProfileLayout
      ? link.label
      : (socialProfile.displayName ?? metadata.title ?? link.label);

  return {
    title,
    description: resolveLinkCardDescription(site, link),
    socialProfile,
    leadKind: leadVisual.leadKind,
    leadImageUrl: leadVisual.leadImageUrl,
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
