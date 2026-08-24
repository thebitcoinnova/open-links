import type { ReferralCatalogPayload } from "../../src/lib/content/referral-catalog";
import {
  type ReferralCatalog,
  type ReferralCatalogFamily,
  type ReferralCatalogMatcher,
  type ReferralCatalogOffer,
  type ReferralCatalogResolution,
  mergeReferralCatalogPayloads,
  resolveReferralCatalogForLink,
} from "../../src/lib/content/referral-catalog";
import {
  type LinkReferralCatalogRef,
  type LinkReferralConfig,
  type ReferralKind,
  normalizeReferralConfig,
} from "../../src/lib/content/referral-fields";
import type { LinkProfileSemantics } from "../../src/lib/content/social-profile-fields";
import { resolveKnownSite } from "../../src/lib/icons/known-sites-data";
import type {
  NormalizedReferralInboxCandidate,
  PlannedReferralLink,
  ReferralCatalogAddition,
  ReferralCatalogMatchSummary,
  ReferralImportPlan,
  ReferralImportPlanItem,
  ReferralInboxCandidateInput,
  ReferralInboxCandidateSource,
  ReferralTermsPolicyResult,
} from "./import-contract";
import {
  DEFAULT_LINKS_PATH,
  DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
  DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
  DEFAULT_SHARED_REFERRAL_CATALOG_PATH,
} from "./import-contract";
import { normalizeReferralTermsPolicyResult } from "./terms-policy";

import type { InferredMatcherShape, LinksFilePayload } from "./import-candidate";
import {
  NON_PROFILE_TAGS,
  canonicalizeHttpUrl,
  clampConfidence,
  findPathCode,
  findQueryCode,
  normalizeHost,
  resolveBaseHostLabel,
  slugify,
  toTitleCase,
  trimToUndefined,
} from "./import-candidate";
export const createSkipItem = (input: {
  candidateId: string;
  confidence?: number;
  url?: string;
  domain?: string;
  reason: string;
  termsPolicy?: ReferralTermsPolicyResult;
}): ReferralImportPlanItem => ({
  candidateId: input.candidateId,
  disposition: "skip",
  actionable: false,
  applyByDefault: false,
  confidence: clampConfidence(input.confidence),
  url: input.url,
  domain: input.domain,
  termsPolicy: input.termsPolicy,
  skipReason: input.reason,
});

export const resolveTermsPolicySkipReason = (
  termsPolicy: ReferralTermsPolicyResult | undefined,
): string | undefined => {
  if (!termsPolicy) {
    return undefined;
  }

  const reasonToken =
    termsPolicy.matchedRuleId ?? termsPolicy.reason ?? "manual_confirmation_required";

  switch (termsPolicy.status) {
    case "public_forbidden":
      return `terms_policy:public_forbidden:${reasonToken}`;
    case "ambiguous":
      return `terms_review_required:ambiguous:${reasonToken}`;
    case "not_found":
      return `terms_review_required:not_found:${reasonToken}`;
    default:
      return undefined;
  }
};

export const buildCatalogMatchSummary = (
  resolution: ReferralCatalogResolution,
): ReferralCatalogMatchSummary => ({
  source: resolution.source,
  familyId: resolution.family.familyId,
  offerId: resolution.offer.offerId,
  matcherId: resolution.matcher?.matcherId,
});

export const summarizeCandidateFamilyLabel = (
  candidate: NormalizedReferralInboxCandidate,
  resolution?: ReferralCatalogResolution,
): string =>
  resolution?.family.label ??
  candidate.familyLabelHint ??
  resolveKnownSite(candidate.iconHint, candidate.url)?.label ??
  resolveBaseHostLabel(candidate.host);

export const summarizeDescriptorLabel = (
  candidate: NormalizedReferralInboxCandidate,
  parsedUrl: URL,
): string => {
  const joinedText = [parsedUrl.pathname, parsedUrl.search, candidate.source?.subject]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLowerCase();

  if (joinedText.includes("invite")) {
    return "invite";
  }

  if (
    joinedText.includes("signup") ||
    joinedText.includes("join") ||
    joinedText.includes("register")
  ) {
    return "signup";
  }

  if (
    candidate.kind === "promo" ||
    joinedText.includes("promo") ||
    joinedText.includes("coupon") ||
    joinedText.includes("discount")
  ) {
    return "promo";
  }

  return candidate.kind;
};

export const inferMatcherShape = (
  candidate: NormalizedReferralInboxCandidate,
): InferredMatcherShape | undefined => {
  const parsedUrl = new URL(candidate.canonicalUrl);
  const descriptorLabel = summarizeDescriptorLabel(candidate, parsedUrl);
  const linkShapeTags = [descriptorLabel === "invite" ? "invite" : "signup"];

  const queryCode = findQueryCode(parsedUrl);
  if (queryCode) {
    const canonicalProgramUrl = new URL(candidate.canonicalUrl);
    canonicalProgramUrl.searchParams.delete(queryCode.key);

    return {
      descriptorLabel,
      descriptorSlug: slugify(descriptorLabel),
      linkShapeTags: [...linkShapeTags, "query-code"],
      matcher: {
        hosts: [candidate.host],
        pathExact: parsedUrl.pathname,
        requiredQueryKeys: [queryCode.key],
        label: `${toTitleCase(descriptorLabel)} query code`,
        explanation:
          `The saved ${descriptorLabel} link carries the referral code in the ` +
          `'${queryCode.key}' query parameter on ${parsedUrl.pathname}.`,
      },
      canonicalProgramUrl: canonicalProgramUrl.toString(),
    };
  }

  const pathCode = findPathCode(parsedUrl);
  if (!pathCode) {
    return undefined;
  }

  const canonicalProgramUrl = new URL(candidate.canonicalUrl);
  canonicalProgramUrl.pathname = pathCode.prefix;

  return {
    descriptorLabel,
    descriptorSlug: slugify(descriptorLabel),
    linkShapeTags: [...linkShapeTags, "path-code"],
    matcher: {
      hosts: [candidate.host],
      pathPrefix: pathCode.prefix,
      label: `${toTitleCase(descriptorLabel)} path code`,
      explanation:
        `The saved ${descriptorLabel} link encodes the referral code in the path after ` +
        `${pathCode.prefix}.`,
    },
    canonicalProgramUrl: canonicalProgramUrl.toString(),
  };
};

export const normalizeLabelKey = (value: string | undefined): string | undefined => {
  const normalized = trimToUndefined(value);
  return normalized ? normalized.toLowerCase() : undefined;
};

export const findExistingFamily = (
  catalog: ReferralCatalog,
  candidate: NormalizedReferralInboxCandidate,
  familyLabel: string,
): ReferralCatalogFamily | undefined => {
  const normalizedFamilyLabel = normalizeLabelKey(familyLabel);

  return catalog.families.find((family) => {
    const hostMatch = family.canonicalHosts?.some(
      (candidateHost) => normalizeHost(candidateHost) === candidate.host,
    );
    if (hostMatch) {
      return true;
    }

    return normalizeLabelKey(family.label) === normalizedFamilyLabel;
  });
};

export const findExistingOffer = (
  catalog: ReferralCatalog,
  familyId: string,
  offerLabel: string,
): ReferralCatalogOffer | undefined => {
  const familyOffers = catalog.offers.filter((offer) => offer.familyId === familyId);
  const normalizedOfferLabel = normalizeLabelKey(offerLabel);
  const exactOffer = familyOffers.find(
    (offer) => normalizeLabelKey(offer.label) === normalizedOfferLabel,
  );
  return exactOffer ?? (familyOffers.length === 1 ? familyOffers[0] : undefined);
};

export const uniqueId = (base: string, usedIds: Set<string>): string => {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
};

export const arraysEqual = (left: string[] | undefined, right: string[] | undefined): boolean => {
  const leftNormalized = [...(left ?? [])].sort();
  const rightNormalized = [...(right ?? [])].sort();
  if (leftNormalized.length !== rightNormalized.length) {
    return false;
  }

  return leftNormalized.every((value, index) => value === rightNormalized[index]);
};

export const hasSameMatcherShape = (
  existingMatcher: ReferralCatalogMatcher,
  expectedMatcher: ReferralCatalogMatcher,
): boolean =>
  existingMatcher.familyId === expectedMatcher.familyId &&
  existingMatcher.offerId === expectedMatcher.offerId &&
  arraysEqual(existingMatcher.hosts, expectedMatcher.hosts) &&
  existingMatcher.pathExact === expectedMatcher.pathExact &&
  existingMatcher.pathPrefix === expectedMatcher.pathPrefix &&
  arraysEqual(existingMatcher.requiredQueryKeys, expectedMatcher.requiredQueryKeys) &&
  arraysEqual(existingMatcher.linkShapeTags, expectedMatcher.linkShapeTags);

export const buildCatalogAddition = (input: {
  catalog: ReferralCatalog;
  candidate: NormalizedReferralInboxCandidate;
  familyIds: Set<string>;
  offerIds: Set<string>;
  matcherIds: Set<string>;
}): { addition: ReferralCatalogAddition; catalogRef: LinkReferralCatalogRef } | undefined => {
  const inferredMatcher = inferMatcherShape(input.candidate);
  if (!inferredMatcher) {
    return undefined;
  }

  const familyLabel = summarizeCandidateFamilyLabel(input.candidate);
  const existingFamily = findExistingFamily(input.catalog, input.candidate, familyLabel);
  const familyId = existingFamily?.familyId ?? uniqueId(slugify(familyLabel), input.familyIds);
  const offerLabel =
    input.candidate.offerLabelHint ??
    `${familyLabel} ${toTitleCase(inferredMatcher.descriptorLabel)}`;
  const existingOffer = findExistingOffer(input.catalog, familyId, offerLabel);
  const offerId =
    existingOffer?.offerId ??
    uniqueId(`${slugify(familyId)}-${inferredMatcher.descriptorSlug}`, input.offerIds);
  const matcherIdBase =
    `${slugify(familyId)}-${inferredMatcher.descriptorSlug}-` +
    `${inferredMatcher.matcher.pathExact ? "query" : "path"}-referral`;
  const matcherId = uniqueId(matcherIdBase, input.matcherIds);

  const termsUrl = input.candidate.termsUrlHint ?? inferredMatcher.canonicalProgramUrl;

  const family: ReferralCatalogFamily | undefined = existingFamily
    ? undefined
    : {
        familyId,
        label: familyLabel,
        kind: input.candidate.kind,
        description: `${familyLabel} ${input.candidate.kind} program.`,
        canonicalProgramUrl: termsUrl,
        canonicalHosts: [input.candidate.host],
      };
  const offer: ReferralCatalogOffer | undefined = existingOffer
    ? undefined
    : {
        offerId,
        familyId,
        label: offerLabel,
        kind: input.candidate.kind,
        visitorBenefit: input.candidate.visitorBenefitHint,
        ownerBenefit: input.candidate.ownerBenefitHint,
        offerSummary:
          input.candidate.offerSummaryHint ?? `${familyLabel} ${input.candidate.kind} link.`,
        termsSummary: input.candidate.termsSummaryHint,
        termsUrl,
      };
  const matcherCandidate: ReferralCatalogMatcher = {
    matcherId,
    familyId,
    offerId,
    label: `${familyLabel} ${inferredMatcher.matcher.label}`,
    explanation: inferredMatcher.matcher.explanation,
    hosts: inferredMatcher.matcher.hosts,
    pathExact: inferredMatcher.matcher.pathExact,
    pathPrefix: inferredMatcher.matcher.pathPrefix,
    requiredQueryKeys: inferredMatcher.matcher.requiredQueryKeys,
    linkShapeTags: inferredMatcher.linkShapeTags,
  };
  const existingMatcher = input.catalog.matchers.find((candidateMatcher) =>
    hasSameMatcherShape(candidateMatcher, matcherCandidate),
  );
  const matcher = existingMatcher
    ? undefined
    : {
        ...matcherCandidate,
        matcherId,
      };

  return {
    addition: {
      family,
      offer,
      matcher,
    },
    catalogRef: {
      familyId,
      offerId,
      matcherId: existingMatcher?.matcherId ?? matcher?.matcherId,
    },
  };
};

export const buildDefaultOfferSummary = (
  candidate: NormalizedReferralInboxCandidate,
  familyLabel: string,
): string => {
  switch (candidate.kind) {
    case "invite":
      return `${familyLabel} invite link.`;
    case "promo":
      return `${familyLabel} promo link.`;
    case "affiliate":
      return `${familyLabel} affiliate link.`;
    default:
      return `${familyLabel} referral link.`;
  }
};

export const resolveTermsUrl = (input: {
  candidate: NormalizedReferralInboxCandidate;
  fallbackTermsUrl?: string;
}): string | undefined => input.candidate.termsUrlHint ?? trimToUndefined(input.fallbackTermsUrl);

export const buildManualReferral = (input: {
  candidate: NormalizedReferralInboxCandidate;
  familyLabel: string;
  fallbackTermsUrl?: string;
}): LinkReferralConfig =>
  normalizeReferralConfig({
    kind: input.candidate.kind,
    visitorBenefit: input.candidate.visitorBenefitHint,
    ownerBenefit: input.candidate.ownerBenefitHint,
    offerSummary:
      input.candidate.offerSummaryHint ??
      buildDefaultOfferSummary(input.candidate, input.familyLabel),
    termsSummary: input.candidate.termsSummaryHint,
    termsUrl: resolveTermsUrl({
      candidate: input.candidate,
      fallbackTermsUrl: input.fallbackTermsUrl,
    }),
  }) ?? {};

export const buildCatalogBackedReferral = (input: {
  candidate: NormalizedReferralInboxCandidate;
  catalogRef: LinkReferralCatalogRef;
  fallbackTermsUrl?: string;
}): LinkReferralConfig =>
  normalizeReferralConfig({
    catalogRef: input.catalogRef,
    visitorBenefit: input.candidate.visitorBenefitHint,
    ownerBenefit: input.candidate.ownerBenefitHint,
    offerSummary: input.candidate.offerSummaryHint,
    termsSummary: input.candidate.termsSummaryHint,
    termsUrl: resolveTermsUrl({
      candidate: input.candidate,
      fallbackTermsUrl: input.fallbackTermsUrl,
    }),
  }) ?? { catalogRef: input.catalogRef };

export const shouldUseNonProfileSemantics = (input: {
  candidate: NormalizedReferralInboxCandidate;
  resolution?: ReferralCatalogResolution;
  plannedAddition?: ReferralCatalogAddition;
}): boolean => {
  if (input.candidate.profileSemanticsHint === "profile") {
    return false;
  }

  if (input.candidate.profileSemanticsHint === "non_profile") {
    return true;
  }

  const resolutionTags = input.resolution?.matcher?.linkShapeTags ?? [];
  if (resolutionTags.some((tag) => NON_PROFILE_TAGS.has(tag))) {
    return true;
  }

  const plannedTags = input.plannedAddition?.matcher?.linkShapeTags ?? [];
  return plannedTags.some((tag) => NON_PROFILE_TAGS.has(tag));
};

export const buildLinkLabel = (input: {
  candidate: NormalizedReferralInboxCandidate;
  familyLabel: string;
}): string => {
  if (input.candidate.labelHint) {
    return input.candidate.labelHint;
  }

  switch (input.candidate.kind) {
    case "invite":
      return `Join ${input.familyLabel}`;
    case "promo":
      return `${input.familyLabel} Offer`;
    case "affiliate":
      return `${input.familyLabel} Affiliate`;
    default:
      return `Join ${input.familyLabel}`;
  }
};

export const buildLinkDescription = (input: {
  candidate: NormalizedReferralInboxCandidate;
  familyLabel: string;
  referral: LinkReferralConfig;
}): string =>
  input.candidate.descriptionHint ??
  trimToUndefined(input.referral.offerSummary) ??
  buildDefaultOfferSummary(input.candidate, input.familyLabel);

export const generateReferralLinkId = (input: {
  candidate: NormalizedReferralInboxCandidate;
  familySlug?: string;
  offerSlug?: string;
  usedIds: Set<string>;
}): string => {
  const familySlug = slugify(input.familySlug ?? resolveBaseHostLabel(input.candidate.host));
  const offerSlug = slugify(input.candidate.extractedCode ?? input.offerSlug ?? "offer");
  return uniqueId(`ref-${familySlug}-${offerSlug}`, input.usedIds);
};

export const buildPlannedLink = (input: {
  candidate: NormalizedReferralInboxCandidate;
  familyLabel: string;
  familySlug?: string;
  offerSlug?: string;
  referral: LinkReferralConfig;
  usedLinkIds: Set<string>;
  useNonProfileSemantics: boolean;
}): PlannedReferralLink => {
  const icon =
    input.candidate.iconHint ?? resolveKnownSite(undefined, input.candidate.url)?.id ?? "globe";
  const linkId = generateReferralLinkId({
    candidate: input.candidate,
    familySlug: input.familySlug,
    offerSlug: input.offerSlug,
    usedIds: input.usedLinkIds,
  });

  return {
    id: linkId,
    label: buildLinkLabel({
      candidate: input.candidate,
      familyLabel: input.familyLabel,
    }),
    url: input.candidate.url,
    type: "rich",
    icon,
    description: buildLinkDescription({
      candidate: input.candidate,
      familyLabel: input.familyLabel,
      referral: input.referral,
    }),
    enabled: true,
    group: input.candidate.groupHint,
    referral: input.referral,
    enrichment: {
      enabled: true,
      ...(input.useNonProfileSemantics ? { profileSemantics: "non_profile" } : {}),
    },
  };
};

export const upsertCatalogEntry = <T, K extends keyof T>(
  entries: T[] | undefined,
  entry: T | undefined,
  idKey: K,
): T[] => {
  const nextEntries = [...(entries ?? [])];
  if (!entry) {
    return nextEntries;
  }

  const entryId = entry[idKey];
  const existingIndex = nextEntries.findIndex((candidate) => candidate[idKey] === entryId);
  if (existingIndex >= 0) {
    nextEntries[existingIndex] = entry;
    return nextEntries;
  }

  nextEntries.push(entry);
  return nextEntries;
};

export const cloneCatalog = (catalog: ReferralCatalog): ReferralCatalog => ({
  version: catalog.version,
  updatedAt: catalog.updatedAt,
  families: [...catalog.families],
  offers: [...catalog.offers],
  matchers: [...catalog.matchers],
});

export const buildExistingLinkByUrl = (
  linksPayload: LinksFilePayload,
): { byUrl: Map<string, string>; usedIds: Set<string> } => {
  const byUrl = new Map<string, string>();
  const usedIds = new Set<string>();

  for (const rawLink of linksPayload.links ?? []) {
    const linkId = trimToUndefined(rawLink.id);
    if (linkId) {
      usedIds.add(linkId);
    }

    const canonicalUrl = rawLink.url ? canonicalizeHttpUrl(rawLink.url) : undefined;
    if (canonicalUrl && linkId) {
      byUrl.set(canonicalUrl, linkId);
    }
  }

  return { byUrl, usedIds };
};

export const appendCatalogAddition = (
  catalog: ReferralCatalog,
  addition: ReferralCatalogAddition,
): ReferralCatalog => ({
  ...catalog,
  families: upsertCatalogEntry(catalog.families, addition.family, "familyId"),
  offers: upsertCatalogEntry(catalog.offers, addition.offer, "offerId"),
  matchers: upsertCatalogEntry(catalog.matchers, addition.matcher, "matcherId"),
});
