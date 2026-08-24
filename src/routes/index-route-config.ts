import type { LinkSectionData } from "../components/layout/LinkSection";
import { resolveAnalyticsPageHrefFromUrl } from "../lib/analytics/analytics-page-query";
import { resolveEntityPageLabel } from "../lib/content/entity-type";
import { loadContent } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import { resolveBaseAwareAssetPath } from "../lib/seo/resolve-seo-metadata";
import { resolveModePolicy } from "../lib/theme/mode-controller";
import { resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";
import { resolveFooterPreferences } from "../lib/ui/footer-preferences";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { resolveProfileQuickLinksState } from "../lib/ui/profile-quick-links";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";
import { applyPageSeoMetadata } from "./apply-page-seo";
import { resolvePaymentCardEffectGalleryMenuHref } from "./index.helpers";

export const content = loadContent();
export const composition = resolveComposition(content.site);
export const layout = resolveLayoutPreferences(content.site);
export const footerPreferences = resolveFooterPreferences(content.site);
export const modePolicy = resolveModePolicy(content.site);
export const brandIconOptions = resolveBrandIconOptions(content.site);
export const themeSelection = resolveThemeSelection(content.site);
export const typography = resolveTypographyPreferences({
  site: content.site,
  activeTheme: themeSelection.active,
  typographyScale: layout.typographyScale,
});
export const paymentCardEffectGalleryMenuHref = resolvePaymentCardEffectGalleryMenuHref(
  import.meta.env.BASE_URL,
);
export const profileQuickLinks = resolveProfileQuickLinksState(content.links);
export const profileQrSiteLogoUrl = resolveBaseAwareAssetPath(
  "branding/openlinks-logo/openlinks-logo.svg",
  import.meta.env.BASE_URL,
);
export const homePageHref = resolveAnalyticsPageHrefFromUrl(
  new URL(import.meta.env.BASE_URL || "/", "https://openlinks.local"),
  false,
);
export const sections = resolveLinkSections(
  content.links,
  content.groups,
  composition.grouping,
) as LinkSectionData[];
export const showGroupHeading = composition.grouping !== "none";

export const applySeoMetadata = () => {
  applyPageSeoMetadata({
    canonicalOrigin: __OPENLINKS_CANONICAL_ORIGIN__,
    profile: content.profile,
    site: content.site,
  });
};

export const targetForLink = (url?: string): "_blank" | "_self" => {
  const targetMode = content.site.ui?.linkTarget ?? "new-tab-external";
  if (targetMode === "same-tab") return "_self";
  if (targetMode === "new-tab-all") return "_blank";
  if (!url) return "_self";
  return url.startsWith("http://") || url.startsWith("https://") ? "_blank" : "_self";
};

export const pageAriaLabel = () =>
  `OpenLinks ${resolveEntityPageLabel(content.profile.entityType).toLowerCase()} and links`;
