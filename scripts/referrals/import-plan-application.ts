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

import type {
  AppliedReferralImportPlan,
  ApplyReferralImportPlanInput,
  LinksFilePayload,
} from "./import-candidate";
import { EMPTY_LOCAL_REFERRAL_CATALOG, canonicalizeHttpUrl } from "./import-candidate";
import { buildExistingLinkByUrl, upsertCatalogEntry } from "./import-catalog-planning";
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
