import assert from "node:assert/strict";
import test from "node:test";
import siteData from "../../data/site.json";
import {
  mergeReferralCatalogPayloads,
  resolveReferralCatalogForLink,
} from "../../src/lib/content/referral-catalog";
import type { ReferralCatalogPayload } from "../../src/lib/content/referral-catalog";
import { mergeReferralWithManualOverrides } from "../../src/lib/content/referral-fields";
import { buildRichCardViewModel } from "../../src/lib/ui/rich-card-policy";
import {
  applyReferralImportPlan,
  buildReferralImportPlan,
  generateReferralLinkId,
  normalizeReferralInboxCandidate,
} from "./import-planner";

const sharedCatalog: ReferralCatalogPayload = {
  version: 1,
  updatedAt: "2026-03-31T10:00:00.000Z",
  families: [
    {
      familyId: "club-orange",
      label: "Club Orange",
      kind: "referral",
      description: "Club Orange membership and community referral program.",
      canonicalProgramUrl: "https://www.cluborange.org/signup",
      canonicalHosts: ["cluborange.org", "signup.cluborange.org", "www.cluborange.org"],
    },
  ],
  offers: [
    {
      offerId: "club-orange-signup",
      familyId: "club-orange",
      label: "Club Orange signup referral",
      kind: "referral",
      ownerBenefit: "Supports the project",
      offerSummary: "Join Club Orange through a referral-aware signup link.",
      termsSummary: "See the current Club Orange signup page for the latest referral terms.",
      termsUrl: "https://www.cluborange.org/signup",
    },
  ],
  matchers: [
    {
      matcherId: "club-orange-signup-co-path",
      familyId: "club-orange",
      offerId: "club-orange-signup",
      label: "Hosted signup path code",
      explanation:
        "Club Orange hosted signup links encode the referral token in the /co/<code> path.",
      hosts: ["signup.cluborange.org"],
      pathPrefix: "/co/",
      linkShapeTags: ["signup", "path-code"],
    },
    {
      matcherId: "club-orange-signup-query-referral",
      familyId: "club-orange",
      offerId: "club-orange-signup",
      label: "Canonical signup referral query",
      explanation: "The canonical Club Orange signup page uses the referral query parameter.",
      hosts: ["cluborange.org", "www.cluborange.org"],
      pathExact: "/signup",
      requiredQueryKeys: ["referral"],
      linkShapeTags: ["signup", "query-code"],
    },
  ],
};

test("normalizeReferralInboxCandidate trims values, canonicalizes URL, and extracts query codes", () => {
  const usedCandidateIds = new Set<string>();
  const candidate = normalizeReferralInboxCandidate(
    {
      candidateId: " Club Orange Invite ",
      url: "https://www.cluborange.org/signup?b=2&referral=pryszkie&a=1#fragment",
      labelHint: " Join Club Orange ",
      source: {
        subject: " Use my referral link ",
      },
    },
    { usedCandidateIds },
  );

  assert.equal(candidate.candidateId, "club-orange-invite");
  assert.equal(
    candidate.canonicalUrl,
    "https://www.cluborange.org/signup?a=1&b=2&referral=pryszkie",
  );
  assert.equal(candidate.extractedCode, "pryszkie");
  assert.equal(candidate.labelHint, "Join Club Orange");
  assert.equal(candidate.source?.subject, "Use my referral link");
});

test("buildReferralImportPlan matches existing catalog entries and keeps imported rich links on the non-profile referral path", () => {
  const plan = buildReferralImportPlan({
    candidates: [
      {
        url: "https://signup.cluborange.org/co/pryszkie",
        labelHint: "Join Club Orange",
      },
    ],
    linksPayload: { links: [] },
    sharedCatalogPayload: sharedCatalog,
  });

  assert.equal(plan.items.length, 1);
  const item = plan.items[0];
  assert.equal(item.disposition, "match_existing_catalog");
  assert.equal(item.catalogMatch?.matcherId, "club-orange-signup-co-path");
  assert.equal(item.proposedLink?.referral.catalogRef?.offerId, "club-orange-signup");
  assert.equal(item.proposedLink?.enrichment.profileSemantics, "non_profile");

  const catalog = mergeReferralCatalogPayloads(sharedCatalog, undefined);
  const catalogResolution = resolveReferralCatalogForLink({
    catalog,
    sourceUrl: item.proposedLink?.url,
    referral: item.proposedLink?.referral,
  });
  const resolvedLink = {
    ...item.proposedLink,
    referral: mergeReferralWithManualOverrides(
      item.proposedLink?.referral,
      undefined,
      catalogResolution?.referral,
    ),
  };
  const viewModel = buildRichCardViewModel(
    siteData as unknown as Parameters<typeof buildRichCardViewModel>[0],
    resolvedLink as Parameters<typeof buildRichCardViewModel>[1],
  );
  assert.ok(viewModel.referral);
  assert.equal(viewModel.socialProfile.usesProfileLayout, false);
  assert.equal(viewModel.description, "Join Club Orange through a referral-aware signup link.");
});

test("buildReferralImportPlan skips duplicates and links that already exist in data/links.json", () => {
  const plan = buildReferralImportPlan({
    candidates: [
      {
        candidateId: "existing",
        url: "https://example.com/signup?ref=alpha",
      },
      {
        candidateId: "first-new",
        url: "https://join.example.com/invite/beta",
      },
      {
        candidateId: "duplicate-new",
        url: "https://join.example.com/invite/beta",
      },
    ],
    linksPayload: {
      links: [{ id: "existing-link", url: "https://example.com/signup?ref=alpha" }],
    },
  });

  assert.equal(plan.items[0].disposition, "skip");
  assert.match(plan.items[0].skipReason ?? "", /already_exists:existing-link/u);
  assert.equal(plan.items[1].disposition, "link_only");
  assert.equal(plan.items[2].disposition, "skip");
  assert.match(plan.items[2].skipReason ?? "", /duplicate_of:first-new/u);
});

test("buildReferralImportPlan creates fork-local catalog additions when scope hint is local", () => {
  const plan = buildReferralImportPlan({
    candidates: [
      {
        url: "https://rewards.example.com/signup?ref=code123",
        familyLabelHint: "Acme Rewards",
        catalogScopeHint: "local",
      },
    ],
    linksPayload: { links: [] },
  });

  const item = plan.items[0];
  assert.equal(item.disposition, "create_local_catalog");
  assert.equal(item.plannedCatalogRef?.familyId, "acme-rewards");
  assert.equal(
    item.localCatalogAddition?.family?.canonicalProgramUrl,
    "https://rewards.example.com/signup",
  );
  assert.deepEqual(item.localCatalogAddition?.matcher?.requiredQueryKeys, ["ref"]);
  assert.equal(
    item.proposedLink?.referral.catalogRef?.matcherId,
    "acme-rewards-signup-query-referral",
  );
});

test("buildReferralImportPlan creates shared catalog proposals without blocking the local link proposal", () => {
  const plan = buildReferralImportPlan({
    candidates: [
      {
        url: "https://widget.example.com/invite/ABC123",
        familyLabelHint: "Widget",
        catalogScopeHint: "shared",
      },
    ],
    linksPayload: { links: [] },
  });

  const item = plan.items[0];
  assert.equal(item.disposition, "propose_shared_catalog");
  assert.ok(item.sharedCatalogProposal?.matcher);
  assert.equal(item.proposedLink?.referral.catalogRef, undefined);
  assert.match(item.upstreamWorthyNote ?? "", /clean upstream PR/u);
});

test("generateReferralLinkId adds numeric suffixes when ids collide", () => {
  const candidate = normalizeReferralInboxCandidate({
    url: "https://signup.cluborange.org/co/pryszkie",
  });
  const usedIds = new Set<string>(["ref-club-orange-pryszkie"]);

  const generated = generateReferralLinkId({
    candidate,
    familySlug: "club-orange",
    usedIds,
  });

  assert.equal(generated, "ref-club-orange-pryszkie-2");
});

test("applyReferralImportPlan appends planned links and writes local overlay additions", () => {
  const plan = buildReferralImportPlan({
    candidates: [
      {
        candidateId: "acme-local",
        url: "https://rewards.example.com/signup?ref=code123",
        familyLabelHint: "Acme Rewards",
        catalogScopeHint: "local",
      },
    ],
    linksPayload: { links: [] },
  });

  const result = applyReferralImportPlan({
    plan,
    linksPayload: { links: [] },
    selectedCandidateIds: ["acme-local"],
  });

  assert.deepEqual(result.appliedCandidateIds, ["acme-local"]);
  assert.equal(result.linksPayload.links?.length, 1);
  assert.equal(result.localCatalogPayload.families?.length, 1);
  assert.equal(result.localCatalogPayload.offers?.length, 1);
  assert.equal(result.localCatalogPayload.matchers?.length, 1);
  assert.equal(result.linksPayload.links?.[0]?.id, "ref-acme-rewards-code123");
});
