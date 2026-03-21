import {
  DEFAULT_GITHUB_REPOSITORY_REF,
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG,
  resolveGitHubRepositoryRef,
  resolveGitHubRepositorySlug,
} from "./github-repository";

export interface OpenClawPromptRepositoryOptions {
  repositorySlug?: string;
  repositoryRef?: string;
}

export interface OpenClawPromptDocUrls {
  bootstrapUrl: string;
  customizationCatalogUrl: string;
  updateCrudUrl: string;
}

export const DEFAULT_OPENCLAW_PROMPT_REPOSITORY_SLUG = DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG;
export const DEFAULT_OPENCLAW_PROMPT_REPOSITORY_REF = DEFAULT_GITHUB_REPOSITORY_REF;

export const OPENCLAW_PROMPT_DOC_PATHS = {
  bootstrap: "docs/openclaw-bootstrap.md",
  customizationCatalog: "docs/customization-catalog.md",
  updateCrud: "docs/openclaw-update-crud.md",
} as const;

export const resolveOpenClawPromptRepositorySlug = (maybeRepositorySlug?: string): string =>
  resolveGitHubRepositorySlug(maybeRepositorySlug, DEFAULT_OPENCLAW_PROMPT_REPOSITORY_SLUG);

export const resolveOpenClawPromptRepositoryRef = (maybeRepositoryRef?: string): string =>
  resolveGitHubRepositoryRef(maybeRepositoryRef, DEFAULT_OPENCLAW_PROMPT_REPOSITORY_REF);

export const buildGitHubRepositoryUrl = (maybeRepositorySlug?: string): string =>
  `https://github.com/${resolveOpenClawPromptRepositorySlug(maybeRepositorySlug)}`;

export const buildRawGitHubFileUrl = (
  relativePath: string,
  options: OpenClawPromptRepositoryOptions = {},
): string => {
  const normalizedPath = relativePath.replace(/^\/+/, "");
  return `https://raw.githubusercontent.com/${resolveOpenClawPromptRepositorySlug(options.repositorySlug)}/${resolveOpenClawPromptRepositoryRef(options.repositoryRef)}/${normalizedPath}`;
};

export const resolveOpenClawPromptDocUrls = (
  options: OpenClawPromptRepositoryOptions = {},
): OpenClawPromptDocUrls => ({
  bootstrapUrl: buildRawGitHubFileUrl(OPENCLAW_PROMPT_DOC_PATHS.bootstrap, options),
  customizationCatalogUrl: buildRawGitHubFileUrl(
    OPENCLAW_PROMPT_DOC_PATHS.customizationCatalog,
    options,
  ),
  updateCrudUrl: buildRawGitHubFileUrl(OPENCLAW_PROMPT_DOC_PATHS.updateCrud, options),
});

export const buildOpenClawBootstrapPrompt = (
  options: OpenClawPromptRepositoryOptions = {},
): string => {
  const { bootstrapUrl, updateCrudUrl } = resolveOpenClawPromptDocUrls(options);
  return `Follow ${bootstrapUrl} exactly for this repository. Execute Required Execution Policy, End-to-End OpenClaw Sequence, Automation and Identity Confirmation Rule, Social Discovery and Inference Contract, Deployment Verification Contract, Structured URL Reporting Schema, README Deploy URL Marker-Block Contract, and Final Output Contract exactly as written. If an existing setup is detected, ask the single route-confirmation and switch to ${updateCrudUrl} when selected.`;
};

export const buildOpenClawUpdatePrompt = (
  options: OpenClawPromptRepositoryOptions = {},
): string => {
  const { customizationCatalogUrl, updateCrudUrl } = resolveOpenClawPromptDocUrls(options);
  return `Follow ${updateCrudUrl} exactly for this repository. Execute Required Startup Handshake (including conditional customization-audit selectors), Defaults, Customization Audit Path (Optional), Repository Resolution, Dirty Local Repository Handling, Interaction Modes, Identity and Discovery Policy, Update/CRUD Execution Sequence, Final Output Contract, and Required reason codes exactly as written. When customization_path=customization-audit, use ${customizationCatalogUrl} as the checklist source.`;
};
