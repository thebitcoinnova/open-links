import {
  listAuthenticatedEnrichmentStrategies,
  resolveAuthenticatedEnrichmentStrategy,
} from "./authenticated-strategies";
import { parseMetadata } from "./parse-metadata";
import {
  listPublicAugmentationStrategies,
  resolvePublicAugmentedStrategy,
} from "./public-augmentation";
import { resolveReferralTarget } from "./referral-targets";
import type {
  EnrichmentStrategy,
  ResolveEnrichmentStrategyInput,
  ResolvedEnrichmentStrategy,
  ResolvedPublicEnrichmentStrategy,
} from "./strategy-types";

const resolveDefaultPublicDirectStrategy = (
  input: ResolveEnrichmentStrategyInput,
): ResolvedPublicEnrichmentStrategy => {
  const referralTarget = resolveReferralTarget({
    url: input.url,
  });
  const sourceUrl = referralTarget?.sourceUrl ?? input.url;

  return {
    id: "public-direct-html",
    branch: "public_direct",
    sourceKind: "html",
    source: {
      sourceUrl,
      originalUrl: referralTarget ? input.url : undefined,
    },
    normalize: (body) => parseMetadata(body, sourceUrl),
  };
};

const DEFAULT_PUBLIC_DIRECT_STRATEGY: EnrichmentStrategy<ResolvedPublicEnrichmentStrategy> = {
  id: "public-direct-html",
  branch: "public_direct",
  sourceKind: "html",
  matches: (input) => !input.authenticatedExtractorId,
  resolve: (input) => resolveDefaultPublicDirectStrategy(input),
};

export const listEnrichmentStrategies = (): EnrichmentStrategy<ResolvedEnrichmentStrategy>[] => [
  DEFAULT_PUBLIC_DIRECT_STRATEGY as EnrichmentStrategy<ResolvedEnrichmentStrategy>,
  ...listPublicAugmentationStrategies(),
  ...listAuthenticatedEnrichmentStrategies(),
];

export const resolvePublicEnrichmentStrategy = (
  input: ResolveEnrichmentStrategyInput,
): ResolvedPublicEnrichmentStrategy =>
  resolvePublicAugmentedStrategy(input) ?? resolveDefaultPublicDirectStrategy(input);

export const resolveEnrichmentStrategy = (
  input: ResolveEnrichmentStrategyInput,
): ResolvedEnrichmentStrategy =>
  resolveAuthenticatedEnrichmentStrategy(input) ?? resolvePublicEnrichmentStrategy(input);

export const isResolvedPublicEnrichmentStrategy = (
  strategy: ResolvedEnrichmentStrategy,
): strategy is ResolvedPublicEnrichmentStrategy => strategy.branch !== "authenticated_required";
