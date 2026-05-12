import {
  type PublicAudienceBrowserSnapshot,
  type PublicAudienceMetrics,
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

const INSTAGRAM_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "login_redirect", pattern: /\/accounts\/login\b/i, field: "currentUrl" },
  {
    label: "not_found",
    pattern: /sorry, this page isn't available|user not found/i,
    field: "combined",
  },
  {
    label: "challenge_page",
    pattern: /please wait a few minutes before you try again|challenge_required/i,
    field: "combined",
  },
] as const;

export type InstagramPublicProfileBrowserSnapshot = PublicAudienceBrowserSnapshot;
export type InstagramPublicProfileMetrics = PublicAudienceMetrics;

export const detectInstagramPublicBrowserPlaceholderSignals = (
  snapshot: InstagramPublicProfileBrowserSnapshot,
): string[] =>
  detectPublicAudiencePlaceholderSignals(snapshot, INSTAGRAM_BROWSER_PLACEHOLDER_CHECKS);

export const parseInstagramPublicProfileMetrics = (
  snapshot: InstagramPublicProfileBrowserSnapshot,
): InstagramPublicProfileMetrics =>
  parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: INSTAGRAM_BROWSER_PLACEHOLDER_CHECKS,
  });
