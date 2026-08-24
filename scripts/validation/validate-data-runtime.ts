import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { ErrorObject } from "ajv";
import { DEFAULT_PUBLIC_CACHE_PATH } from "../enrichment/public-cache";
import type { ValidationIssue } from "./rules-contracts";
import {
  type ArgMap,
  DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
  DEFAULT_ENRICHMENT_METADATA_PATH,
  DEFAULT_HOOK_CHANGED_PATHS_PATH,
  type GeneratedContentImagesPayload,
  HOOK_RICH_ARTIFACT_TRIGGER_EXACT_PATHS,
  HOOK_RICH_ARTIFACT_TRIGGER_PREFIXES,
  HOOK_SKIP_RICH_ARTIFACT_CHECKS_MESSAGE,
  type HookRichArtifactCheckDecision,
  type OutputFormat,
  ROOT,
  type ValidationMode,
} from "./validate-data-contracts";

export const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

export const readJsonFile = <T>(relativePath: string): T => {
  const absolute = absolutePath(relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

export const parseArgs = (): ArgMap => {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    return args[index + 1];
  };

  const formatRaw = getFlagValue("--format");
  const format: OutputFormat = formatRaw === "json" ? "json" : "human";
  const modeRaw = getFlagValue("--mode");
  const mode: ValidationMode = modeRaw === "hook" ? "hook" : "full";

  return {
    strict: args.includes("--strict"),
    format,
    mode,
    profilePath: getFlagValue("--profile") ?? "data/profile.json",
    linksPath: getFlagValue("--links") ?? "data/links.json",
    sitePath: getFlagValue("--site") ?? "data/site.json",
    enrichmentReportPath: getFlagValue("--enrichment-report"),
    changedPathsFile: getFlagValue("--changed-paths-file"),
  };
};

export const normalizeRepoPath = (value: string): string =>
  value
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .trim();

export const pathTouchesHookRichArtifactInputs = (repoPath: string): boolean => {
  const normalized = normalizeRepoPath(repoPath);
  if (normalized.length === 0) {
    return false;
  }

  if (HOOK_RICH_ARTIFACT_TRIGGER_EXACT_PATHS.has(normalized)) {
    return true;
  }

  return HOOK_RICH_ARTIFACT_TRIGGER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

export const tryReadChangedPaths = (
  changedPathsFile: string,
): { paths: string[] | null; errorMessage?: string } => {
  try {
    const absolute = absolutePath(changedPathsFile);
    const contents = fs.readFileSync(absolute, "utf8");
    return {
      paths: contents
        .split(/\r?\n/u)
        .map((entry) => normalizeRepoPath(entry))
        .filter((entry) => entry.length > 0),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      paths: null,
      errorMessage: message,
    };
  }
};

export const resolveHookRichArtifactCheckDecision = (input: {
  mode: ValidationMode;
  changedPathsFile?: string;
}): HookRichArtifactCheckDecision => {
  if (input.mode === "full") {
    return { shouldRun: true };
  }

  if (!input.changedPathsFile) {
    return {
      shouldRun: true,
      humanNote:
        "Hook mode could not find a changed-paths file, so generated rich-artifact checks fell back to full validation.",
    };
  }

  const changedPaths = tryReadChangedPaths(input.changedPathsFile);
  if (!changedPaths.paths) {
    return {
      shouldRun: true,
      humanNote:
        `Hook mode could not read '${input.changedPathsFile}', so generated rich-artifact checks fell back to full validation. ${changedPaths.errorMessage ?? ""}`.trim(),
    };
  }

  if (changedPaths.paths.some((entry) => pathTouchesHookRichArtifactInputs(entry))) {
    return { shouldRun: true };
  }

  return {
    shouldRun: false,
    humanNote: HOOK_SKIP_RICH_ARTIFACT_CHECKS_MESSAGE,
  };
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

export const resolveEnrichmentReportPath = (
  site: Record<string, unknown>,
  overridePath?: string,
): string => {
  if (overridePath) {
    return overridePath;
  }

  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const reportPath =
    enrichment && typeof enrichment.reportPath === "string" ? enrichment.reportPath : undefined;

  return reportPath ?? "data/generated/rich-enrichment-report.json";
};

export const resolveEnrichmentMetadataPath = (site: Record<string, unknown>): string => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const metadataPath =
    enrichment && typeof enrichment.metadataPath === "string" ? enrichment.metadataPath.trim() : "";

  return metadataPath.length > 0 ? metadataPath : DEFAULT_ENRICHMENT_METADATA_PATH;
};

export const resolvePublicCachePath = (site: Record<string, unknown>): string => {
  const ui = isRecord(site.ui) ? site.ui : undefined;
  const richCards = ui && isRecord(ui.richCards) ? ui.richCards : undefined;
  const enrichment = richCards && isRecord(richCards.enrichment) ? richCards.enrichment : undefined;
  const cachePath =
    enrichment && typeof enrichment.publicCachePath === "string"
      ? enrichment.publicCachePath.trim()
      : "";

  return cachePath.length > 0 ? cachePath : DEFAULT_PUBLIC_CACHE_PATH;
};

export const tryReadJsonFile = <T>(
  relativePath: string,
): { value: T | null; errorMessage?: string } => {
  try {
    return { value: readJsonFile<T>(relativePath) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, errorMessage: message };
  }
};

export const readContentImagesManifest = (): {
  path: string;
  value: GeneratedContentImagesPayload | null;
  errorMessage?: string;
} => {
  const manifest = tryReadJsonFile<GeneratedContentImagesPayload>(
    DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
  );
  if (manifest.value) {
    return {
      path: DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
      value: manifest.value,
    };
  }

  return {
    path: DEFAULT_CONTENT_IMAGES_MANIFEST_PATH,
    value: null,
    errorMessage: manifest.errorMessage,
  };
};

export const readTextFile = (
  relativePath: string,
): { value: string | null; errorMessage?: string } => {
  try {
    const absolute = absolutePath(relativePath);
    return { value: fs.readFileSync(absolute, "utf8") };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { value: null, errorMessage: message };
  }
};

export const normalizePath = (instancePath: string): string => {
  if (!instancePath || instancePath === "/") {
    return "$";
  }
  return `$${instancePath.replaceAll("/", ".")}`;
};

export const schemaIssue = (source: string, error: ErrorObject): ValidationIssue => {
  const fieldPath = normalizePath(error.instancePath);
  const message = error.message ?? "Validation issue";

  return {
    level: "error",
    source,
    path: fieldPath,
    message,
    remediation: `Update ${fieldPath} in ${source} to satisfy schema rule: ${message}.`,
  };
};

export const sortIssues = (issues: ValidationIssue[]): ValidationIssue[] =>
  [...issues].sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.path !== right.path) return left.path.localeCompare(right.path);
    return left.message.localeCompare(right.message);
  });
