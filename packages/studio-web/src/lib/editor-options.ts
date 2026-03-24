import type { LinkType, SiteData } from "../../../../src/lib/content/load-content";
import { resolveThemeSelection } from "../../../../src/lib/theme/theme-registry";
import { resolveAnalyticsPageEnabled } from "../../../../src/lib/ui/analytics-page-preferences";

export interface StudioSelectOption {
  label: string;
  value: string;
}

export type StudioConfirmAction = "save" | "sync";
export interface StudioConfirmDialogCopy {
  confirmLabel: string;
  description: string;
  title: string;
}

export const STUDIO_LINK_TYPE_OPTIONS: Array<StudioSelectOption & { value: LinkType }> = [
  { value: "simple", label: "Simple" },
  { value: "rich", label: "Rich" },
  { value: "payment", label: "Payment" },
];

export const STUDIO_ANALYTICS_PAGE_VISIBILITY_OPTIONS: StudioSelectOption[] = [
  { value: "true", label: "Shown" },
  { value: "false", label: "Hidden" },
];

export const resolveStudioThemeOptions = (site: SiteData): StudioSelectOption[] =>
  resolveThemeSelection(site).available.map((themeId) => ({
    value: themeId,
    label: themeId,
  }));

export const resolveStudioAnalyticsPageVisibilityValue = (site: SiteData): string =>
  resolveAnalyticsPageEnabled(site) ? "true" : "false";

export const resolveStudioConfirmDialogCopy = (
  action: StudioConfirmAction,
): StudioConfirmDialogCopy =>
  action === "save"
    ? {
        confirmLabel: "Save to main",
        description:
          "This will commit the current editor changes directly to the repository's main branch and may trigger deployment workflows.",
        title: "Save changes to main?",
      }
    : {
        confirmLabel: "Sync upstream",
        description:
          "This will pull upstream changes into the managed repository and may surface merge conflicts that need manual resolution.",
        title: "Sync upstream changes?",
      };

export const resolveEditorLinkAccordionValue = (index: number, maybeLinkId: unknown): string =>
  typeof maybeLinkId === "string" && maybeLinkId.trim().length > 0
    ? maybeLinkId
    : `link-${index + 1}`;

const resolveLinkHost = (maybeUrl: unknown): string | undefined => {
  if (typeof maybeUrl !== "string" || maybeUrl.trim().length === 0) {
    return undefined;
  }

  try {
    return new URL(maybeUrl).host;
  } catch {
    return maybeUrl;
  }
};

export const resolveEditorLinkAccordionSummary = (
  index: number,
  link: Record<string, unknown>,
) => ({
  detail:
    resolveLinkHost(link.url) ??
    (typeof link.url === "string" && link.url.trim().length > 0 ? link.url : "No URL configured"),
  meta:
    typeof link.type === "string" && link.type.trim().length > 0
      ? link.type.toUpperCase()
      : "SIMPLE",
  summary:
    typeof link.label === "string" && link.label.trim().length > 0
      ? link.label
      : `Link ${index + 1}`,
});
