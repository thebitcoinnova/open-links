import {
  type ReferralKind,
  type ResolvedLinkReferralConfig,
  normalizeReferralConfig,
} from "../content/referral-fields";

export interface ReferralBenefitRow {
  kind: "visitor" | "owner";
  label: "You get" | "Supports";
  value: string;
}

export interface ReferralTermsPresentation {
  inlineSummary?: string;
  isTruncated: boolean;
  linkLabel?: "Terms";
  url?: string;
}

export interface ReferralCardPresentation {
  kind?: ReferralKind;
  disclosureLabel: string;
  benefitRows: ReferralBenefitRow[];
  offerSummary?: string;
  terms?: ReferralTermsPresentation;
}

const REFERRAL_DISCLOSURE_LABELS: Record<ReferralKind, string> = {
  referral: "Referral",
  affiliate: "Affiliate",
  promo: "Promo",
  invite: "Invite",
};

const MAX_INLINE_TERMS_LENGTH = 120;

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const truncateTermsSummary = (
  termsSummary: string,
): Pick<ReferralTermsPresentation, "inlineSummary" | "isTruncated"> => {
  if (termsSummary.length <= MAX_INLINE_TERMS_LENGTH) {
    return {
      inlineSummary: termsSummary,
      isTruncated: false,
    };
  }

  const truncated = termsSummary.slice(0, MAX_INLINE_TERMS_LENGTH - 3);
  const maybeBoundaryIndex = truncated.lastIndexOf(" ");
  const preview =
    maybeBoundaryIndex >= Math.floor(MAX_INLINE_TERMS_LENGTH * 0.6)
      ? truncated.slice(0, maybeBoundaryIndex)
      : truncated;

  return {
    inlineSummary: `${preview.trimEnd()}...`,
    isTruncated: true,
  };
};

export const formatReferralDisclosureLabel = (maybeKind: ReferralKind | undefined): string =>
  maybeKind ? REFERRAL_DISCLOSURE_LABELS[maybeKind] : "Referral";

export const resolveReferralCardPresentation = (
  maybeReferral: ResolvedLinkReferralConfig | undefined,
): ReferralCardPresentation | undefined => {
  const referral = normalizeReferralConfig(maybeReferral);
  if (!referral) {
    return undefined;
  }

  const benefitRows: ReferralBenefitRow[] = [];
  const maybeVisitorBenefit = trimToUndefined(referral.visitorBenefit);
  const maybeOwnerBenefit = trimToUndefined(referral.ownerBenefit);
  const maybeOfferSummary = trimToUndefined(referral.offerSummary);
  const maybeTermsSummary = trimToUndefined(referral.termsSummary);
  const maybeTermsUrl = trimToUndefined(referral.termsUrl);

  if (maybeVisitorBenefit) {
    benefitRows.push({
      kind: "visitor",
      label: "You get",
      value: maybeVisitorBenefit,
    });
  }

  if (maybeOwnerBenefit) {
    benefitRows.push({
      kind: "owner",
      label: "Supports",
      value: maybeOwnerBenefit,
    });
  }

  const terms =
    maybeTermsSummary || maybeTermsUrl
      ? {
          ...(maybeTermsSummary ? truncateTermsSummary(maybeTermsSummary) : { isTruncated: false }),
          ...(maybeTermsUrl
            ? {
                linkLabel: "Terms" as const,
                url: maybeTermsUrl,
              }
            : {}),
        }
      : undefined;

  return {
    kind: referral.kind,
    disclosureLabel: formatReferralDisclosureLabel(referral.kind),
    benefitRows,
    offerSummary: maybeOfferSummary,
    terms,
  };
};
