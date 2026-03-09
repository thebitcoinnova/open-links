const X_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "login_redirect", pattern: /\/i\/flow\/login\b/i, field: "currentUrl" },
  { label: "account_missing", pattern: /this account doesn['’]?t exist/i, field: "combined" },
  { label: "account_suspended", pattern: /account suspended/i, field: "combined" },
  { label: "transient_error", pattern: /something went wrong|try reloading/i, field: "combined" },
  { label: "rate_limited", pattern: /rate limit exceeded/i, field: "combined" },
] as const;
import {
  type PublicAudienceBrowserSnapshot,
  type PublicAudienceMetrics,
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

export type XPublicProfileBrowserSnapshot = PublicAudienceBrowserSnapshot;
export type XPublicProfileMetrics = PublicAudienceMetrics;

export const detectXPublicBrowserPlaceholderSignals = (
  snapshot: XPublicProfileBrowserSnapshot,
): string[] => detectPublicAudiencePlaceholderSignals(snapshot, X_BROWSER_PLACEHOLDER_CHECKS);

export const parseXPublicProfileMetrics = (
  snapshot: XPublicProfileBrowserSnapshot,
): XPublicProfileMetrics => ({
  ...parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: X_BROWSER_PLACEHOLDER_CHECKS,
  }),
  profileDescription:
    typeof snapshot.profileDescription === "string" && snapshot.profileDescription.trim().length > 0
      ? snapshot.profileDescription.trim()
      : undefined,
});
