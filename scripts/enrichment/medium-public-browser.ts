const MEDIUM_BROWSER_PLACEHOLDER_CHECKS = [
  { label: "cloudflare_challenge", pattern: /just a moment/i },
  { label: "security_verification", pattern: /performing security verification/i },
  {
    label: "bot_verification",
    pattern: /verifies? you are not a bot|checking if the site connection is secure/i,
  },
  { label: "cloudflare_branding", pattern: /performance and security by cloudflare/i },
  { label: "enable_javascript", pattern: /enable javascript and cookies to continue/i },
  { label: "access_denied", pattern: /access denied/i },
] as const;
import {
  type PublicAudienceBrowserSnapshot,
  type PublicAudienceMetrics,
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

export type MediumPublicProfileBrowserSnapshot = PublicAudienceBrowserSnapshot;
export type MediumPublicProfileMetrics = PublicAudienceMetrics;

export const detectMediumPublicBrowserPlaceholderSignals = (
  snapshot: MediumPublicProfileBrowserSnapshot,
): string[] => detectPublicAudiencePlaceholderSignals(snapshot, MEDIUM_BROWSER_PLACEHOLDER_CHECKS);

export const parseMediumPublicProfileMetrics = (
  snapshot: MediumPublicProfileBrowserSnapshot,
): MediumPublicProfileMetrics =>
  parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: MEDIUM_BROWSER_PLACEHOLDER_CHECKS,
  });
