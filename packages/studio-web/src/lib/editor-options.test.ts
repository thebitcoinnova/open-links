import assert from "node:assert/strict";
import test from "node:test";
import type { SiteData } from "../../../../src/lib/content/load-content";
import {
  STUDIO_LINK_TYPE_OPTIONS,
  resolveEditorLinkAccordionSummary,
  resolveEditorLinkAccordionValue,
  resolveStudioConfirmDialogCopy,
  resolveStudioThemeOptions,
} from "./editor-options";

test("studio link type options stay aligned with the supported link types", () => {
  assert.deepEqual(
    STUDIO_LINK_TYPE_OPTIONS.map((option) => option.value),
    ["simple", "rich", "payment"],
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
  } as const satisfies SiteData;

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
  } as const satisfies SiteData;

  assert.deepEqual(resolveStudioThemeOptions(site), [
    { value: "daybreak", label: "daybreak" },
    { value: "sleek", label: "sleek" },
  ]);
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
