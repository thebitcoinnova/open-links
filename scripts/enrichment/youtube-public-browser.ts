import {
  type PublicAudienceBrowserSnapshot,
  type PublicAudienceMetrics,
  detectPublicAudiencePlaceholderSignals,
  parsePublicAudienceMetrics,
} from "./public-audience-browser";

const YOUTUBE_BROWSER_PLACEHOLDER_CHECKS = [
  {
    label: "consent_interstitial",
    pattern: /before you continue to youtube|consent\.youtube\.com/i,
  },
  {
    label: "login_or_bot_check",
    pattern: /sign in to continue to youtube|sign in to confirm you're not a bot/i,
  },
] as const;

export type YoutubePublicProfileBrowserSnapshot = PublicAudienceBrowserSnapshot;
export type YoutubePublicProfileMetrics = PublicAudienceMetrics;

export const detectYoutubePublicBrowserPlaceholderSignals = (
  snapshot: YoutubePublicProfileBrowserSnapshot,
): string[] => detectPublicAudiencePlaceholderSignals(snapshot, YOUTUBE_BROWSER_PLACEHOLDER_CHECKS);

export const parseYoutubePublicProfileMetrics = (
  snapshot: YoutubePublicProfileBrowserSnapshot,
): YoutubePublicProfileMetrics =>
  parsePublicAudienceMetrics({
    snapshot,
    placeholderChecks: YOUTUBE_BROWSER_PLACEHOLDER_CHECKS,
  });
