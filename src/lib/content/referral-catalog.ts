import type { LinkReferralCatalogRef, LinkReferralConfig, ReferralKind } from "./referral-fields";

export interface ReferralCatalogFamily {
  familyId: string;
  label: string;
  kind?: ReferralKind;
  description?: string;
  canonicalProgramUrl?: string;
  canonicalHosts?: string[];
  custom?: Record<string, unknown>;
}

export interface ReferralCatalogOffer extends LinkReferralConfig {
  offerId: string;
  familyId: string;
  label: string;
}

export interface ReferralCatalogMatcher {
  matcherId: string;
  familyId: string;
  offerId: string;
  label: string;
  explanation: string;
  hosts: string[];
  canonicalSourceHosts?: string[];
  pathExact?: string;
  pathPrefix?: string;
  requiredQueryKeys?: string[];
  requiredQueryValues?: Record<string, string>;
  linkShapeTags?: string[];
  custom?: Record<string, unknown>;
}

export interface ReferralCatalogPayload {
  version?: number;
  updatedAt?: string;
  families?: ReferralCatalogFamily[];
  offers?: ReferralCatalogOffer[];
  matchers?: ReferralCatalogMatcher[];
}

export interface ReferralCatalog {
  version: number;
  updatedAt?: string;
  families: ReferralCatalogFamily[];
  offers: ReferralCatalogOffer[];
  matchers: ReferralCatalogMatcher[];
}

export interface ReferralCatalogResolution {
  source: "explicit" | "matcher";
  family: ReferralCatalogFamily;
  offer: ReferralCatalogOffer;
  matcher?: ReferralCatalogMatcher;
  referral: LinkReferralConfig;
}

interface ReferralCatalogIndexes {
  familiesById: Map<string, ReferralCatalogFamily>;
  offersById: Map<string, ReferralCatalogOffer>;
  matchersById: Map<string, ReferralCatalogMatcher>;
}

interface ReferralCatalogMatcherCandidate {
  matcher: ReferralCatalogMatcher;
  family: ReferralCatalogFamily;
  offer: ReferralCatalogOffer;
  specificity: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeHosts = (hosts: string[] | undefined): string[] | undefined => {
  if (!Array.isArray(hosts)) {
    return undefined;
  }

  const normalized = hosts
    .map((host) => trimToUndefined(host)?.toLowerCase())
    .filter((host): host is string => host !== undefined);

  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
};

const normalizeQueryValueMap = (
  value: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, string> = {};

  for (const [key, candidate] of Object.entries(value)) {
    const normalizedKey = trimToUndefined(key);
    const normalizedValue = trimToUndefined(candidate);
    if (!normalizedKey || !normalizedValue) {
      continue;
    }
    normalized[normalizedKey] = normalizedValue;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeStringArray = (value: string[] | undefined): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => trimToUndefined(entry))
    .filter((entry): entry is string => entry !== undefined);

  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
};

const normalizeFamily = (family: ReferralCatalogFamily): ReferralCatalogFamily => ({
  ...family,
  canonicalHosts: normalizeHosts(family.canonicalHosts),
});

const normalizeOffer = (offer: ReferralCatalogOffer): ReferralCatalogOffer => ({
  ...offer,
  label: trimToUndefined(offer.label) ?? offer.label,
});

const normalizeMatcher = (matcher: ReferralCatalogMatcher): ReferralCatalogMatcher => ({
  ...matcher,
  hosts: normalizeHosts(matcher.hosts) ?? matcher.hosts,
  canonicalSourceHosts: normalizeHosts(matcher.canonicalSourceHosts),
  pathExact: trimToUndefined(matcher.pathExact),
  pathPrefix: trimToUndefined(matcher.pathPrefix),
  requiredQueryKeys: normalizeStringArray(matcher.requiredQueryKeys),
  requiredQueryValues: normalizeQueryValueMap(matcher.requiredQueryValues),
  linkShapeTags: normalizeStringArray(matcher.linkShapeTags),
});

const mergeCatalogEntriesById = <IdKey extends string, T extends Record<IdKey, unknown>>(
  sharedEntries: T[] | undefined,
  localEntries: T[] | undefined,
  idKey: IdKey,
): T[] => {
  const mergedById = new Map<string, T>();

  for (const entry of sharedEntries ?? []) {
    const id = trimToUndefined(entry[idKey]);
    if (!id) {
      continue;
    }
    mergedById.set(id, entry);
  }

  for (const entry of localEntries ?? []) {
    const id = trimToUndefined(entry[idKey]);
    if (!id) {
      continue;
    }
    mergedById.set(id, entry);
  }

  return [...mergedById.values()];
};

export const mergeReferralCatalogPayloads = (
  shared: ReferralCatalogPayload | undefined,
  local: ReferralCatalogPayload | undefined,
): ReferralCatalog => ({
  version: local?.version ?? shared?.version ?? 1,
  updatedAt: local?.updatedAt ?? shared?.updatedAt,
  families: mergeCatalogEntriesById(shared?.families, local?.families, "familyId").map(
    normalizeFamily,
  ),
  offers: mergeCatalogEntriesById(shared?.offers, local?.offers, "offerId").map(normalizeOffer),
  matchers: mergeCatalogEntriesById(shared?.matchers, local?.matchers, "matcherId").map(
    normalizeMatcher,
  ),
});

const buildReferralCatalogIndexes = (catalog: ReferralCatalog): ReferralCatalogIndexes => ({
  familiesById: new Map(catalog.families.map((family) => [family.familyId, family])),
  offersById: new Map(catalog.offers.map((offer) => [offer.offerId, offer])),
  matchersById: new Map(catalog.matchers.map((matcher) => [matcher.matcherId, matcher])),
});

const buildCatalogReferralSeed = (input: {
  family: ReferralCatalogFamily;
  offer: ReferralCatalogOffer;
  matcher?: ReferralCatalogMatcher;
}): LinkReferralConfig => {
  const referral: LinkReferralConfig = {
    catalogRef: {
      familyId: input.family.familyId,
      offerId: input.offer.offerId,
      matcherId: input.matcher?.matcherId,
    },
  };

  const kind = input.offer.kind ?? input.family.kind;
  if (kind) {
    referral.kind = kind;
  }

  const visitorBenefit = trimToUndefined(input.offer.visitorBenefit);
  if (visitorBenefit) {
    referral.visitorBenefit = visitorBenefit;
  }

  const ownerBenefit = trimToUndefined(input.offer.ownerBenefit);
  if (ownerBenefit) {
    referral.ownerBenefit = ownerBenefit;
  }

  const offerSummary = trimToUndefined(input.offer.offerSummary);
  if (offerSummary) {
    referral.offerSummary = offerSummary;
  }

  const termsSummary = trimToUndefined(input.offer.termsSummary);
  if (termsSummary) {
    referral.termsSummary = termsSummary;
  }

  const termsUrl = trimToUndefined(input.offer.termsUrl);
  if (termsUrl) {
    referral.termsUrl = termsUrl;
  }

  const code = trimToUndefined(input.offer.code);
  if (code) {
    referral.code = code;
  }

  if (input.offer.custom) {
    referral.custom = input.offer.custom;
  }

  return referral;
};

const resolveOfferForFamily = (
  catalog: ReferralCatalog,
  familyId: string,
): ReferralCatalogOffer | undefined => {
  const offers = catalog.offers.filter((offer) => offer.familyId === familyId);
  return offers.length === 1 ? offers[0] : undefined;
};

export const resolveReferralCatalogRef = (
  catalog: ReferralCatalog,
  catalogRef: LinkReferralCatalogRef | undefined,
): ReferralCatalogResolution | undefined => {
  if (!catalogRef) {
    return undefined;
  }

  const indexes = buildReferralCatalogIndexes(catalog);
  const familyId = trimToUndefined(catalogRef.familyId);
  const offerId = trimToUndefined(catalogRef.offerId);
  const matcherId = trimToUndefined(catalogRef.matcherId);

  if (matcherId) {
    const matcher = indexes.matchersById.get(matcherId);
    if (!matcher) {
      return undefined;
    }
    if (familyId && matcher.familyId !== familyId) {
      return undefined;
    }
    if (offerId && matcher.offerId !== offerId) {
      return undefined;
    }

    const family = indexes.familiesById.get(matcher.familyId);
    const offer = indexes.offersById.get(matcher.offerId);
    if (!family || !offer || offer.familyId !== family.familyId) {
      return undefined;
    }

    return {
      source: "explicit",
      family,
      offer,
      matcher,
      referral: buildCatalogReferralSeed({ family, offer, matcher }),
    };
  }

  if (offerId) {
    const offer = indexes.offersById.get(offerId);
    if (!offer) {
      return undefined;
    }
    if (familyId && offer.familyId !== familyId) {
      return undefined;
    }

    const family = indexes.familiesById.get(offer.familyId);
    if (!family) {
      return undefined;
    }

    return {
      source: "explicit",
      family,
      offer,
      referral: buildCatalogReferralSeed({ family, offer }),
    };
  }

  if (!familyId) {
    return undefined;
  }

  const family = indexes.familiesById.get(familyId);
  const offer = family ? resolveOfferForFamily(catalog, family.familyId) : undefined;
  if (!family || !offer) {
    return undefined;
  }

  return {
    source: "explicit",
    family,
    offer,
    referral: buildCatalogReferralSeed({ family, offer }),
  };
};

const matcherHasSpecificConstraint = (matcher: ReferralCatalogMatcher): boolean =>
  Boolean(
    matcher.pathExact ||
      matcher.pathPrefix ||
      matcher.requiredQueryKeys?.length ||
      (matcher.requiredQueryValues && Object.keys(matcher.requiredQueryValues).length > 0),
  );

const getMatcherSpecificity = (matcher: ReferralCatalogMatcher): number =>
  (matcher.pathExact ? 100 : 0) +
  (matcher.pathPrefix ? 10 : 0) +
  Object.keys(matcher.requiredQueryValues ?? {}).length * 5 +
  (matcher.requiredQueryKeys?.length ?? 0);

const matchesReferralCatalogMatcher = (
  matcher: ReferralCatalogMatcher,
  parsedUrl: URL,
): boolean => {
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!matcher.hosts.includes(hostname)) {
    return false;
  }
  if (!matcherHasSpecificConstraint(matcher)) {
    return false;
  }
  if (matcher.pathExact && parsedUrl.pathname !== matcher.pathExact) {
    return false;
  }
  if (matcher.pathPrefix && !parsedUrl.pathname.startsWith(matcher.pathPrefix)) {
    return false;
  }

  for (const key of matcher.requiredQueryKeys ?? []) {
    const value = trimToUndefined(parsedUrl.searchParams.get(key));
    if (!value) {
      return false;
    }
  }

  for (const [key, value] of Object.entries(matcher.requiredQueryValues ?? {})) {
    if (parsedUrl.searchParams.get(key) !== value) {
      return false;
    }
  }

  return true;
};

const collectReferralCatalogMatcherCandidates = (
  catalog: ReferralCatalog,
  sourceUrl: string,
): ReferralCatalogMatcherCandidate[] => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return [];
  }

  const indexes = buildReferralCatalogIndexes(catalog);
  const candidates: ReferralCatalogMatcherCandidate[] = [];

  for (const matcher of catalog.matchers) {
    if (!matchesReferralCatalogMatcher(matcher, parsedUrl)) {
      continue;
    }

    const family = indexes.familiesById.get(matcher.familyId);
    const offer = indexes.offersById.get(matcher.offerId);
    if (!family || !offer || offer.familyId !== family.familyId) {
      continue;
    }

    candidates.push({
      matcher,
      family,
      offer,
      specificity: getMatcherSpecificity(matcher),
    });
  }

  return candidates;
};

export const resolveReferralCatalogMatcher = (
  catalog: ReferralCatalog,
  sourceUrl: string | undefined,
): ReferralCatalogResolution | undefined => {
  const normalizedUrl = trimToUndefined(sourceUrl);
  if (!normalizedUrl) {
    return undefined;
  }

  const candidates = collectReferralCatalogMatcherCandidates(catalog, normalizedUrl);
  if (candidates.length === 0) {
    return undefined;
  }

  const highestSpecificity = Math.max(...candidates.map((candidate) => candidate.specificity));
  const strongestCandidates = candidates.filter(
    (candidate) => candidate.specificity === highestSpecificity,
  );

  if (strongestCandidates.length !== 1) {
    return undefined;
  }

  const strongest = strongestCandidates[0];
  return {
    source: "matcher",
    family: strongest.family,
    offer: strongest.offer,
    matcher: strongest.matcher,
    referral: buildCatalogReferralSeed({
      family: strongest.family,
      offer: strongest.offer,
      matcher: strongest.matcher,
    }),
  };
};

export const resolveReferralCatalogForLink = (input: {
  catalog: ReferralCatalog;
  sourceUrl?: string;
  referral?: LinkReferralConfig;
}): ReferralCatalogResolution | undefined => {
  const explicitCatalogRef = input.referral?.catalogRef;
  if (explicitCatalogRef) {
    return resolveReferralCatalogRef(input.catalog, explicitCatalogRef);
  }

  return resolveReferralCatalogMatcher(input.catalog, input.sourceUrl);
};

const readJsonModules = <T>(pattern: string): Record<string, { default: T }> => {
  const maybeGlob = (
    import.meta as ImportMeta & {
      glob?: (pattern: string, options: { eager: true }) => Record<string, { default: T }>;
    }
  ).glob;

  if (typeof maybeGlob !== "function") {
    return {};
  }

  return maybeGlob(pattern, { eager: true });
};

export const loadReferralCatalog = (): ReferralCatalog => {
  const sharedPayload = Object.values(
    readJsonModules<ReferralCatalogPayload>("../../../data/policy/referral-catalog.json"),
  )[0]?.default;
  const localPayload = Object.values(
    readJsonModules<ReferralCatalogPayload>("../../../data/policy/referral-catalog.local.json"),
  )[0]?.default;
  return mergeReferralCatalogPayloads(sharedPayload, localPayload);
};
