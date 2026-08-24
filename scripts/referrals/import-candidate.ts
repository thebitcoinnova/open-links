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

export interface ExistingLinkRecord {
  id?: string;
  url?: string;
}

export interface LinksFilePayload {
  links?: ExistingLinkRecord[];
}

export interface BuildReferralImportPlanInput {
  candidates: ReferralInboxCandidateInput[];
  linksPayload: LinksFilePayload;
  sharedCatalogPayload?: ReferralCatalogPayload;
  localCatalogPayload?: ReferralCatalogPayload;
  inputPath?: string;
  linksPath?: string;
  sharedCatalogPath?: string;
  localCatalogPath?: string;
}

export interface ApplyReferralImportPlanInput {
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

export interface InferredMatcherShape {
  descriptorLabel: string;
  descriptorSlug: string;
  linkShapeTags: string[];
  matcher: Pick<
    ReferralCatalogMatcher,
    "hosts" | "pathExact" | "pathPrefix" | "requiredQueryKeys" | "label" | "explanation"
  >;
  canonicalProgramUrl: string;
}

export const EMPTY_LOCAL_REFERRAL_CATALOG: ReferralCatalogPayload & { $schema: string } = {
  $schema: "../../schema/referral-catalog.schema.json",
  version: 1,
  updatedAt: "1970-01-01T00:00:00.000Z",
  families: [],
  offers: [],
  matchers: [],
};

export const REFERRAL_QUERY_KEYS = [
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
export const PATH_CODE_SEGMENTS = new Set([
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
export const HOST_SEGMENT_STOP_WORDS = new Set([
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
export const NON_PROFILE_TAGS = new Set(["invite", "signup"]);

export const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const clampConfidence = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 0.7;
  }

  return Math.max(0, Math.min(1, value ?? 0.7));
};

export const slugify = (value: string): string => {
  const lowered = value.trim().toLowerCase();
  const normalized = lowered.replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : "item";
};

export const toTitleCase = (value: string): string =>
  value
    .split(/[\s-]+/u)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");

export const normalizeHost = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "");

export const canonicalizeHttpUrl = (value: string): string | undefined => {
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

export const resolveBaseHostLabel = (host: string): string => {
  const segments = normalizeHost(host).split(".");
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const segment = segments[index];
    if (!HOST_SEGMENT_STOP_WORDS.has(segment)) {
      return toTitleCase(segment);
    }
  }

  return toTitleCase(segments[0] ?? "Referral");
};

export const normalizeSource = (
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

export const inferReferralKind = (input: {
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

export const findQueryCode = (parsedUrl: URL): { key: string; value: string } | undefined => {
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

export const findPathCode = (parsedUrl: URL): { value: string; prefix: string } | undefined => {
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

export const normalizeProfileSemanticsHint = (
  value: LinkProfileSemantics | undefined,
): LinkProfileSemantics | undefined =>
  value === "auto" || value === "profile" || value === "non_profile" ? value : undefined;

export const resolvePlanningUrl = (
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
