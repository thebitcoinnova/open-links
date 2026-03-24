import type { SiteData } from "../content/load-content";

export const resolveAnalyticsPageEnabled = (site: SiteData): boolean =>
  site.ui?.analytics?.pageEnabled !== false;

export const resolveAnalyticsPageOpenState = (
  requestedOpen: boolean,
  analyticsPageEnabled: boolean,
): boolean => analyticsPageEnabled && requestedOpen;

export const resolvePublicPageTabsVisible = (input: {
  analyticsAvailable: boolean;
  analyticsPageEnabled: boolean;
  analyticsPageOpen: boolean;
}): boolean => input.analyticsPageEnabled && (input.analyticsAvailable || input.analyticsPageOpen);
