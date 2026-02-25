import type { AuthenticatedExtractorPlugin, AuthenticatedExtractorsPolicyRegistry } from "./types";
import { linkedinAuthBrowserExtractor } from "./plugins/linkedin-auth-browser";

const EXTRACTORS: Record<string, AuthenticatedExtractorPlugin> = {
  [linkedinAuthBrowserExtractor.id]: linkedinAuthBrowserExtractor
};

export const getAuthenticatedExtractorPlugin = (
  extractorId: string
): AuthenticatedExtractorPlugin | null => EXTRACTORS[extractorId] ?? null;

export const listAuthenticatedExtractorPluginIds = (): string[] => Object.keys(EXTRACTORS).sort();

export const validateRegisteredExtractorsAgainstPolicy = (
  policy: AuthenticatedExtractorsPolicyRegistry
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
    disabledInPolicyWithHandler: [...new Set(disabledInPolicyWithHandler)].sort()
  };
};
