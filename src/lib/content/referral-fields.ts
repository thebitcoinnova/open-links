export const REFERRAL_KIND_VALUES = ["referral", "affiliate", "promo", "invite"] as const;

export type ReferralKind = (typeof REFERRAL_KIND_VALUES)[number];

export interface LinkReferralConfig {
  kind?: ReferralKind;
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
const REFERRAL_TEXT_FIELD_SET = new Set<string>(REFERRAL_TEXT_FIELDS);

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

export const mergeReferralWithManualOverrides = <T extends LinkReferralConfig>(
  manual: T | undefined,
  generated: T | undefined,
): T | undefined => {
  if (!manual && !generated) {
    return undefined;
  }

  const normalizedManual = normalizeReferralConfig(manual);
  const normalizedGenerated = normalizeReferralConfig(generated);

  return {
    ...(normalizedGenerated ?? {}),
    ...(normalizedManual ?? {}),
  } as T;
};
