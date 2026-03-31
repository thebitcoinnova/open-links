export const REFERRAL_KIND_VALUES = ["referral", "affiliate", "promo", "invite"] as const;

export type ReferralKind = (typeof REFERRAL_KIND_VALUES)[number];
export type ReferralFieldProvenance = "manual" | "catalog" | "generated";
export type ReferralCompleteness = "full" | "partial" | "none";
export const REFERRAL_COMPLETENESS_VALUES = ["full", "partial", "none"] as const;

export interface LinkReferralCatalogRef {
  familyId?: string;
  offerId?: string;
  matcherId?: string;
}

export interface LinkReferralConfig {
  kind?: ReferralKind;
  catalogRef?: LinkReferralCatalogRef;
  visitorBenefit?: string;
  ownerBenefit?: string;
  offerSummary?: string;
  termsSummary?: string;
  termsUrl?: string;
  code?: string;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export const REFERRAL_TEXT_FIELDS = [
  "visitorBenefit",
  "ownerBenefit",
  "offerSummary",
  "termsSummary",
  "termsUrl",
  "code",
] as const satisfies readonly (keyof LinkReferralConfig)[];
export type ReferralFieldName = "kind" | (typeof REFERRAL_TEXT_FIELDS)[number];
export type ReferralFieldProvenanceMap = Partial<
  Record<ReferralFieldName, ReferralFieldProvenance>
>;

export interface GeneratedLinkReferralConfig extends LinkReferralConfig {
  provenance?: ReferralFieldProvenanceMap;
  completeness?: ReferralCompleteness;
  originalUrl?: string;
  resolvedUrl?: string;
  strategyId?: string;
  termsSourceUrl?: string;
}

export interface ResolvedLinkReferralConfig extends LinkReferralConfig {
  provenance?: ReferralFieldProvenanceMap;
  completeness?: ReferralCompleteness;
  originalUrl?: string;
  resolvedUrl?: string;
  strategyId?: string;
  termsSourceUrl?: string;
}
const REFERRAL_TEXT_FIELD_SET = new Set<string>(REFERRAL_TEXT_FIELDS);
export const REFERRAL_PROVENANCE_FIELDS = ["kind", ...REFERRAL_TEXT_FIELDS] as const;
const REFERRAL_PROVENANCE_FIELD_SET = new Set<string>(REFERRAL_PROVENANCE_FIELDS);

export const REFERRAL_MEANINGFUL_FIELDS = [...REFERRAL_TEXT_FIELDS] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const isReferralKind = (value: unknown): value is ReferralKind =>
  typeof value === "string" && REFERRAL_KIND_VALUES.includes(value as ReferralKind);

export const isReferralCompleteness = (value: unknown): value is ReferralCompleteness =>
  typeof value === "string" && REFERRAL_COMPLETENESS_VALUES.includes(value as ReferralCompleteness);

export const normalizeReferralProvenance = (
  value: unknown,
): ReferralFieldProvenanceMap | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: ReferralFieldProvenanceMap = {};

  for (const [key, candidate] of Object.entries(value)) {
    if (!REFERRAL_PROVENANCE_FIELD_SET.has(key)) {
      continue;
    }

    if (candidate === "manual" || candidate === "catalog" || candidate === "generated") {
      normalized[key as ReferralFieldName] = candidate;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const normalizeReferralCatalogRef = (value: unknown): LinkReferralCatalogRef | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: LinkReferralCatalogRef = {};
  const familyId = trimToUndefined(value.familyId);
  const offerId = trimToUndefined(value.offerId);
  const matcherId = trimToUndefined(value.matcherId);

  if (familyId) {
    normalized.familyId = familyId;
  }

  if (offerId) {
    normalized.offerId = offerId;
  }

  if (matcherId) {
    normalized.matcherId = matcherId;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const normalizeReferralConfig = <T extends LinkReferralConfig>(
  referral: T | undefined,
): T | undefined => {
  if (!referral) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(referral)) {
    if (key === "kind") {
      if (isReferralKind(value)) {
        normalized.kind = value;
      }
      continue;
    }

    if (key === "catalogRef") {
      const catalogRef = normalizeReferralCatalogRef(value);
      if (catalogRef) {
        normalized.catalogRef = catalogRef;
      }
      continue;
    }

    if (REFERRAL_TEXT_FIELD_SET.has(key)) {
      const trimmed = trimToUndefined(value);
      if (trimmed !== undefined) {
        normalized[key] = trimmed;
      }
      continue;
    }

    if (key === "custom") {
      if (isRecord(value)) {
        normalized.custom = value;
      }
      continue;
    }

    if (key === "provenance") {
      const provenance = normalizeReferralProvenance(value);
      if (provenance) {
        normalized.provenance = provenance;
      }
      continue;
    }

    if (key === "completeness") {
      if (isReferralCompleteness(value)) {
        normalized.completeness = value;
      }
      continue;
    }

    if (
      key === "originalUrl" ||
      key === "resolvedUrl" ||
      key === "strategyId" ||
      key === "termsSourceUrl"
    ) {
      const normalizedValue = trimToUndefined(value);
      if (normalizedValue) {
        normalized[key] = normalizedValue;
      }
      continue;
    }

    normalized[key] = value;
  }

  return normalized as T;
};

export const hasMeaningfulReferralContent = (referral: LinkReferralConfig | undefined): boolean => {
  const normalized = normalizeReferralConfig(referral);
  if (!normalized) {
    return false;
  }

  return REFERRAL_MEANINGFUL_FIELDS.some(
    (field) => trimToUndefined(normalized[field]) !== undefined,
  );
};

export const mergeReferralWithManualOverrides = (
  manual: LinkReferralConfig | undefined,
  generated: GeneratedLinkReferralConfig | undefined,
  catalog?: LinkReferralConfig | undefined,
): ResolvedLinkReferralConfig | undefined => {
  if (!manual && !generated && !catalog) {
    return undefined;
  }

  const normalizedManual = normalizeReferralConfig(manual);
  const normalizedCatalog = normalizeReferralConfig(catalog);
  const normalizedGenerated = normalizeReferralConfig(generated);
  const catalogProvenance = normalizeReferralProvenance(normalizedCatalog?.provenance);
  const generatedProvenance = normalizeReferralProvenance(normalizedGenerated?.provenance);
  const { provenance: _manualProvenance, ...manualFields } = (normalizedManual ?? {}) as Record<
    string,
    unknown
  >;
  const { provenance: _catalogProvenance, ...catalogFields } = (normalizedCatalog ?? {}) as Record<
    string,
    unknown
  >;
  const { provenance: _generatedProvenance, ...generatedFields } = (normalizedGenerated ??
    {}) as Record<string, unknown>;
  const merged: ResolvedLinkReferralConfig = {
    ...generatedFields,
    ...catalogFields,
    ...manualFields,
  };
  const provenance: ReferralFieldProvenanceMap = {};

  for (const field of REFERRAL_PROVENANCE_FIELDS) {
    if (trimToUndefined(normalizedManual?.[field]) !== undefined) {
      provenance[field] = "manual";
      continue;
    }

    if (trimToUndefined(normalizedCatalog?.[field]) !== undefined) {
      provenance[field] = catalogProvenance?.[field] ?? "catalog";
      continue;
    }

    if (trimToUndefined(normalizedGenerated?.[field]) !== undefined) {
      provenance[field] = generatedProvenance?.[field] ?? "generated";
    }
  }

  if (Object.keys(provenance).length > 0) {
    merged.provenance = provenance;
  }

  return merged;
};

export const resolveReferralCompleteness = (
  referral: LinkReferralConfig | undefined,
): ReferralCompleteness => {
  const normalized = normalizeReferralConfig(referral);
  const hasOfferSummary = trimToUndefined(normalized?.offerSummary) !== undefined;
  const hasTermsSummary = trimToUndefined(normalized?.termsSummary) !== undefined;

  if (hasOfferSummary && hasTermsSummary) {
    return "full";
  }

  if (hasOfferSummary || hasTermsSummary) {
    return "partial";
  }

  return "none";
};
