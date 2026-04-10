import type {
  ReferralCatalogFamily,
  ReferralCatalogMatcher,
  ReferralCatalogOffer,
} from "../../src/lib/content/referral-catalog";
import type {
  LinkReferralCatalogRef,
  LinkReferralConfig,
  ReferralKind,
} from "../../src/lib/content/referral-fields";
import type { LinkProfileSemantics } from "../../src/lib/content/social-profile-fields";

export const DEFAULT_REFERRAL_IMPORT_INPUT_PATH =
  ".cache/referral-management/inbox-candidates.json";
export const DEFAULT_REFERRAL_IMPORT_RESOLVED_PATH =
  ".cache/referral-management/inbox-candidates.resolved.json";
export const DEFAULT_REFERRAL_IMPORT_PLAN_PATH =
  ".cache/referral-management/referral-import-plan.json";
export const DEFAULT_REFERRAL_IMPORT_RESOLVE_REPORT_PATH =
  ".cache/referral-management/referral-resolve-report.json";
export const DEFAULT_LINKS_PATH = "data/links.json";
export const DEFAULT_SHARED_REFERRAL_CATALOG_PATH = "data/policy/referral-catalog.json";
export const DEFAULT_LOCAL_REFERRAL_CATALOG_PATH = "data/policy/referral-catalog.local.json";

export type ReferralImportCatalogScopeHint = "local" | "shared";
export type ReferralImportResolutionStatus = "resolved_clear" | "review_required" | "unresolved";
export type ReferralTermsPolicyStatus =
  | "public_forbidden"
  | "public_allowed"
  | "ambiguous"
  | "not_found";
export type ReferralImportDisposition =
  | "match_existing_catalog"
  | "create_local_catalog"
  | "propose_shared_catalog"
  | "link_only"
  | "skip";

export interface ReferralTermsPolicyResult {
  status: ReferralTermsPolicyStatus;
  normalizedSourceUrl: string;
  checkedUrl?: string;
  matchedRuleId?: string;
  evidenceSnippet?: string;
  reason?: string;
}

export interface ReferralInboxCandidateSource {
  provider?: string;
  accountLabel?: string;
  messageId?: string;
  threadId?: string;
  from?: string;
  subject?: string;
  receivedAt?: string;
  searchQuery?: string;
}

export interface ReferralImportCandidateResolution {
  status: ReferralImportResolutionStatus;
  originalUrl: string;
  recommendedUrl?: string;
  resolvedUrl?: string;
  reason?: string;
  reviewReason?: string;
  terminalStatusCode?: number;
  terminalTitle?: string;
}

export interface ReferralInboxCandidateInput {
  candidateId?: string;
  source?: ReferralInboxCandidateSource;
  url?: string;
  approvedUrl?: string;
  resolution?: ReferralImportCandidateResolution;
  confidence?: number;
  kindHint?: ReferralKind;
  catalogScopeHint?: ReferralImportCatalogScopeHint;
  profileSemanticsHint?: LinkProfileSemantics;
  labelHint?: string;
  descriptionHint?: string;
  groupHint?: string;
  iconHint?: string;
  familyLabelHint?: string;
  offerLabelHint?: string;
  visitorBenefitHint?: string;
  ownerBenefitHint?: string;
  offerSummaryHint?: string;
  termsSummaryHint?: string;
  termsUrlHint?: string;
  termsPolicy?: ReferralTermsPolicyResult;
  notes?: string;
}

export interface ReferralImportRedirectHop {
  requestUrl: string;
  statusCode?: number;
  locationUrl?: string;
  contentType?: string;
  title?: string;
  error?: string;
}

export interface ReferralImportPlausibleUrl {
  url: string;
  sourceUrl: string;
  pattern: string;
  score: number;
  hopIndex: number;
  knownFamilyId?: string;
}

export interface ReferralImportResolveReportItem {
  candidateId: string;
  originalUrl?: string;
  approvedUrl?: string;
  resolution?: ReferralImportCandidateResolution;
  termsPolicy?: ReferralTermsPolicyResult;
  hops: ReferralImportRedirectHop[];
  plausibleUrls: ReferralImportPlausibleUrl[];
}

export interface ReferralImportResolveReport {
  version: 1;
  generatedAt: string;
  inputPath: string;
  outputPath: string;
  items: ReferralImportResolveReportItem[];
}

export interface NormalizedReferralInboxCandidate {
  candidateId: string;
  source?: ReferralInboxCandidateSource;
  url: string;
  canonicalUrl: string;
  host: string;
  confidence: number;
  kind: ReferralKind;
  catalogScopeHint?: ReferralImportCatalogScopeHint;
  profileSemanticsHint?: LinkProfileSemantics;
  labelHint?: string;
  descriptionHint?: string;
  groupHint?: string;
  iconHint?: string;
  familyLabelHint?: string;
  offerLabelHint?: string;
  visitorBenefitHint?: string;
  ownerBenefitHint?: string;
  offerSummaryHint?: string;
  termsSummaryHint?: string;
  termsUrlHint?: string;
  termsPolicy?: ReferralTermsPolicyResult;
  notes?: string;
  extractedCode?: string;
  dedupeKey: string;
}

export interface ReferralCatalogMatchSummary {
  source: "explicit" | "matcher";
  familyId: string;
  offerId: string;
  matcherId?: string;
}

export interface PlannedReferralLink {
  id: string;
  label: string;
  url: string;
  type: "rich";
  icon: string;
  description: string;
  enabled: true;
  group?: string;
  referral: LinkReferralConfig;
  enrichment: {
    enabled: true;
    profileSemantics?: LinkProfileSemantics;
  };
}

export interface ReferralCatalogAddition {
  family?: ReferralCatalogFamily;
  offer?: ReferralCatalogOffer;
  matcher?: ReferralCatalogMatcher;
}

export interface ReferralImportPlanItem {
  candidateId: string;
  disposition: ReferralImportDisposition;
  actionable: boolean;
  applyByDefault: boolean;
  confidence: number;
  domain?: string;
  url?: string;
  extractedCode?: string;
  dedupeKey?: string;
  termsPolicy?: ReferralTermsPolicyResult;
  catalogMatch?: ReferralCatalogMatchSummary;
  plannedCatalogRef?: LinkReferralCatalogRef;
  proposedLink?: PlannedReferralLink;
  localCatalogAddition?: ReferralCatalogAddition;
  sharedCatalogProposal?: ReferralCatalogAddition;
  upstreamWorthyNote?: string;
  skipReason?: string;
}

export interface ReferralImportPlan {
  version: 1;
  generatedAt: string;
  inputPath: string;
  linksPath: string;
  sharedCatalogPath: string;
  localCatalogPath: string;
  items: ReferralImportPlanItem[];
}
