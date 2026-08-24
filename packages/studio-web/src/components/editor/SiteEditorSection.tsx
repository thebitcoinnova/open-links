import { LabeledInput } from "@/components/ui/field";
import { LabeledSelect } from "@/components/ui/labeled-select";
import {
  STUDIO_ANALYTICS_PAGE_VISIBILITY_OPTIONS,
  type StudioSiteData,
  resolveStudioAnalyticsPageVisibilityValue,
  resolveStudioThemeOptions,
} from "@/lib/editor-options";
import type { RepoContentPayload } from "@openlinks/studio-shared";
import SiteVCardEditor from "./SiteVCardEditor";

interface SiteEditorSectionProps {
  content: RepoContentPayload;
  onContentChange: (content: RepoContentPayload) => void;
  onSiteFieldChange: (field: string, value: string) => void;
  onSiteRecordChange: (site: Record<string, unknown>) => void;
}

export default function SiteEditorSection(props: SiteEditorSectionProps) {
  const site = () => props.content.site;
  const studioSite = () => site() as StudioSiteData;

  const updateTheme = (value: string) => {
    const currentTheme = (site().theme as Record<string, unknown>) ?? {};
    props.onContentChange({
      ...props.content,
      site: {
        ...site(),
        theme: {
          ...currentTheme,
          active: value,
        },
      },
    });
  };

  const updateAnalyticsVisibility = (value: string) => {
    const currentUi = (site().ui as Record<string, unknown>) ?? {};
    const currentAnalytics =
      typeof currentUi.analytics === "object" &&
      currentUi.analytics !== null &&
      !Array.isArray(currentUi.analytics)
        ? (currentUi.analytics as Record<string, unknown>)
        : {};

    props.onContentChange({
      ...props.content,
      site: {
        ...site(),
        ui: {
          ...currentUi,
          analytics: {
            ...currentAnalytics,
            pageEnabled: value === "true",
          },
        },
      },
    });
  };

  return (
    <>
      <h2 class="font-display text-2xl font-bold">Site</h2>
      <LabeledInput
        id="editor-site-title"
        label="Site title"
        onInput={(event) => props.onSiteFieldChange("title", event.currentTarget.value)}
        value={String(site().title ?? "")}
      />
      <LabeledInput
        id="editor-site-description"
        label="Site description"
        onInput={(event) => props.onSiteFieldChange("description", event.currentTarget.value)}
        value={String(site().description ?? "")}
      />
      <LabeledSelect
        id="editor-site-theme-active"
        label="Active theme"
        maybeDescription="Uses the normalized available theme list from site.theme.available."
        onChange={updateTheme}
        options={resolveStudioThemeOptions(studioSite())}
        value={String((site().theme as { active?: string })?.active ?? "")}
      />
      <LabeledSelect
        id="editor-site-analytics-page-visibility"
        label="Analytics page"
        maybeDescription="Controls whether the top-level Links / Analytics page switch is shown."
        onChange={updateAnalyticsVisibility}
        options={STUDIO_ANALYTICS_PAGE_VISIBILITY_OPTIONS}
        value={resolveStudioAnalyticsPageVisibilityValue(studioSite())}
      />
      <SiteVCardEditor site={site()} onSiteRecordChange={props.onSiteRecordChange} />
    </>
  );
}
