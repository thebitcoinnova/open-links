import { facebookAuthBrowserExtractor } from "../authenticated-extractors/plugins/facebook-auth-browser";
import { linkedinAuthBrowserExtractor } from "../authenticated-extractors/plugins/linkedin-auth-browser";
// AUTH_STRATEGY_IMPORTS_START
import type { AuthenticatedExtractorPlugin } from "../authenticated-extractors/types";
// AUTH_STRATEGY_IMPORTS_END
import type {
  EnrichmentStrategy,
  ResolveEnrichmentStrategyInput,
  ResolvedAuthenticatedEnrichmentStrategy,
} from "./strategy-types";

const createAuthenticatedBrowserStrategy = (
  plugin: AuthenticatedExtractorPlugin,
): EnrichmentStrategy<ResolvedAuthenticatedEnrichmentStrategy> => ({
  id: plugin.id,
  branch: "authenticated_required",
  sourceKind: "authenticated_browser",
  matches: (input) => input.authenticatedExtractorId === plugin.id,
  resolve: (input) =>
    input.authenticatedExtractorId === plugin.id
      ? {
          id: plugin.id,
          branch: "authenticated_required",
          sourceKind: "authenticated_browser",
          plugin,
        }
      : null,
});

const AUTHENTICATED_STRATEGIES: Record<
  string,
  EnrichmentStrategy<ResolvedAuthenticatedEnrichmentStrategy>
> = {
  [linkedinAuthBrowserExtractor.id]: createAuthenticatedBrowserStrategy(
    linkedinAuthBrowserExtractor,
  ),
  // AUTH_STRATEGY_MAP_START
  [facebookAuthBrowserExtractor.id]: createAuthenticatedBrowserStrategy(
    facebookAuthBrowserExtractor,
  ),
  // AUTH_STRATEGY_MAP_END
};

export const getAuthenticatedEnrichmentStrategyById = (
  strategyId: string,
): EnrichmentStrategy<ResolvedAuthenticatedEnrichmentStrategy> | null =>
  AUTHENTICATED_STRATEGIES[strategyId] ?? null;

export const listAuthenticatedEnrichmentStrategies = (): Array<
  EnrichmentStrategy<ResolvedAuthenticatedEnrichmentStrategy>
> => Object.values(AUTHENTICATED_STRATEGIES);

export const listAuthenticatedEnrichmentStrategyIds = (): string[] =>
  Object.keys(AUTHENTICATED_STRATEGIES).sort();

export const resolveAuthenticatedEnrichmentStrategy = (
  input: ResolveEnrichmentStrategyInput,
): ResolvedAuthenticatedEnrichmentStrategy | null => {
  const strategyId = input.authenticatedExtractorId?.trim();
  if (!strategyId) {
    return null;
  }

  return AUTHENTICATED_STRATEGIES[strategyId]?.resolve(input) ?? null;
};
