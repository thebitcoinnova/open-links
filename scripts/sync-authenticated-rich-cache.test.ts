import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthenticatedSyncCandidates } from "./sync-authenticated-rich-cache";

test("resolveAuthenticatedSyncCandidates skips enrichment-disabled links by default", () => {
  // Arrange
  const candidates = resolveAuthenticatedSyncCandidates(
    [
      {
        id: "linkedin",
        label: "LinkedIn",
        url: "https://www.linkedin.com/in/example/",
        type: "rich",
        enrichment: {
          enabled: true,
          authenticatedExtractor: "linkedin-auth-browser",
        },
      },
      {
        id: "bright-builds-facebook",
        label: "Bright Builds LLC",
        url: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
        type: "rich",
        enrichment: {
          enabled: false,
          authenticatedExtractor: "facebook-auth-browser",
        },
      },
      {
        id: "facebook",
        label: "Facebook",
        url: "https://www.facebook.com/example",
        type: "rich",
        enrichment: {
          enabled: true,
          authenticatedExtractor: "facebook-auth-browser",
        },
      },
    ],
    {
      includeDisabled: false,
    },
  );

  // Assert
  assert.deepEqual(
    candidates.map((candidate) => candidate.link.id),
    ["linkedin", "facebook"],
  );
});

test("resolveAuthenticatedSyncCandidates includes enrichment-disabled links when includeDisabled is set", () => {
  // Arrange
  const candidates = resolveAuthenticatedSyncCandidates(
    [
      {
        id: "bright-builds-facebook",
        label: "Bright Builds LLC",
        url: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
        type: "rich",
        enrichment: {
          enabled: false,
          authenticatedExtractor: "facebook-auth-browser",
        },
      },
      {
        id: "disabled-link",
        label: "Disabled top-level link",
        url: "https://www.linkedin.com/in/disabled/",
        type: "rich",
        enabled: false,
        enrichment: {
          enabled: true,
          authenticatedExtractor: "linkedin-auth-browser",
        },
      },
    ],
    {
      includeDisabled: true,
    },
  );

  // Assert
  assert.deepEqual(
    candidates.map((candidate) => candidate.link.id),
    ["bright-builds-facebook", "disabled-link"],
  );
});
