import type { PublicLinkHandlerContext, PublicPreparation } from "./enrichment/public-link-context";
import {
  createPublicLinkPreparationContext,
  fetchPublicLinkMetadata,
  maybeHandleFreshPublicCache,
  maybeHandleKnownPublicBlocker,
  maybeHandlePublicFetchFailure,
  maybeHandleRevalidatedPublicCache,
  toFetchedPublicPreparation,
  warnForAllowedKnownPublicBlocker,
} from "./enrichment/public-link-prepare-steps";

export const preparePublicLink = async (
  input: PublicLinkHandlerContext,
): Promise<PublicPreparation> => {
  const context = createPublicLinkPreparationContext(input);
  const blockerOutcome = maybeHandleKnownPublicBlocker(input, context);
  if (blockerOutcome) return blockerOutcome;
  warnForAllowedKnownPublicBlocker(input, context);
  const freshCacheOutcome = await maybeHandleFreshPublicCache(input, context);
  if (freshCacheOutcome) return freshCacheOutcome;
  const fetched = await fetchPublicLinkMetadata(input, context);
  const revalidatedOutcome = await maybeHandleRevalidatedPublicCache(input, context, fetched);
  if (revalidatedOutcome) return revalidatedOutcome;
  const failureOutcome = await maybeHandlePublicFetchFailure(input, context, fetched);
  if (failureOutcome) return failureOutcome;
  if (!fetched.html) {
    throw new Error("Successful public metadata fetch unexpectedly omitted HTML.");
  }
  return toFetchedPublicPreparation(context, { ...fetched, html: fetched.html });
};
