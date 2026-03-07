import type {
  OpenLink,
  RichCardImageFit,
  RichCardMobileImageLayout,
  RichImageTreatment,
  SiteData,
  SourceLabelDefault,
} from "../content/load-content";
import {
  type ResolvedSocialProfileMetadata,
  resolveSocialProfileMetadata,
} from "./social-profile-metadata";

export type ResolvedCardVariant = "simple" | "rich";

export interface RichCardViewModel {
  title: string;
  description: string;
  handleDisplay?: string;
  imageUrl?: string;
  socialProfile: ResolvedSocialProfileMetadata;
  imageTreatment: RichImageTreatment;
  imageFit: RichCardImageFit;
  mobileImageLayout: RichCardMobileImageLayout;
  sourceLabel?: string;
  showSourceLabel: boolean;
}

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

const isMobileImageLayout = (value: unknown): value is RichCardMobileImageLayout =>
  value === "inline" || value === "full-width";

const resolveMobileImageLayout = (site: SiteData, link: OpenLink): RichCardMobileImageLayout => {
  const linkValue = link.metadata?.mobileImageLayout;
  if (isMobileImageLayout(linkValue)) {
    return linkValue;
  }

  const siteValue = site.ui?.richCards?.mobile?.imageLayout;
  if (isMobileImageLayout(siteValue)) {
    return siteValue;
  }

  return "inline";
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

export const resolveRichCardVariant = (site: SiteData, link: OpenLink): ResolvedCardVariant => {
  if (link.type !== "rich") {
    return "simple";
  }

  if (resolveRichRenderMode(site) === "simple") {
    return "simple";
  }

  return "rich";
};

export const buildRichCardViewModel = (site: SiteData, link: OpenLink): RichCardViewModel => {
  const metadata = link.metadata ?? {};
  const socialProfile = resolveSocialProfileMetadata(link);
  const sourceDefault = resolveSourceDefault(site);
  const configuredImageTreatment = resolveImageTreatment(site);
  const imageUrl = socialProfile.previewImageUrl;
  const enrichmentDisabled =
    link.enrichment?.enabled === false || metadata.enrichmentReason === "enrichment_disabled";
  const imageTreatment: RichImageTreatment =
    configuredImageTreatment === "off" || (enrichmentDisabled && !imageUrl)
      ? "off"
      : configuredImageTreatment;
  const imageFit = resolveImageFit(site, link);

  return {
    title: metadata.title ?? link.label,
    description: metadata.description ?? link.description ?? urlDomain(link.url),
    handleDisplay: socialProfile.handleDisplay,
    imageUrl: imageTreatment === "off" ? undefined : imageUrl,
    socialProfile,
    imageTreatment,
    imageFit,
    mobileImageLayout: resolveMobileImageLayout(site, link),
    sourceLabel: metadata.sourceLabel ?? link.enrichment?.sourceLabel ?? urlDomain(link.url),
    showSourceLabel:
      metadata.sourceLabelVisible ??
      link.enrichment?.sourceLabelVisible ??
      sourceDefault === "show",
  };
};
