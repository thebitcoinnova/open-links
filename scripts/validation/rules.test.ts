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
