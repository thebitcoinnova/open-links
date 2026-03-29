import assert from "node:assert/strict";
import test from "node:test";
import { runPolicyRules } from "./rules";

const profile = {};
const site = {};

test("custom QR badge mode requires at least one badge item", () => {
  // Act
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "cluborange-lightning-tips",
          label: "Club Orange Tips",
          type: "payment",
          payment: {
            rails: [
              {
                id: "lightning",
                rail: "lightning",
                address: "peterryszkiewicz@cluborange.org",
                qr: {
                  badge: {
                    mode: "custom",
                  },
                },
              },
            ],
          },
        },
      ],
    },
    site,
  });

  // Assert
  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "$.links[0].payment.rails[0].qr.badge.items" &&
        issue.message === "QR badge mode 'custom' requires at least one badge item.",
    ),
  );
});

test("QR badge validation rejects more than two custom badge items", () => {
  // Act
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "cluborange-lightning-tips",
          label: "Club Orange Tips",
          type: "payment",
          payment: {
            rails: [
              {
                id: "lightning",
                rail: "lightning",
                address: "peterryszkiewicz@cluborange.org",
                qr: {
                  badge: {
                    mode: "custom",
                    items: [
                      { type: "rail" },
                      { type: "site", value: "cluborange" },
                      { type: "site", value: "bitcoin" },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    },
    site,
  });

  // Assert
  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "$.links[0].payment.rails[0].qr.badge.items" &&
        issue.message === "QR badge supports at most 2 items, received 3.",
    ),
  );
});

test("supported-family links still emit handle coverage warnings in auto mode", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "cluborange-referral",
          label: "Join Club Orange",
          url: "https://signup.cluborange.org/co/pryszkie",
          type: "rich",
          icon: "cluborange",
          enabled: true,
          enrichment: {
            enabled: true,
          },
        },
      ],
    },
    site,
  });

  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "$.links[0].metadata.handle" &&
        issue.message.includes("Handle extraction warning for link 'cluborange-referral'"),
    ),
  );
});

test("referral markers warn when no meaningful disclosure fields are present", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "starter-deal",
          label: "Starter Deal",
          url: "https://example.com/deal",
          type: "simple",
          enabled: true,
          referral: {},
        },
      ],
    },
    site,
  });

  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "$.links[0].referral" &&
        issue.message.includes("Referral disclosure warning for link 'starter-deal'"),
    ),
  );
});

test("one-sided referral disclosures do not warn just because the other side is absent", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "starter-deal",
          label: "Starter Deal",
          url: "https://example.com/deal",
          type: "simple",
          enabled: true,
          referral: {
            ownerBenefit: "Supports the project",
          },
        },
      ],
    },
    site,
  });

  assert.equal(
    issues.some((issue) => issue.path === "$.links[0].referral"),
    false,
  );
});

test("non-profile rich links suppress supported-family handle coverage warnings", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "cluborange-referral",
          label: "Join Club Orange",
          url: "https://signup.cluborange.org/co/pryszkie",
          type: "rich",
          icon: "cluborange",
          enabled: true,
          enrichment: {
            enabled: true,
            profileSemantics: "non_profile",
          },
        },
      ],
    },
    site,
  });

  assert.equal(
    issues.some((issue) => issue.path === "$.links[0].metadata.handle"),
    false,
  );
});

test("supported profile-family referral links warn unless profile semantics is explicitly non_profile", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "cluborange-referral",
          label: "Join Club Orange",
          url: "https://app.cluborange.org/pryszkie",
          type: "rich",
          icon: "cluborange",
          enabled: true,
          referral: {
            kind: "referral",
            ownerBenefit: "Supports the project",
          },
        },
      ],
    },
    site,
  });

  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "$.links[0].enrichment.profileSemantics" &&
        issue.message.includes("Referral semantics warning for link 'cluborange-referral'"),
    ),
  );
});

test("supported profile-family referral links do not warn when non_profile is set", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "cluborange-referral",
          label: "Join Club Orange",
          url: "https://app.cluborange.org/pryszkie",
          type: "rich",
          icon: "cluborange",
          enabled: true,
          enrichment: {
            profileSemantics: "non_profile",
          },
          referral: {
            kind: "referral",
            ownerBenefit: "Supports the project",
          },
        },
      ],
    },
    site,
  });

  assert.equal(
    issues.some((issue) => issue.path === "$.links[0].enrichment.profileSemantics"),
    false,
  );
});

test("explicit profile semantics warn when no supported profile can be resolved", () => {
  const issues = runPolicyRules({
    profile,
    links: {
      links: [
        {
          id: "homepage",
          label: "Homepage",
          url: "https://openlinks.us",
          type: "rich",
          icon: "github",
          enabled: true,
          enrichment: {
            enabled: true,
            profileSemantics: "profile",
          },
        },
      ],
    },
    site,
  });

  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "$.links[0].enrichment.profileSemantics" &&
        issue.message.includes("Profile semantics warning for link 'homepage'"),
    ),
  );
});
