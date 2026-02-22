import type {
  OpenLink,
  RichImageTreatment,
  SiteData,
  SourceLabelDefault
} from "../content/load-content";

export type ResolvedCardVariant = "simple" | "rich";

export interface RichCardViewModel {
  title: string;
  description: string;
  imageUrl?: string;
  imageTreatment: RichImageTreatment;
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

const urlDomain = (url: string): string => {
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
  const sourceDefault = resolveSourceDefault(site);

  return {
    title: metadata.title ?? link.label,
    description: metadata.description ?? link.description ?? urlDomain(link.url),
    imageUrl: resolveImageTreatment(site) === "off" ? undefined : metadata.image,
    imageTreatment: resolveImageTreatment(site),
    sourceLabel: metadata.sourceLabel ?? link.enrichment?.sourceLabel ?? urlDomain(link.url),
    showSourceLabel:
      metadata.sourceLabelVisible ??
      link.enrichment?.sourceLabelVisible ??
      sourceDefault === "show"
  };
};
