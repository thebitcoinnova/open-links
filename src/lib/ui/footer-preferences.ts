import type { SiteData } from "../content/load-content";

export interface ResolvedFooterPromptPreferences {
  enabled: boolean;
  explanation: string;
  text: string;
  title: string;
}

export interface ResolvedFooterPreferences {
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  prompt: ResolvedFooterPromptPreferences;
  showLastUpdated: boolean;
}

const DEFAULT_DESCRIPTION =
  "OpenLinks is a personal, free, open source, version-controlled links site.\nFork it, customize JSON, and publish fast.";
const DEFAULT_CTA_LABEL = "Create Your OpenLinks";
const DEFAULT_CTA_URL = "https://github.com/pRizz/open-links";
const DEFAULT_PROMPT_TITLE = "Create your own OpenLinks site";
const DEFAULT_PROMPT_EXPLANATION =
  "Paste this bootstrap prompt into OpenClaw, Claude, or Codex to create a new OpenLinks site from this repository.";
const DEFAULT_PROMPT_TEXT =
  "Follow docs/openclaw-bootstrap.md exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to docs/openclaw-update-crud.md when selected.";

const toOptionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveFooterPromptPreferences = (site: SiteData): ResolvedFooterPromptPreferences => {
  const prompt = site.ui?.footer?.prompt;

  return {
    enabled: typeof prompt?.enabled === "boolean" ? prompt.enabled : true,
    explanation: toOptionalTrimmed(prompt?.explanation) ?? DEFAULT_PROMPT_EXPLANATION,
    text: toOptionalTrimmed(prompt?.text) ?? DEFAULT_PROMPT_TEXT,
    title: toOptionalTrimmed(prompt?.title) ?? DEFAULT_PROMPT_TITLE,
  };
};

export const resolveFooterPreferences = (site: SiteData): ResolvedFooterPreferences => {
  const footer = site.ui?.footer;

  return {
    description: toOptionalTrimmed(footer?.description) ?? DEFAULT_DESCRIPTION,
    ctaLabel: toOptionalTrimmed(footer?.ctaLabel) ?? DEFAULT_CTA_LABEL,
    ctaUrl: toOptionalTrimmed(footer?.ctaUrl) ?? DEFAULT_CTA_URL,
    prompt: resolveFooterPromptPreferences(site),
    showLastUpdated: typeof footer?.showLastUpdated === "boolean" ? footer.showLastUpdated : true,
  };
};
