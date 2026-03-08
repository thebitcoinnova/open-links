import {
  type PublicAudienceBrowserSnapshot,
  type PublicAudienceMetrics,
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

const PRIMAL_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "profile_missing", pattern: /profile not found|user not found|page not found/i },
  { label: "transient_error", pattern: /something went wrong|failed to load/i },
] as const;

export type PrimalPublicProfileBrowserSnapshot = PublicAudienceBrowserSnapshot;
export type PrimalPublicProfileMetrics = PublicAudienceMetrics;

export const detectPrimalPublicBrowserPlaceholderSignals = (
  snapshot: PrimalPublicProfileBrowserSnapshot,
): string[] => detectPublicAudiencePlaceholderSignals(snapshot, PRIMAL_BROWSER_PLACEHOLDER_CHECKS);

export const parsePrimalPublicProfileMetrics = (
  snapshot: PrimalPublicProfileBrowserSnapshot,
): PrimalPublicProfileMetrics =>
  parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: PRIMAL_BROWSER_PLACEHOLDER_CHECKS,
  });
