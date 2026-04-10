import type { SiteData } from "../content/load-content";
import { buildGitHubRepositoryUrl, buildOpenClawBootstrapPrompt } from "../openclaw-prompts";

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
  showBuildInfo: boolean;
}

export interface FooterPreferenceBuildContext {
  maybeRepositoryRef?: string;
  maybeRepositorySlug?: string;
}

const DEFAULT_DESCRIPTION =
  "OpenLinks is a personal, free, open source, version-controlled links site.\nFork it, customize it, and publish fast.";
const DEFAULT_CTA_LABEL = "Create Your OpenLinks";
const DEFAULT_PROMPT_TITLE = "Create your own OpenLinks site";
const DEFAULT_PROMPT_EXPLANATION =
  "Paste this bootstrap prompt into OpenClaw, Claude, or Codex to create a new OpenLinks site from this repository.";

const toOptionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveBuildTimeRepositorySlug = (): string | undefined =>
  typeof __OPENLINKS_REPOSITORY_SLUG__ === "string" ? __OPENLINKS_REPOSITORY_SLUG__ : undefined;

const resolveBuildTimeRepositoryRef = (): string | undefined =>
  typeof __OPENLINKS_REPOSITORY_DOCS_REF__ === "string"
    ? __OPENLINKS_REPOSITORY_DOCS_REF__
    : undefined;

const resolveFooterPreferenceBuildContext = (
  maybeBuildContext?: FooterPreferenceBuildContext,
): FooterPreferenceBuildContext => ({
  maybeRepositoryRef:
    toOptionalTrimmed(maybeBuildContext?.maybeRepositoryRef) ?? resolveBuildTimeRepositoryRef(),
  maybeRepositorySlug:
    toOptionalTrimmed(maybeBuildContext?.maybeRepositorySlug) ?? resolveBuildTimeRepositorySlug(),
});

const resolveDefaultCtaUrl = (): string => buildGitHubRepositoryUrl();

const resolveDefaultPromptText = (maybeBuildContext: FooterPreferenceBuildContext): string =>
  buildOpenClawBootstrapPrompt({
    repositoryRef: maybeBuildContext.maybeRepositoryRef,
    repositorySlug: maybeBuildContext.maybeRepositorySlug,
  });

const resolveFooterPromptPreferences = (
  site: SiteData,
  maybeBuildContext: FooterPreferenceBuildContext,
): ResolvedFooterPromptPreferences => {
  const prompt = site.ui?.footer?.prompt;

  return {
    enabled: typeof prompt?.enabled === "boolean" ? prompt.enabled : true,
    explanation: toOptionalTrimmed(prompt?.explanation) ?? DEFAULT_PROMPT_EXPLANATION,
    text: toOptionalTrimmed(prompt?.text) ?? resolveDefaultPromptText(maybeBuildContext),
    title: toOptionalTrimmed(prompt?.title) ?? DEFAULT_PROMPT_TITLE,
  };
};

export const resolveFooterPreferences = (
  site: SiteData,
  maybeBuildContext?: FooterPreferenceBuildContext,
): ResolvedFooterPreferences => {
  const footer = site.ui?.footer;
  const buildContext = resolveFooterPreferenceBuildContext(maybeBuildContext);

  return {
    description: toOptionalTrimmed(footer?.description) ?? DEFAULT_DESCRIPTION,
    ctaLabel: toOptionalTrimmed(footer?.ctaLabel) ?? DEFAULT_CTA_LABEL,
    ctaUrl: toOptionalTrimmed(footer?.ctaUrl) ?? resolveDefaultCtaUrl(),
    prompt: resolveFooterPromptPreferences(site, buildContext),
    showBuildInfo:
      typeof footer?.showBuildInfo === "boolean"
        ? footer.showBuildInfo
        : typeof footer?.showLastUpdated === "boolean"
          ? footer.showLastUpdated
          : true,
  };
};
