import type { PublicLinkHandlerContext, PublicPreparation } from "./enrichment/public-link-context";
import {
  createParsedPublicState,
  finishParsedPublicLink,
  finishUnparsedPublicLink,
  maybeHandlePublicMetadataRegression,
  parseFetchedPublicMetadata,
} from "./enrichment/public-link-finish-steps";

export const finishFetchedPublicLink = async (
  input: PublicLinkHandlerContext,
  preparation: PublicPreparation,
) => {
  if (preparation.kind !== "fetched") return { abortedEarly: preparation.abortedEarly };
  const parseOutcome = parseFetchedPublicMetadata(preparation);
  if (parseOutcome.kind === "failed") {
    return finishUnparsedPublicLink(input, preparation, parseOutcome);
  }
  const parsedState = createParsedPublicState(input, preparation, parseOutcome.parsed);
  if (await maybeHandlePublicMetadataRegression(input, preparation, parsedState)) {
    return { abortedEarly: false };
  }
  return finishParsedPublicLink(input, preparation, parsedState);
};
