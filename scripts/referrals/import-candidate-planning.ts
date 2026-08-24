import {
  mergeReferralCatalogPayloads,
  resolveReferralCatalogForLink,
} from "../../src/lib/content/referral-catalog";
import type { BuildReferralImportPlanInput } from "./import-candidate";
import {
  normalizeReferralInboxCandidate,
  resolvePlanningUrl,
  slugify,
  trimToUndefined,
} from "./import-candidate";
import {
  appendCatalogAddition,
  buildCatalogAddition,
  buildCatalogBackedReferral,
  buildCatalogMatchSummary,
  buildExistingLinkByUrl,
  buildManualReferral,
  buildPlannedLink,
  cloneCatalog,
  createSkipItem,
  inferMatcherShape,
  resolveTermsPolicySkipReason,
  shouldUseNonProfileSemantics,
  summarizeCandidateFamilyLabel,
} from "./import-catalog-planning";
import type {
  NormalizedReferralInboxCandidate,
  ReferralImportPlanItem,
  ReferralInboxCandidateInput,
} from "./import-contract";
import { normalizeReferralTermsPolicyResult } from "./terms-policy";

export type CandidatePlanningState = {
  workingCatalog: ReturnType<typeof cloneCatalog>;
  familyIds: Set<string>;
  offerIds: Set<string>;
  matcherIds: Set<string>;
  existingLinksByUrl: Map<string, string>;
  usedLinkIds: Set<string>;
  usedCandidateIds: Set<string>;
  seenDedupeKeys: Map<string, string>;
};

export const createCandidatePlanningState = (
  input: BuildReferralImportPlanInput,
): CandidatePlanningState => {
  const workingCatalog = cloneCatalog(
    mergeReferralCatalogPayloads(input.sharedCatalogPayload, input.localCatalogPayload),
  );
  const existing = buildExistingLinkByUrl(input.linksPayload);
  return {
    workingCatalog,
    familyIds: new Set(workingCatalog.families.map((family) => family.familyId)),
    offerIds: new Set(workingCatalog.offers.map((offer) => offer.offerId)),
    matcherIds: new Set(workingCatalog.matchers.map((matcher) => matcher.matcherId)),
    existingLinksByUrl: existing.byUrl,
    usedLinkIds: existing.usedIds,
    usedCandidateIds: new Set<string>(),
    seenDedupeKeys: new Map<string, string>(),
  };
};

const maybePrepareCandidate = (
  rawCandidate: ReferralInboxCandidateInput,
  index: number,
  state: CandidatePlanningState,
):
  | { kind: "ready"; candidate: NormalizedReferralInboxCandidate }
  | { kind: "skip"; item: ReferralImportPlanItem } => {
  const fallbackCandidateId = slugify(rawCandidate.candidateId ?? `candidate-${index + 1}`);
  const planningUrl = resolvePlanningUrl(rawCandidate);
  if (planningUrl.skipReason) {
    return {
      kind: "skip",
      item: createSkipItem({
        candidateId: fallbackCandidateId,
        confidence: rawCandidate.confidence,
        url: trimToUndefined(rawCandidate.approvedUrl) ?? trimToUndefined(rawCandidate.url),
        reason: planningUrl.skipReason,
        termsPolicy: normalizeReferralTermsPolicyResult(rawCandidate.termsPolicy),
      }),
    };
  }
  try {
    return {
      kind: "ready",
      candidate: normalizeReferralInboxCandidate(rawCandidate, {
        index,
        usedCandidateIds: state.usedCandidateIds,
      }),
    };
  } catch (error) {
    return {
      kind: "skip",
      item: createSkipItem({
        candidateId: fallbackCandidateId,
        confidence: rawCandidate.confidence,
        url: trimToUndefined(rawCandidate.url),
        reason: error instanceof Error ? error.message : String(error),
        termsPolicy: normalizeReferralTermsPolicyResult(rawCandidate.termsPolicy),
      }),
    };
  }
};

const maybeSkipPreparedCandidate = (
  candidate: NormalizedReferralInboxCandidate,
  state: CandidatePlanningState,
): ReferralImportPlanItem | undefined => {
  const existingLinkId = state.existingLinksByUrl.get(candidate.canonicalUrl);
  if (existingLinkId) {
    return createSkipItem({
      candidateId: candidate.candidateId,
      confidence: candidate.confidence,
      url: candidate.url,
      domain: candidate.host,
      reason: `already_exists:${existingLinkId}`,
      termsPolicy: candidate.termsPolicy,
    });
  }
  const duplicateCandidateId = state.seenDedupeKeys.get(candidate.dedupeKey);
  if (duplicateCandidateId) {
    return createSkipItem({
      candidateId: candidate.candidateId,
      confidence: candidate.confidence,
      url: candidate.url,
      domain: candidate.host,
      reason: `duplicate_of:${duplicateCandidateId}`,
      termsPolicy: candidate.termsPolicy,
    });
  }
  state.seenDedupeKeys.set(candidate.dedupeKey, candidate.candidateId);
  const maybeTermsPolicySkipReason = resolveTermsPolicySkipReason(candidate.termsPolicy);
  return maybeTermsPolicySkipReason
    ? createSkipItem({
        candidateId: candidate.candidateId,
        confidence: candidate.confidence,
        url: candidate.url,
        domain: candidate.host,
        reason: maybeTermsPolicySkipReason,
        termsPolicy: candidate.termsPolicy,
      })
    : undefined;
};

const planExistingCatalogCandidate = (
  candidate: NormalizedReferralInboxCandidate,
  state: CandidatePlanningState,
  resolution: NonNullable<ReturnType<typeof resolveReferralCatalogForLink>>,
  familyLabel: string,
): ReferralImportPlanItem => ({
  candidateId: candidate.candidateId,
  disposition: "match_existing_catalog",
  actionable: true,
  applyByDefault: true,
  confidence: candidate.confidence,
  domain: candidate.host,
  url: candidate.url,
  extractedCode: candidate.extractedCode,
  dedupeKey: candidate.dedupeKey,
  termsPolicy: candidate.termsPolicy,
  catalogMatch: buildCatalogMatchSummary(resolution),
  proposedLink: buildPlannedLink({
    candidate,
    familyLabel,
    familySlug: resolution.family.familyId,
    offerSlug: resolution.offer.offerId,
    referral: buildCatalogBackedReferral({
      candidate,
      catalogRef: {
        familyId: resolution.family.familyId,
        offerId: resolution.offer.offerId,
        matcherId: resolution.matcher?.matcherId,
      },
      fallbackTermsUrl: resolution.offer.termsUrl,
    }),
    usedLinkIds: state.usedLinkIds,
    useNonProfileSemantics: shouldUseNonProfileSemantics({ candidate, resolution }),
  }),
});

const planLocalCatalogCandidate = (
  candidate: NormalizedReferralInboxCandidate,
  state: CandidatePlanningState,
  familyLabel: string,
  bundle: NonNullable<ReturnType<typeof buildCatalogAddition>>,
): ReferralImportPlanItem => {
  const addition = bundle.addition;
  state.workingCatalog = appendCatalogAddition(state.workingCatalog, addition);
  return {
    candidateId: candidate.candidateId,
    disposition: "create_local_catalog",
    actionable: true,
    applyByDefault: true,
    confidence: candidate.confidence,
    domain: candidate.host,
    url: candidate.url,
    extractedCode: candidate.extractedCode,
    dedupeKey: candidate.dedupeKey,
    termsPolicy: candidate.termsPolicy,
    plannedCatalogRef: bundle.catalogRef,
    proposedLink: buildPlannedLink({
      candidate,
      familyLabel,
      familySlug: bundle.catalogRef.familyId,
      offerSlug: bundle.catalogRef.offerId,
      referral: buildCatalogBackedReferral({
        candidate,
        catalogRef: bundle.catalogRef,
        fallbackTermsUrl: addition.offer?.termsUrl ?? addition.family?.canonicalProgramUrl,
      }),
      usedLinkIds: state.usedLinkIds,
      useNonProfileSemantics: shouldUseNonProfileSemantics({
        candidate,
        plannedAddition: addition,
      }),
    }),
    localCatalogAddition: addition,
  };
};

const planSharedCatalogCandidate = (
  candidate: NormalizedReferralInboxCandidate,
  state: CandidatePlanningState,
  familyLabel: string,
  bundle: NonNullable<ReturnType<typeof buildCatalogAddition>>,
): ReferralImportPlanItem => ({
  candidateId: candidate.candidateId,
  disposition: "propose_shared_catalog",
  actionable: true,
  applyByDefault: true,
  confidence: candidate.confidence,
  domain: candidate.host,
  url: candidate.url,
  extractedCode: candidate.extractedCode,
  dedupeKey: candidate.dedupeKey,
  termsPolicy: candidate.termsPolicy,
  proposedLink: buildPlannedLink({
    candidate,
    familyLabel,
    familySlug: bundle.catalogRef.familyId,
    offerSlug: bundle.catalogRef.offerId,
    referral: buildManualReferral({
      candidate,
      familyLabel,
      fallbackTermsUrl:
        bundle.addition.offer?.termsUrl ?? bundle.addition.family?.canonicalProgramUrl,
    }),
    usedLinkIds: state.usedLinkIds,
    useNonProfileSemantics: shouldUseNonProfileSemantics({
      candidate,
      plannedAddition: bundle.addition,
    }),
  }),
  sharedCatalogProposal: bundle.addition,
  upstreamWorthyNote: `Review the proposed family/offer/matcher for ${familyLabel}, then move the shared catalog portion into data/policy/referral-catalog.json in a clean upstream PR while keeping fork-owned data out of data/policy/referral-catalog.local.json.`,
});

const planUncatalogedCandidate = (
  candidate: NormalizedReferralInboxCandidate,
  state: CandidatePlanningState,
  familyLabel: string,
): ReferralImportPlanItem => {
  const bundle =
    candidate.catalogScopeHint === "local" || candidate.catalogScopeHint === "shared"
      ? buildCatalogAddition({
          catalog: state.workingCatalog,
          candidate,
          familyIds: state.familyIds,
          offerIds: state.offerIds,
          matcherIds: state.matcherIds,
        })
      : undefined;
  if (candidate.catalogScopeHint === "local" && bundle)
    return planLocalCatalogCandidate(candidate, state, familyLabel, bundle);
  if (candidate.catalogScopeHint === "shared" && bundle)
    return planSharedCatalogCandidate(candidate, state, familyLabel, bundle);
  const fallbackTermsUrl = inferMatcherShape(candidate)?.canonicalProgramUrl;
  return {
    candidateId: candidate.candidateId,
    disposition: "link_only",
    actionable: true,
    applyByDefault: true,
    confidence: candidate.confidence,
    domain: candidate.host,
    url: candidate.url,
    extractedCode: candidate.extractedCode,
    dedupeKey: candidate.dedupeKey,
    termsPolicy: candidate.termsPolicy,
    proposedLink: buildPlannedLink({
      candidate,
      familyLabel,
      familySlug: slugify(familyLabel),
      referral: buildManualReferral({ candidate, familyLabel, fallbackTermsUrl }),
      usedLinkIds: state.usedLinkIds,
      useNonProfileSemantics: shouldUseNonProfileSemantics({ candidate }),
    }),
  };
};

export const planReferralCandidate = (
  rawCandidate: ReferralInboxCandidateInput,
  index: number,
  state: CandidatePlanningState,
): ReferralImportPlanItem => {
  const prepared = maybePrepareCandidate(rawCandidate, index, state);
  if (prepared.kind === "skip") return prepared.item;
  const skipped = maybeSkipPreparedCandidate(prepared.candidate, state);
  if (skipped) return skipped;
  const resolution = resolveReferralCatalogForLink({
    catalog: state.workingCatalog,
    sourceUrl: prepared.candidate.url,
  });
  const familyLabel = summarizeCandidateFamilyLabel(prepared.candidate, resolution);
  return resolution
    ? planExistingCatalogCandidate(prepared.candidate, state, resolution, familyLabel)
    : planUncatalogedCandidate(prepared.candidate, state, familyLabel);
};
