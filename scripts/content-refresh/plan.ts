import type { ContentRefreshOptions, ContentRefreshPhase } from "./contracts";

export const DEFAULT_CONTENT_REFRESH_SUMMARY_PATH = ".cache/content-refresh/summary.json";

export const defaultContentRefreshOptions = (): ContentRefreshOptions => ({
  publicCacheMode: "runtime",
  summaryJsonPath: DEFAULT_CONTENT_REFRESH_SUMMARY_PATH,
  validationMode: "standard",
});

export const buildContentRefreshPlan = (options: ContentRefreshOptions): ContentRefreshPhase[] => [
  {
    id: "public-cleanup",
    label: "Clean legacy public build artifacts",
    command: "bun",
    args: ["run", "public:clean"],
  },
  {
    id: "avatar-sync",
    label: "Refresh the profile avatar cache",
    command: "bun",
    args: ["run", "avatar:sync"],
  },
  {
    id: "rich-enrichment",
    label: "Refresh strict rich-link metadata",
    command: "bun",
    args: [
      "run",
      options.publicCacheMode === "stable"
        ? "enrich:rich:strict:write-cache"
        : "enrich:rich:strict",
    ],
  },
  {
    id: "content-image-sync",
    label: "Refresh the content-image cache",
    command: "bun",
    args: ["run", "images:sync"],
  },
  {
    id: "social-preview",
    label: "Regenerate the site social preview",
    command: "bun",
    args: ["run", "social:preview:generate"],
  },
  {
    id: "site-badge",
    label: "Regenerate the site badge",
    command: "bun",
    args: ["run", "badge:site"],
  },
  {
    id: "data-validation",
    label: "Validate refreshed content",
    command: "bun",
    args: ["run", options.validationMode === "strict" ? "validate:data:strict" : "validate:data"],
  },
];

const maybeFlagValue = (args: string[], name: string): string | undefined => {
  const equalsPrefix = `${name}=`;
  const equalsArg = args.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsArg) {
    return equalsArg.slice(equalsPrefix.length);
  }

  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const maybeValue = args[index + 1];
  if (!maybeValue || maybeValue.startsWith("--")) {
    throw new Error(`Content refresh flag '${name}' requires a value.`);
  }
  return maybeValue;
};

export const parseContentRefreshOptions = (args: string[]): ContentRefreshOptions => {
  const defaults = defaultContentRefreshOptions();
  const maybeValidation = maybeFlagValue(args, "--validation");
  const maybePublicCache = maybeFlagValue(args, "--public-cache");
  const maybeSummaryJsonPath = maybeFlagValue(args, "--summary-json");

  if (maybeValidation && maybeValidation !== "standard" && maybeValidation !== "strict") {
    throw new Error(`Unsupported content refresh validation mode '${maybeValidation}'.`);
  }
  if (maybePublicCache && maybePublicCache !== "runtime" && maybePublicCache !== "stable") {
    throw new Error(`Unsupported content refresh public-cache mode '${maybePublicCache}'.`);
  }

  return {
    publicCacheMode:
      args.includes("--write-public-cache") || maybePublicCache === "stable"
        ? "stable"
        : defaults.publicCacheMode,
    summaryJsonPath: maybeSummaryJsonPath ?? defaults.summaryJsonPath,
    validationMode:
      args.includes("--strict") || maybeValidation === "strict"
        ? "strict"
        : defaults.validationMode,
  };
};
