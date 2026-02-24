import type { SiteData } from "../content/load-content";

export interface ResolvedFooterPreferences {
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  showLastUpdated: boolean;
}

const DEFAULT_DESCRIPTION =
  "OpenLinks is a personal, free, open source, version-controlled links site. Fork it, customize JSON, and publish fast.";
const DEFAULT_CTA_LABEL = "Create Your OpenLinks";
const DEFAULT_CTA_URL = "https://github.com/pRizz/open-links";

const toOptionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveFooterPreferences = (site: SiteData): ResolvedFooterPreferences => {
  const footer = site.ui?.footer;

  return {
    description: toOptionalTrimmed(footer?.description) ?? DEFAULT_DESCRIPTION,
    ctaLabel: toOptionalTrimmed(footer?.ctaLabel) ?? DEFAULT_CTA_LABEL,
    ctaUrl: toOptionalTrimmed(footer?.ctaUrl) ?? DEFAULT_CTA_URL,
    showLastUpdated: typeof footer?.showLastUpdated === "boolean" ? footer.showLastUpdated : true
  };
};

