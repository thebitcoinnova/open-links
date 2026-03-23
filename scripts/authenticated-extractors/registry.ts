import {
  listAuthenticatedEnrichmentStrategyIds,
  resolveAuthenticatedEnrichmentStrategy,
} from "../enrichment/authenticated-strategies";
import type { AuthenticatedExtractorPlugin, AuthenticatedExtractorsPolicyRegistry } from "./types";

export const getAuthenticatedExtractorPlugin = (
  extractorId: string,
): AuthenticatedExtractorPlugin | null =>
  resolveAuthenticatedEnrichmentStrategy({
    url: "",
    authenticatedExtractorId: extractorId,
  })?.plugin ?? null;

export const listAuthenticatedExtractorPluginIds = (): string[] =>
  listAuthenticatedEnrichmentStrategyIds();

export const validateRegisteredExtractorsAgainstPolicy = (
  policy: AuthenticatedExtractorsPolicyRegistry,
): { missingHandlers: string[]; disabledInPolicyWithHandler: string[] } => {
  const registeredIds = new Set(listAuthenticatedExtractorPluginIds());
  const policyIds = new Set(policy.extractors.map((extractor) => extractor.id));
  const missingHandlers: string[] = [];
  const disabledInPolicyWithHandler: string[] = [];

  for (const extractor of policy.extractors) {
    if (!registeredIds.has(extractor.id)) {
      missingHandlers.push(extractor.id);
    }

    if (extractor.status === "disabled" && registeredIds.has(extractor.id)) {
      disabledInPolicyWithHandler.push(extractor.id);
    }
  }

  for (const extractorId of registeredIds) {
    if (!policyIds.has(extractorId)) {
      missingHandlers.push(extractorId);
    }
  }

  return {
    missingHandlers: [...new Set(missingHandlers)].sort(),
    disabledInPolicyWithHandler: [...new Set(disabledInPolicyWithHandler)].sort(),
  };
};
