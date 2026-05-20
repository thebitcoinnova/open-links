import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_ANALYTICS_PAGE_VISIBILITY_OPTIONS,
  STUDIO_LINK_TYPE_OPTIONS,
  STUDIO_VCARD_PHOTO_OPTIONS,
  STUDIO_VCARD_PROFILE_URL_OPTIONS,
  STUDIO_VCARD_VISIBILITY_OPTIONS,
  type StudioSiteData,
  parseStudioVCardCustomUrlsDraft,
  parseStudioVCardLinkIdsDraft,
  resolveEditorLinkAccordionSummary,
  resolveEditorLinkAccordionValue,
  resolveStudioAnalyticsPageVisibilityValue,
  resolveStudioConfirmDialogCopy,
  resolveStudioThemeOptions,
  resolveStudioVCardCustomUrlsValue,
  resolveStudioVCardFieldValue,
  resolveStudioVCardLinkIdsValue,
  resolveStudioVCardPhotoValue,
  resolveStudioVCardProfileUrlValue,
  resolveStudioVCardVisibilityValue,
  updateStudioVCardCustomUrls,
  updateStudioVCardEnabled,
  updateStudioVCardField,
  updateStudioVCardLinkIds,
  updateStudioVCardPhoto,
  updateStudioVCardProfileUrl,
} from "./editor-options";

const baseSite = {
  title: "OpenLinks",
  description: "Links",
  theme: {
    active: "sleek",
    available: ["sleek", "daybreak"],
  },
} as const satisfies StudioSiteData;

test("studio link type options stay aligned with the supported link types", () => {
  assert.deepEqual(
    STUDIO_LINK_TYPE_OPTIONS.map((option) => option.value),
    ["simple", "rich", "payment"],
  );
});

test("studio analytics page visibility options stay in the expected order", () => {
  assert.deepEqual(
    STUDIO_ANALYTICS_PAGE_VISIBILITY_OPTIONS.map((option) => option.value),
    ["true", "false"],
  );
});

test("studio vCard options stay in the expected order", () => {
  assert.deepEqual(
    STUDIO_VCARD_VISIBILITY_OPTIONS.map((option) => option.value),
    ["false", "true"],
  );
  assert.deepEqual(
    STUDIO_VCARD_PROFILE_URL_OPTIONS.map((option) => option.value),
    ["true", "false"],
  );
  assert.deepEqual(
    STUDIO_VCARD_PHOTO_OPTIONS.map((option) => option.value),
    ["false", "true"],
  );
});

test("studio theme options come from normalized available themes", () => {
  const site = {
    title: "OpenLinks",
    description: "Links",
    theme: {
      active: "missing-theme",
      available: ["missing-theme"],
    },
  } as const satisfies StudioSiteData;

  assert.deepEqual(resolveStudioThemeOptions(site), [
    { value: "sleek", label: "sleek" },
    { value: "daybreak", label: "daybreak" },
  ]);
});

test("studio theme options keep valid configured themes", () => {
  const site = {
    title: "OpenLinks",
    description: "Links",
    theme: {
      active: "daybreak",
      available: ["daybreak", "sleek"],
    },
  } as const satisfies StudioSiteData;

  assert.deepEqual(resolveStudioThemeOptions(site), [
    { value: "daybreak", label: "daybreak" },
    { value: "sleek", label: "sleek" },
  ]);
});

test("studio analytics page visibility defaults to shown", () => {
  assert.equal(resolveStudioAnalyticsPageVisibilityValue(baseSite), "true");
});

test("studio analytics page visibility reads a disabled config", () => {
  const site = {
    ...baseSite,
    ui: {
      analytics: {
        pageEnabled: false,
      },
    },
  } as const satisfies StudioSiteData;

  assert.equal(resolveStudioAnalyticsPageVisibilityValue(site), "false");
});

test("studio vCard selectors read defaults and configured values", () => {
  // Arrange
  const site = {
    ...baseSite,
    sharing: {
      vcard: {
        enabled: true,
        fields: {
          email: "hello@example.com",
        },
        include: {
          customUrls: [{ label: "Calendar", url: "https://cal.example.com/peter" }],
          linkIds: ["github", "linkedin"],
          photo: true,
          profileUrl: false,
        },
      },
    },
  } as const satisfies StudioSiteData;

  // Assert
  assert.equal(resolveStudioVCardVisibilityValue(baseSite), "false");
  assert.equal(resolveStudioVCardProfileUrlValue(baseSite), "true");
  assert.equal(resolveStudioVCardPhotoValue(baseSite), "false");
  assert.equal(resolveStudioVCardVisibilityValue(site), "true");
  assert.equal(resolveStudioVCardProfileUrlValue(site), "false");
  assert.equal(resolveStudioVCardPhotoValue(site), "true");
  assert.equal(resolveStudioVCardFieldValue(site, "email"), "hello@example.com");
  assert.equal(resolveStudioVCardLinkIdsValue(site), "github, linkedin");
  assert.equal(resolveStudioVCardCustomUrlsValue(site), "Calendar | https://cal.example.com/peter");
});

test("studio vCard draft parsers normalize link ids and custom URLs", () => {
  // Assert
  assert.deepEqual(parseStudioVCardLinkIdsDraft("github, linkedin\ngithub"), [
    "github",
    "linkedin",
  ]);
  assert.deepEqual(
    parseStudioVCardCustomUrlsDraft("Calendar | https://cal.example.com\nhttps://example.com"),
    [{ label: "Calendar", url: "https://cal.example.com" }, { url: "https://example.com" }],
  );
});

test("studio vCard updates preserve unrelated site config", () => {
  // Arrange
  const site = {
    ...baseSite,
    quality: {
      seo: {
        canonicalBaseUrl: "https://openlinks.us/",
      },
    },
    sharing: {
      badge: {
        enabled: true,
      },
    },
  } as Record<string, unknown>;

  // Act
  const withEnabled = updateStudioVCardEnabled(site, true);
  const withEmail = updateStudioVCardField(withEnabled, "email", "hello@example.com");
  const withProfileUrl = updateStudioVCardProfileUrl(withEmail, false);
  const withPhoto = updateStudioVCardPhoto(withProfileUrl, true);
  const withLinkIds = updateStudioVCardLinkIds(withPhoto, "github, linkedin");
  const updated = updateStudioVCardCustomUrls(
    withLinkIds,
    "Calendar | https://cal.example.com/peter",
  );

  // Assert
  assert.deepEqual(updated, {
    ...baseSite,
    quality: {
      seo: {
        canonicalBaseUrl: "https://openlinks.us/",
      },
    },
    sharing: {
      badge: {
        enabled: true,
      },
      vcard: {
        enabled: true,
        fields: {
          email: "hello@example.com",
        },
        include: {
          customUrls: [{ label: "Calendar", url: "https://cal.example.com/peter" }],
          linkIds: ["github", "linkedin"],
          photo: true,
          profileUrl: false,
        },
      },
    },
  });
});

test("studio confirm copy warns about direct main-branch saves", () => {
  assert.deepEqual(resolveStudioConfirmDialogCopy("save"), {
    confirmLabel: "Save to main",
    description:
      "This will commit the current editor changes directly to the repository's main branch and may trigger deployment workflows.",
    title: "Save changes to main?",
  });
});

test("studio confirm copy warns about upstream sync conflicts", () => {
  assert.deepEqual(resolveStudioConfirmDialogCopy("sync"), {
    confirmLabel: "Sync upstream",
    description:
      "This will pull upstream changes into the managed repository and may surface merge conflicts that need manual resolution.",
    title: "Sync upstream changes?",
  });
});

test("editor link accordion values prefer stable link ids", () => {
  assert.equal(resolveEditorLinkAccordionValue(0, "github"), "github");
  assert.equal(resolveEditorLinkAccordionValue(1, " "), "link-2");
});

test("editor link accordion summaries expose label, type, and host metadata", () => {
  assert.deepEqual(
    resolveEditorLinkAccordionSummary(0, {
      label: "GitHub",
      type: "rich",
      url: "https://github.com/pRizz",
    }),
    {
      detail: "github.com",
      meta: "RICH",
      summary: "GitHub",
    },
  );
});

test("editor link accordion summaries fall back when fields are missing", () => {
  assert.deepEqual(resolveEditorLinkAccordionSummary(1, {}), {
    detail: "No URL configured",
    meta: "SIMPLE",
    summary: "Link 2",
  });
});
