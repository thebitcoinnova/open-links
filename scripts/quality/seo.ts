import {
  type ResolvedSeoMetadata,
  isPlaceholderExampleUrl,
  resolveBaseAwareAssetPath,
  resolveBasePathFromUrl,
  resolveSeoMetadata,
} from "../../src/lib/seo/resolve-seo-metadata";
import type {
  QualityDomainResult,
  QualityIssue,
  QualityProfileInput,
  QualitySeoMetadata,
  QualitySiteInput,
} from "./types";

const missingRequiredFields = (metadata: QualitySeoMetadata): Array<keyof QualitySeoMetadata> =>
  (Object.keys(metadata) as Array<keyof QualitySeoMetadata>).filter((key) => {
    const value = metadata[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

export const runSeoChecks = (
  site: QualitySiteInput,
  profile: QualityProfileInput,
): { domainResult: QualityDomainResult; resolved: ResolvedSeoMetadata } => {
  const resolved = resolveSeoMetadata(site, profile, {
    resolveImagePath: (candidate) =>
      resolveBaseAwareAssetPath(
        candidate,
        resolveBasePathFromUrl(site.quality?.seo?.canonicalBaseUrl),
      ),
  });
  const issues: QualityIssue[] = [];

  const missingFields = missingRequiredFields(resolved.metadata);
  for (const field of missingFields) {
    issues.push({
      domain: "seo",
      level: "error",
      code: "SEO_REQUIRED_FIELD_MISSING",
      scope: field,
      message: `Resolved SEO metadata field '${field}' is empty.`,
      remediation: `Define '${field}' in quality.seo.defaults or quality.seo.overrides.profile.`,
    });
  }

  for (const [field, value] of [
    ["canonical", resolved.metadata.canonical],
    ["ogUrl", resolved.metadata.ogUrl],
  ] as const) {
    if (!isPlaceholderExampleUrl(value)) {
      continue;
    }

    issues.push({
      domain: "seo",
      level: "error",
      code: "SEO_PLACEHOLDER_URL",
      scope: field,
      message: `Resolved SEO URL field '${field}' points at placeholder host '${new URL(value).hostname}'.`,
      remediation:
        "Set quality.seo.canonicalBaseUrl and any explicit SEO URL overrides to your deployed HTTPS URL.",
    });
  }

  if (resolved.trace.titleSource.includes("fallback")) {
    issues.push({
      domain: "seo",
      level: "warning",
      code: "SEO_TITLE_FALLBACK",
      scope: "title",
      message:
        "SEO title is using fallback composition rather than explicit SEO defaults/overrides.",
      remediation:
        "Set quality.seo.defaults.title (or quality.seo.overrides.profile.title) for deterministic social previews.",
    });
  }

  if (resolved.trace.descriptionSource.includes("fallback")) {
    issues.push({
      domain: "seo",
      level: "warning",
      code: "SEO_DESCRIPTION_FALLBACK",
      scope: "description",
      message: "SEO description is derived from fallback content.",
      remediation:
        "Set quality.seo.defaults.description (or quality.seo.overrides.profile.description) for controlled summaries.",
    });
  }

  if (resolved.trace.imageSource === "seo.socialImageFallback") {
    issues.push({
      domain: "seo",
      level: "warning",
      code: "SEO_SOCIAL_IMAGE_FALLBACK",
      scope: "image",
      message: "Social preview image is using deterministic fallback image.",
      remediation:
        "Set quality.seo.defaults.ogImage/twitterImage (or profile override equivalents) when a custom social image is available.",
    });
  }

  const hasError = issues.some((issue) => issue.level === "error");
  const hasWarning = issues.some((issue) => issue.level === "warning");

  return {
    domainResult: {
      domain: "seo",
      status: hasError ? "fail" : hasWarning ? "warn" : "pass",
      summary: hasError
        ? "SEO metadata checks found blocking errors."
        : hasWarning
          ? "SEO metadata checks passed with warnings."
          : "SEO metadata checks passed.",
      issues,
    },
    resolved,
  };
};
