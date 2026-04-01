import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createEnrichmentReport, readEnrichmentReport, writeEnrichmentReport } from "./report";

test("createEnrichmentReport preserves referral completeness and provenance on entries", () => {
  const report = createEnrichmentReport({
    generatedAt: "2026-03-30T00:00:00.000Z",
    strict: true,
    entries: [
      {
        linkId: "cluborange-referral",
        url: "https://signup.cluborange.org/co/pryszkie",
        status: "fetched",
        reason: "metadata_complete",
        attempts: 1,
        durationMs: 120,
        message: "Referral metadata fetched.",
        remediation: "None.",
        referralCompleteness: "full",
        referral: {
          catalog: {
            source: "explicit",
            familyId: "club-orange",
            familyLabel: "Club Orange",
            offerId: "club-orange-signup",
            offerLabel: "Club Orange signup referral",
            matcherId: "club-orange-signup-co-path",
            matcherLabel: "Hosted signup path code",
            matcherExplanation:
              "Club Orange hosted signup links encode the referral token in the /co/<code> path.",
            canonicalProgramUrl: "https://www.cluborange.org/signup",
          },
          catalogRef: {
            familyId: "club-orange",
            offerId: "club-orange-signup",
            matcherId: "club-orange-signup-co-path",
          },
          kind: "referral",
          visitorBenefit: "Get a Club Orange membership starting at $40/year or pay in sats.",
          ownerBenefit: "Supports the project",
          offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
          termsSummary: "Get a Club Orange membership starting at $40/year or pay in sats.",
          termsUrl: "https://www.cluborange.org/signup",
          originalUrl: "https://signup.cluborange.org/co/pryszkie",
          resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
          strategyId: "cluborange-referral-signup",
          termsSourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
          provenance: {
            kind: "catalog",
            visitorBenefit: "generated",
            ownerBenefit: "catalog",
            offerSummary: "generated",
            termsSummary: "generated",
            termsUrl: "catalog",
          },
        },
      },
    ],
  });

  assert.equal(report.entries[0]?.referralCompleteness, "full");
  assert.equal(report.entries[0]?.referral?.strategyId, "cluborange-referral-signup");
  assert.equal(report.entries[0]?.referral?.catalogRef?.offerId, "club-orange-signup");
  assert.equal(
    report.entries[0]?.referral?.visitorBenefit,
    "Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.equal(report.entries[0]?.referral?.ownerBenefit, "Supports the project");
});

test("readEnrichmentReport restores generated referral benefit fields from disk", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openlinks-report-"));
  const reportPath = path.join(tempDir, "report.json");
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  writeEnrichmentReport({
    reportPath,
    generatedAt: "2026-03-30T00:00:00.000Z",
    strict: true,
    entries: [
      {
        linkId: "cluborange-referral",
        url: "https://signup.cluborange.org/co/pryszkie",
        status: "partial",
        reason: "metadata_partial",
        attempts: 1,
        durationMs: 120,
        message: "Referral metadata partially fetched.",
        remediation: "None.",
        referralCompleteness: "partial",
        referral: {
          catalog: {
            source: "matcher",
            familyId: "club-orange",
            familyLabel: "Club Orange",
            offerId: "club-orange-signup",
            offerLabel: "Club Orange signup referral",
            matcherId: "club-orange-signup-query-referral",
            matcherLabel: "Canonical signup referral query",
            matcherExplanation:
              "The canonical Club Orange signup page uses the referral query parameter to carry the token.",
            canonicalProgramUrl: "https://www.cluborange.org/signup",
          },
          catalogRef: {
            familyId: "club-orange",
            offerId: "club-orange-signup",
            matcherId: "club-orange-signup-query-referral",
          },
          kind: "referral",
          ownerBenefit: "Supports the project",
          visitorBenefit: "Get $20 off your first year",
          offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
          termsUrl: "https://www.cluborange.org/signup",
          originalUrl: "https://signup.cluborange.org/co/pryszkie",
          resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
          strategyId: "cluborange-referral-signup",
        },
      },
    ],
  });

  const report = readEnrichmentReport(reportPath);

  assert.equal(report?.entries[0]?.referralCompleteness, "partial");
  assert.deepEqual(report?.entries[0]?.referral, {
    catalog: {
      source: "matcher",
      familyId: "club-orange",
      familyLabel: "Club Orange",
      offerId: "club-orange-signup",
      offerLabel: "Club Orange signup referral",
      matcherId: "club-orange-signup-query-referral",
      matcherLabel: "Canonical signup referral query",
      matcherExplanation:
        "The canonical Club Orange signup page uses the referral query parameter to carry the token.",
      canonicalProgramUrl: "https://www.cluborange.org/signup",
    },
    catalogRef: {
      familyId: "club-orange",
      offerId: "club-orange-signup",
      matcherId: "club-orange-signup-query-referral",
    },
    kind: "referral",
    ownerBenefit: "Supports the project",
    visitorBenefit: "Get $20 off your first year",
    offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
    termsUrl: "https://www.cluborange.org/signup",
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
  });
});

test("readEnrichmentReport keeps none completeness explicit without inventing unresolved benefit fields", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openlinks-report-none-"));
  const reportPath = path.join(tempDir, "report.json");
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  writeEnrichmentReport({
    reportPath,
    generatedAt: "2026-03-30T00:00:00.000Z",
    strict: true,
    entries: [
      {
        linkId: "starter-deal",
        url: "https://example.com/deal",
        status: "partial",
        reason: "metadata_partial",
        attempts: 1,
        durationMs: 90,
        message: "Referral extraction omitted terms because the page was ambiguous.",
        remediation: "None.",
        referralCompleteness: "none",
        referral: {
          kind: "promo",
          completeness: "none",
          originalUrl: "https://example.com/deal",
          resolvedUrl: "https://example.com/deal",
          strategyId: "public-direct-html",
        },
      },
    ],
  });

  const report = readEnrichmentReport(reportPath);

  assert.equal(report?.entries[0]?.referralCompleteness, "none");
  assert.deepEqual(report?.entries[0]?.referral, {
    kind: "promo",
    completeness: "none",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
  assert.equal(report?.entries[0]?.referral?.visitorBenefit, undefined);
  assert.equal(report?.entries[0]?.referral?.ownerBenefit, undefined);
});
