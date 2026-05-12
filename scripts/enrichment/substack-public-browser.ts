import {
  type PublicAudienceBrowserSnapshot,
  type PublicAudienceMetrics,
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

const SUBSTACK_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "access_denied", pattern: /access denied|403 forbidden/i },
  { label: "bot_verification", pattern: /verify you are human|captcha|checking your browser/i },
  { label: "enable_javascript", pattern: /enable javascript|javascript is required/i },
] as const;

export type SubstackPublicProfileBrowserSnapshot = PublicAudienceBrowserSnapshot;
export type SubstackPublicProfileMetrics = PublicAudienceMetrics;

export const detectSubstackPublicBrowserPlaceholderSignals = (
  snapshot: SubstackPublicProfileBrowserSnapshot,
): string[] =>
  detectPublicAudiencePlaceholderSignals(snapshot, SUBSTACK_BROWSER_PLACEHOLDER_CHECKS);

export const parseSubstackPublicProfileMetrics = (
  snapshot: SubstackPublicProfileBrowserSnapshot,
): SubstackPublicProfileMetrics =>
  parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: SUBSTACK_BROWSER_PLACEHOLDER_CHECKS,
  });
