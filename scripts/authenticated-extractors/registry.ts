import { facebookAuthBrowserExtractor } from "./plugins/facebook-auth-browser";
import { linkedinAuthBrowserExtractor } from "./plugins/linkedin-auth-browser";
// AUTH_EXTRACTOR_IMPORTS_START
import { mediumAuthBrowserExtractor } from "./plugins/medium-auth-browser";
import { xAuthBrowserExtractor } from "./plugins/x-auth-browser";
import { youtubeAuthBrowserExtractor } from "./plugins/youtube-auth-browser";
import type { AuthenticatedExtractorPlugin, AuthenticatedExtractorsPolicyRegistry } from "./types";
// AUTH_EXTRACTOR_IMPORTS_END

const EXTRACTORS: Record<string, AuthenticatedExtractorPlugin> = {
  [linkedinAuthBrowserExtractor.id]: linkedinAuthBrowserExtractor,
  // AUTH_EXTRACTOR_MAP_START
  [mediumAuthBrowserExtractor.id]: mediumAuthBrowserExtractor,
  [xAuthBrowserExtractor.id]: xAuthBrowserExtractor,
  [facebookAuthBrowserExtractor.id]: facebookAuthBrowserExtractor,
  [youtubeAuthBrowserExtractor.id]: youtubeAuthBrowserExtractor,
  // AUTH_EXTRACTOR_MAP_END
};

export const getAuthenticatedExtractorPlugin = (
  extractorId: string,
): AuthenticatedExtractorPlugin | null => EXTRACTORS[extractorId] ?? null;

export const listAuthenticatedExtractorPluginIds = (): string[] => Object.keys(EXTRACTORS).sort();

export const validateRegisteredExtractorsAgainstPolicy = (
  policy: AuthenticatedExtractorsPolicyRegistry,
): { missingHandlers: string[]; disabledInPolicyWithHandler: string[] } => {
  const policyIds = new Set(policy.extractors.map((extractor) => extractor.id));
  const missingHandlers: string[] = [];
  const disabledInPolicyWithHandler: string[] = [];

  for (const extractor of policy.extractors) {
    if (!EXTRACTORS[extractor.id]) {
      missingHandlers.push(extractor.id);
    }

    if (extractor.status === "disabled" && EXTRACTORS[extractor.id]) {
      disabledInPolicyWithHandler.push(extractor.id);
    }
  }

  for (const extractorId of Object.keys(EXTRACTORS)) {
    if (!policyIds.has(extractorId)) {
      missingHandlers.push(extractorId);
    }
  }

  return {
    missingHandlers: [...new Set(missingHandlers)].sort(),
    disabledInPolicyWithHandler: [...new Set(disabledInPolicyWithHandler)].sort(),
  };
};
