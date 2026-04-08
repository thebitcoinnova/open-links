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

interface ExistingLinkRecord {
  id?: string;
  url?: string;
}

export interface LinksFilePayload {
  links?: ExistingLinkRecord[];
}

interface BuildReferralImportPlanInput {
  candidates: ReferralInboxCandidateInput[];
  linksPayload: LinksFilePayload;
  sharedCatalogPayload?: ReferralCatalogPayload;
  localCatalogPayload?: ReferralCatalogPayload;
  inputPath?: string;
  linksPath?: string;
  sharedCatalogPath?: string;
  localCatalogPath?: string;
}

interface ApplyReferralImportPlanInput {
  plan: ReferralImportPlan;
  linksPayload: LinksFilePayload;
  localCatalogPayload?: ReferralCatalogPayload & { $schema?: string };
  selectedCandidateIds: string[];
}

export interface AppliedReferralImportPlan {
  linksPayload: LinksFilePayload;
  localCatalogPayload: ReferralCatalogPayload & { $schema?: string };
  appliedCandidateIds: string[];
  skippedCandidateIds: string[];
  sharedCatalogNotes: string[];
}

interface InferredMatcherShape {
  descriptorLabel: string;
  descriptorSlug: string;
  linkShapeTags: string[];
  matcher: Pick<
    ReferralCatalogMatcher,
    "hosts" | "pathExact" | "pathPrefix" | "requiredQueryKeys" | "label" | "explanation"
  >;
  canonicalProgramUrl: string;
}

const EMPTY_LOCAL_REFERRAL_CATALOG: ReferralCatalogPayload & { $schema: string } = {
  $schema: "../../schema/referral-catalog.schema.json",
  version: 1,
  updatedAt: "1970-01-01T00:00:00.000Z",
  families: [],
  offers: [],
  matchers: [],
};

const REFERRAL_QUERY_KEYS = [
  "referral",
  "ref",
  "invite",
  "invite_code",
  "invitecode",
  "promo",
  "promo_code",
  "promocode",
  "code",
  "coupon",
];
const PATH_CODE_SEGMENTS = new Set([
  "co",
  "code",
  "invite",
  "promo",
  "r",
  "ref",
  "refer",
  "referral",
  "signup",
]);
const HOST_SEGMENT_STOP_WORDS = new Set([
  "app",
  "go",
  "join",
  "links",
  "m",
  "ref",
  "referral",
  "signup",
  "www",
]);
const NON_PROFILE_TAGS = new Set(["invite", "signup"]);

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const clampConfidence = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0.7;
  }

  return Math.max(0, Math.min(1, value ?? 0.7));
};

const slugify = (value: string): string => {
  const lowered = value.trim().toLowerCase();
  const normalized = lowered.replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : "item";
};

const toTitleCase = (value: string): string =>
  value
    .split(/[\s-]+/u)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");

const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

const canonicalizeHttpUrl = (value: string): string | undefined => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    return undefined;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return undefined;
  }

  parsedUrl.hash = "";
  parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

  if (
    (parsedUrl.protocol === "https:" && parsedUrl.port === "443") ||
    (parsedUrl.protocol === "http:" && parsedUrl.port === "80")
  ) {
    parsedUrl.port = "";
  }

  if (parsedUrl.pathname.length > 1) {
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/u, "");
  }

  const sortedQueryEntries = [...parsedUrl.searchParams.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  parsedUrl.search = "";
  for (const [key, candidate] of sortedQueryEntries) {
    parsedUrl.searchParams.append(key, candidate);
  }

  return parsedUrl.toString();
};

const resolveBaseHostLabel = (host: string): string => {
  const segments = normalizeHost(host).split(".");
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const segment = segments[index];
    if (!HOST_SEGMENT_STOP_WORDS.has(segment)) {
      return toTitleCase(segment);
    }
  }

  return toTitleCase(segments[0] ?? "Referral");
};

const normalizeSource = (
  source: ReferralInboxCandidateSource | undefined,
): ReferralInboxCandidateSource | undefined => {
  if (!source) {
    return undefined;
  }

  const normalized: ReferralInboxCandidateSource = {};
  for (const [key, candidate] of Object.entries(source)) {
    const normalizedValue = trimToUndefined(candidate);
    if (normalizedValue) {
      normalized[key as keyof ReferralInboxCandidateSource] = normalizedValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const inferReferralKind = (input: {
  kindHint?: ReferralKind;
  source?: ReferralInboxCandidateSource;
  url: string;
  notes?: string;
}): ReferralKind => {
  if (input.kindHint) {
    return input.kindHint;
  }

  const joinedText = [
    input.url,
    input.source?.subject,
    input.source?.searchQuery,
    trimToUndefined(input.notes),
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLowerCase();

  if (joinedText.includes("affiliate")) {
    return "affiliate";
  }

  if (
    joinedText.includes("promo") ||
    joinedText.includes("coupon") ||
    joinedText.includes("discount")
  ) {
    return "promo";
  }

  if (joinedText.includes("invite")) {
    return "invite";
  }

  return "referral";
};

const findQueryCode = (parsedUrl: URL): { key: string; value: string } | undefined => {
  const prioritizedEntries = [...parsedUrl.searchParams.entries()].sort(([leftKey], [rightKey]) => {
    const leftPriority = REFERRAL_QUERY_KEYS.indexOf(leftKey.toLowerCase());
    const rightPriority = REFERRAL_QUERY_KEYS.indexOf(rightKey.toLowerCase());

    if (leftPriority >= 0 && rightPriority >= 0) {
      return leftPriority - rightPriority;
    }

    if (leftPriority >= 0) {
      return -1;
    }

    if (rightPriority >= 0) {
      return 1;
    }

    return leftKey.localeCompare(rightKey);
  });

  for (const [key, rawValue] of prioritizedEntries) {
    const value = trimToUndefined(rawValue);
    if (!value) {
      continue;
    }

    const loweredKey = key.toLowerCase();
    if (
      REFERRAL_QUERY_KEYS.includes(loweredKey) ||
      loweredKey.includes("ref") ||
      loweredKey.includes("invite") ||
      loweredKey.includes("promo") ||
      loweredKey.includes("code")
    ) {
      return { key, value };
    }
  }

  return undefined;
};

const findPathCode = (parsedUrl: URL): { value: string; prefix: string } | undefined => {
  const segments = parsedUrl.pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return undefined;
  }

  const maybeValue = trimToUndefined(segments.at(-1));
  const maybePrefixSegment = trimToUndefined(segments.at(-2));
  if (!maybeValue || !maybePrefixSegment) {
    return undefined;
  }

  if (!PATH_CODE_SEGMENTS.has(maybePrefixSegment.toLowerCase())) {
    return undefined;
  }

  return {
    value: maybeValue,
    prefix: `/${segments.slice(0, -1).join("/")}/`,
  };
};

export const extractReferralCodeHint = (value: string): string | undefined => {
  const canonicalUrl = canonicalizeHttpUrl(value);
  if (!canonicalUrl) {
    return undefined;
  }

  const parsedUrl = new URL(canonicalUrl);
  return findQueryCode(parsedUrl)?.value ?? findPathCode(parsedUrl)?.value;
};

const normalizeProfileSemanticsHint = (
  value: LinkProfileSemantics | undefined,
): LinkProfileSemantics | undefined =>
  value === "auto" || value === "profile" || value === "non_profile" ? value : undefined;

const resolvePlanningUrl = (
  input: ReferralInboxCandidateInput,
): { url?: string; skipReason?: string } => {
  const approvedUrl = trimToUndefined(input.approvedUrl);
  if (approvedUrl) {
    return {
      url: approvedUrl,
    };
  }

  if (input.resolution?.status === "review_required") {
    return {
      skipReason: `review_required:${input.resolution.reason ?? input.resolution.reviewReason ?? "manual_review_required"}`,
    };
  }

  if (input.resolution?.status === "unresolved") {
    return {
      skipReason: `unresolved:${input.resolution.reason ?? "resolution_failed"}`,
    };
  }

  return {
    url: trimToUndefined(input.resolution?.recommendedUrl) ?? trimToUndefined(input.url),
  };
};

export const normalizeReferralInboxCandidate = (
  input: ReferralInboxCandidateInput,
  options?: { index?: number; usedCandidateIds?: Set<string> },
): NormalizedReferralInboxCandidate => {
  const maybeUrl = resolvePlanningUrl(input).url;
  const canonicalUrl = maybeUrl ? canonicalizeHttpUrl(maybeUrl) : undefined;
  if (!canonicalUrl) {
    throw new Error("Missing a valid http(s) referral URL.");
  }

  const parsedUrl = new URL(canonicalUrl);
  const usedCandidateIds = options?.usedCandidateIds ?? new Set<string>();
  const code = extractReferralCodeHint(canonicalUrl);
  const baseCandidateId = slugify(
    input.candidateId ??
      input.source?.messageId ??
      `${normalizeHost(parsedUrl.hostname)}-${code ?? String((options?.index ?? 0) + 1)}`,
  );
  let candidateId = baseCandidateId;
  let suffix = 2;
  while (usedCandidateIds.has(candidateId)) {
    candidateId = `${baseCandidateId}-${suffix}`;
    suffix += 1;
  }
  usedCandidateIds.add(candidateId);

  const catalogScopeHint =
    input.catalogScopeHint === "local" || input.catalogScopeHint === "shared"
      ? input.catalogScopeHint
      : undefined;

  return {
    candidateId,
    source: normalizeSource(input.source),
    url: canonicalUrl,
    canonicalUrl,
    host: normalizeHost(parsedUrl.hostname),
    confidence: clampConfidence(input.confidence),
    kind: inferReferralKind({
      kindHint: input.kindHint,
      source: input.source,
      url: canonicalUrl,
      notes: input.notes,
    }),
    catalogScopeHint,
    profileSemanticsHint: normalizeProfileSemanticsHint(input.profileSemanticsHint),
    labelHint: trimToUndefined(input.labelHint),
    descriptionHint: trimToUndefined(input.descriptionHint),
    groupHint: trimToUndefined(input.groupHint),
    iconHint: trimToUndefined(input.iconHint),
    familyLabelHint: trimToUndefined(input.familyLabelHint),
    offerLabelHint: trimToUndefined(input.offerLabelHint),
    visitorBenefitHint: trimToUndefined(input.visitorBenefitHint),
    ownerBenefitHint: trimToUndefined(input.ownerBenefitHint),
    offerSummaryHint: trimToUndefined(input.offerSummaryHint),
    termsSummaryHint: trimToUndefined(input.termsSummaryHint),
    termsUrlHint: trimToUndefined(input.termsUrlHint),
    termsPolicy: normalizeReferralTermsPolicyResult(input.termsPolicy),
    notes: trimToUndefined(input.notes),
    extractedCode: code,
    dedupeKey: canonicalUrl,
  };
};

const createSkipItem = (input: {
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

const resolveTermsPolicySkipReason = (
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

const buildCatalogMatchSummary = (
  resolution: ReferralCatalogResolution,
): ReferralCatalogMatchSummary => ({
  source: resolution.source,
  familyId: resolution.family.familyId,
  offerId: resolution.offer.offerId,
  matcherId: resolution.matcher?.matcherId,
});

const summarizeCandidateFamilyLabel = (
  candidate: NormalizedReferralInboxCandidate,
  resolution?: ReferralCatalogResolution,
): string =>
  resolution?.family.label ??
  candidate.familyLabelHint ??
  resolveKnownSite(candidate.iconHint, candidate.url)?.label ??
  resolveBaseHostLabel(candidate.host);

const summarizeDescriptorLabel = (
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

const inferMatcherShape = (
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

const normalizeLabelKey = (value: string | undefined): string | undefined => {
  const normalized = trimToUndefined(value);
  return normalized ? normalized.toLowerCase() : undefined;
};

const findExistingFamily = (
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

const findExistingOffer = (
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

const uniqueId = (base: string, usedIds: Set<string>): string => {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
};

const arraysEqual = (left: string[] | undefined, right: string[] | undefined): boolean => {
  const leftNormalized = [...(left ?? [])].sort();
  const rightNormalized = [...(right ?? [])].sort();
  if (leftNormalized.length !== rightNormalized.length) {
    return false;
  }

  return leftNormalized.every((value, index) => value === rightNormalized[index]);
};

const hasSameMatcherShape = (
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

const buildCatalogAddition = (input: {
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

const buildDefaultOfferSummary = (
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

const resolveTermsUrl = (input: {
  candidate: NormalizedReferralInboxCandidate;
  fallbackTermsUrl?: string;
}): string | undefined => input.candidate.termsUrlHint ?? trimToUndefined(input.fallbackTermsUrl);

const buildManualReferral = (input: {
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

const buildCatalogBackedReferral = (input: {
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

const shouldUseNonProfileSemantics = (input: {
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

const buildLinkLabel = (input: {
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

const buildLinkDescription = (input: {
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

const buildPlannedLink = (input: {
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

const upsertCatalogEntry = <T, K extends keyof T>(
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

const cloneCatalog = (catalog: ReferralCatalog): ReferralCatalog => ({
  version: catalog.version,
  updatedAt: catalog.updatedAt,
  families: [...catalog.families],
  offers: [...catalog.offers],
  matchers: [...catalog.matchers],
});

const buildExistingLinkByUrl = (
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

const appendCatalogAddition = (
  catalog: ReferralCatalog,
  addition: ReferralCatalogAddition,
): ReferralCatalog => ({
  ...catalog,
  families: upsertCatalogEntry(catalog.families, addition.family, "familyId"),
  offers: upsertCatalogEntry(catalog.offers, addition.offer, "offerId"),
  matchers: upsertCatalogEntry(catalog.matchers, addition.matcher, "matcherId"),
});

export const buildReferralImportPlan = (
  input: BuildReferralImportPlanInput,
): ReferralImportPlan => {
  const catalog = mergeReferralCatalogPayloads(
    input.sharedCatalogPayload,
    input.localCatalogPayload,
  );
  let workingCatalog = cloneCatalog(catalog);
  const familyIds = new Set(workingCatalog.families.map((family) => family.familyId));
  const offerIds = new Set(workingCatalog.offers.map((offer) => offer.offerId));
  const matcherIds = new Set(workingCatalog.matchers.map((matcher) => matcher.matcherId));
  const { byUrl: existingLinksByUrl, usedIds: usedLinkIds } = buildExistingLinkByUrl(
    input.linksPayload,
  );
  const usedCandidateIds = new Set<string>();
  const seenDedupeKeys = new Map<string, string>();
  const items: ReferralImportPlanItem[] = [];

  input.candidates.forEach((rawCandidate, index) => {
    const fallbackCandidateId = slugify(rawCandidate.candidateId ?? `candidate-${index + 1}`);
    const planningUrl = resolvePlanningUrl(rawCandidate);

    if (planningUrl.skipReason) {
      items.push(
        createSkipItem({
          candidateId: fallbackCandidateId,
          confidence: rawCandidate.confidence,
          url: trimToUndefined(rawCandidate.approvedUrl) ?? trimToUndefined(rawCandidate.url),
          reason: planningUrl.skipReason,
          termsPolicy: normalizeReferralTermsPolicyResult(rawCandidate.termsPolicy),
        }),
      );
      return;
    }

    let candidate: NormalizedReferralInboxCandidate;
    try {
      candidate = normalizeReferralInboxCandidate(rawCandidate, {
        index,
        usedCandidateIds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      items.push(
        createSkipItem({
          candidateId: fallbackCandidateId,
          confidence: rawCandidate.confidence,
          url: trimToUndefined(rawCandidate.url),
          reason: message,
          termsPolicy: normalizeReferralTermsPolicyResult(rawCandidate.termsPolicy),
        }),
      );
      return;
    }

    if (existingLinksByUrl.has(candidate.canonicalUrl)) {
      items.push(
        createSkipItem({
          candidateId: candidate.candidateId,
          confidence: candidate.confidence,
          url: candidate.url,
          domain: candidate.host,
          reason: `already_exists:${existingLinksByUrl.get(candidate.canonicalUrl)}`,
          termsPolicy: candidate.termsPolicy,
        }),
      );
      return;
    }

    if (seenDedupeKeys.has(candidate.dedupeKey)) {
      items.push(
        createSkipItem({
          candidateId: candidate.candidateId,
          confidence: candidate.confidence,
          url: candidate.url,
          domain: candidate.host,
          reason: `duplicate_of:${seenDedupeKeys.get(candidate.dedupeKey)}`,
          termsPolicy: candidate.termsPolicy,
        }),
      );
      return;
    }

    seenDedupeKeys.set(candidate.dedupeKey, candidate.candidateId);

    const maybeTermsPolicySkipReason = resolveTermsPolicySkipReason(candidate.termsPolicy);
    if (maybeTermsPolicySkipReason) {
      items.push(
        createSkipItem({
          candidateId: candidate.candidateId,
          confidence: candidate.confidence,
          url: candidate.url,
          domain: candidate.host,
          reason: maybeTermsPolicySkipReason,
          termsPolicy: candidate.termsPolicy,
        }),
      );
      return;
    }

    const resolution = resolveReferralCatalogForLink({
      catalog: workingCatalog,
      sourceUrl: candidate.url,
    });
    const familyLabel = summarizeCandidateFamilyLabel(candidate, resolution);

    if (resolution) {
      const proposedLink = buildPlannedLink({
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
        usedLinkIds,
        useNonProfileSemantics: shouldUseNonProfileSemantics({
          candidate,
          resolution,
        }),
      });

      items.push({
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
        proposedLink,
      });
      return;
    }

    const catalogAdditionBundle =
      candidate.catalogScopeHint === "local" || candidate.catalogScopeHint === "shared"
        ? buildCatalogAddition({
            catalog: workingCatalog,
            candidate,
            familyIds,
            offerIds,
            matcherIds,
          })
        : undefined;

    if (candidate.catalogScopeHint === "local" && catalogAdditionBundle) {
      const plannedAddition = catalogAdditionBundle.addition;
      workingCatalog = appendCatalogAddition(workingCatalog, plannedAddition);
      const proposedLink = buildPlannedLink({
        candidate,
        familyLabel,
        familySlug: catalogAdditionBundle.catalogRef.familyId,
        offerSlug: catalogAdditionBundle.catalogRef.offerId,
        referral: buildCatalogBackedReferral({
          candidate,
          catalogRef: catalogAdditionBundle.catalogRef,
          fallbackTermsUrl:
            plannedAddition.offer?.termsUrl ?? plannedAddition.family?.canonicalProgramUrl,
        }),
        usedLinkIds,
        useNonProfileSemantics: shouldUseNonProfileSemantics({
          candidate,
          plannedAddition,
        }),
      });

      items.push({
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
        plannedCatalogRef: catalogAdditionBundle.catalogRef,
        proposedLink,
        localCatalogAddition: plannedAddition,
      });
      return;
    }

    if (candidate.catalogScopeHint === "shared" && catalogAdditionBundle) {
      const proposedLink = buildPlannedLink({
        candidate,
        familyLabel,
        familySlug: catalogAdditionBundle.catalogRef.familyId,
        offerSlug: catalogAdditionBundle.catalogRef.offerId,
        referral: buildManualReferral({
          candidate,
          familyLabel,
          fallbackTermsUrl:
            catalogAdditionBundle.addition.offer?.termsUrl ??
            catalogAdditionBundle.addition.family?.canonicalProgramUrl,
        }),
        usedLinkIds,
        useNonProfileSemantics: shouldUseNonProfileSemantics({
          candidate,
          plannedAddition: catalogAdditionBundle.addition,
        }),
      });

      items.push({
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
        proposedLink,
        sharedCatalogProposal: catalogAdditionBundle.addition,
        upstreamWorthyNote: `Review the proposed family/offer/matcher for ${familyLabel}, then move the shared catalog portion into data/policy/referral-catalog.json in a clean upstream PR while keeping fork-owned data out of data/policy/referral-catalog.local.json.`,
      });
      return;
    }

    const fallbackTermsUrl = inferMatcherShape(candidate)?.canonicalProgramUrl;
    const manualReferral = buildManualReferral({
      candidate,
      familyLabel,
      fallbackTermsUrl,
    });
    const proposedLink = buildPlannedLink({
      candidate,
      familyLabel,
      familySlug: slugify(familyLabel),
      referral: manualReferral,
      usedLinkIds,
      useNonProfileSemantics: shouldUseNonProfileSemantics({
        candidate,
      }),
    });

    items.push({
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
      proposedLink,
    });
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    inputPath: input.inputPath ?? DEFAULT_REFERRAL_IMPORT_INPUT_PATH,
    linksPath: input.linksPath ?? DEFAULT_LINKS_PATH,
    sharedCatalogPath: input.sharedCatalogPath ?? DEFAULT_SHARED_REFERRAL_CATALOG_PATH,
    localCatalogPath: input.localCatalogPath ?? DEFAULT_LOCAL_REFERRAL_CATALOG_PATH,
    items,
  };
};

const normalizeLocalCatalogPayload = (
  payload: (ReferralCatalogPayload & { $schema?: string }) | undefined,
): ReferralCatalogPayload & { $schema?: string } => ({
  $schema: payload?.$schema ?? EMPTY_LOCAL_REFERRAL_CATALOG.$schema,
  version: 1,
  updatedAt: payload?.updatedAt ?? EMPTY_LOCAL_REFERRAL_CATALOG.updatedAt,
  families: [...(payload?.families ?? [])],
  offers: [...(payload?.offers ?? [])],
  matchers: [...(payload?.matchers ?? [])],
});

export const defaultSelectedCandidateIds = (plan: ReferralImportPlan): string[] =>
  plan.items
    .filter((item) => item.applyByDefault && item.actionable && item.proposedLink)
    .map((item) => item.candidateId);

export const applyReferralImportPlan = (
  input: ApplyReferralImportPlanInput,
): AppliedReferralImportPlan => {
  const requestedCandidateIds = new Set(input.selectedCandidateIds);
  const knownCandidateIds = new Set(input.plan.items.map((item) => item.candidateId));
  for (const candidateId of requestedCandidateIds) {
    if (!knownCandidateIds.has(candidateId)) {
      throw new Error(`Unknown candidate id '${candidateId}' in referral import apply step.`);
    }
  }

  const linksPayload: LinksFilePayload = {
    links: [...(input.linksPayload.links ?? [])],
  };
  const localCatalogPayload = normalizeLocalCatalogPayload(input.localCatalogPayload);
  const { byUrl: existingLinksByUrl, usedIds: usedLinkIds } = buildExistingLinkByUrl(linksPayload);
  const appliedCandidateIds: string[] = [];
  const skippedCandidateIds: string[] = [];
  const sharedCatalogNotes: string[] = [];

  for (const item of input.plan.items) {
    if (!requestedCandidateIds.has(item.candidateId)) {
      continue;
    }

    if (!item.proposedLink || !item.actionable || item.disposition === "skip") {
      skippedCandidateIds.push(item.candidateId);
      continue;
    }

    const canonicalUrl = canonicalizeHttpUrl(item.proposedLink.url);
    if (!canonicalUrl) {
      throw new Error(`Planned link '${item.proposedLink.id}' has an invalid URL.`);
    }

    if (usedLinkIds.has(item.proposedLink.id)) {
      throw new Error(
        `Planned link id '${item.proposedLink.id}' already exists in data/links.json.`,
      );
    }

    if (existingLinksByUrl.has(canonicalUrl)) {
      throw new Error(
        `Planned link URL '${item.proposedLink.url}' already exists as '${existingLinksByUrl.get(
          canonicalUrl,
        )}'.`,
      );
    }

    linksPayload.links?.push(item.proposedLink);
    usedLinkIds.add(item.proposedLink.id);
    existingLinksByUrl.set(canonicalUrl, item.proposedLink.id);

    if (item.disposition === "create_local_catalog" && item.localCatalogAddition) {
      localCatalogPayload.families = upsertCatalogEntry(
        localCatalogPayload.families,
        item.localCatalogAddition.family,
        "familyId",
      );
      localCatalogPayload.offers = upsertCatalogEntry(
        localCatalogPayload.offers,
        item.localCatalogAddition.offer,
        "offerId",
      );
      localCatalogPayload.matchers = upsertCatalogEntry(
        localCatalogPayload.matchers,
        item.localCatalogAddition.matcher,
        "matcherId",
      );
      localCatalogPayload.updatedAt = new Date().toISOString();
    }

    if (item.disposition === "propose_shared_catalog" && item.upstreamWorthyNote) {
      sharedCatalogNotes.push(item.upstreamWorthyNote);
    }

    appliedCandidateIds.push(item.candidateId);
  }

  return {
    linksPayload,
    localCatalogPayload,
    appliedCandidateIds,
    skippedCandidateIds,
    sharedCatalogNotes,
  };
};

const tableCell = (value: string, width: number): string => {
  const normalized = value.length > width ? `${value.slice(0, Math.max(1, width - 3))}...` : value;
  return normalized.padEnd(width, " ");
};

export const renderReferralImportPlanTable = (plan: ReferralImportPlan): string => {
  const columns = [
    { key: "candidateId", label: "Candidate", width: 18 },
    { key: "domain", label: "Domain", width: 22 },
    { key: "extractedCode", label: "Code", width: 14 },
    { key: "confidence", label: "Conf", width: 6 },
    { key: "disposition", label: "Disposition", width: 24 },
    { key: "catalog", label: "Catalog", width: 32 },
  ] as const;

  const header = columns.map((column) => tableCell(column.label, column.width)).join(" | ");
  const divider = columns.map((column) => "-".repeat(column.width)).join("-+-");
  const rows = plan.items.map((item) => {
    const catalog =
      item.catalogMatch?.matcherId ??
      item.catalogMatch?.offerId ??
      item.plannedCatalogRef?.matcherId ??
      item.plannedCatalogRef?.offerId ??
      item.skipReason ??
      "";

    return [
      tableCell(item.candidateId, 18),
      tableCell(item.domain ?? "", 22),
      tableCell(item.extractedCode ?? "", 14),
      tableCell(item.confidence.toFixed(2), 6),
      tableCell(item.disposition, 24),
      tableCell(catalog, 32),
    ].join(" | ");
  });

  return [header, divider, ...rows].join("\n");
};
