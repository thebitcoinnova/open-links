import type {
  QualityDomainResult,
  QualityIssue,
  QualityProfileInput,
  QualitySeoMetadata,
  QualitySiteInput
} from "./types";

interface SeoResolutionTrace {
  titleSource: string;
  descriptionSource: string;
  canonicalSource: string;
  imageSource: string;
}

export interface ResolvedSeoMetadata {
  metadata: QualitySeoMetadata;
  trace: SeoResolutionTrace;
}

const firstString = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const toAbsoluteUrl = (value: string, fallbackBase?: string): string => {
  try {
    return new URL(value).toString();
  } catch {
    const base = fallbackBase && /^https?:\/\//.test(fallbackBase) ? fallbackBase : "https://example.com";
    return new URL(value.startsWith("/") ? value : `/${value}`, base).toString();
  }
};

const resolveCanonical = (site: QualitySiteInput, explicitCanonical?: string): { value: string; source: string } => {
  const base = site.quality?.seo?.canonicalBaseUrl;

  if (explicitCanonical) {
    return {
      value: toAbsoluteUrl(explicitCanonical, base),
      source: "seo.override.canonical"
    };
  }

  if (site.baseUrl) {
    return {
      value: toAbsoluteUrl(site.baseUrl, base),
      source: "site.baseUrl"
    };
  }

  return {
    value: toAbsoluteUrl("/", base),
    source: "fallback.root"
  };
};

export const resolveSeoMetadata = (
  site: QualitySiteInput,
  profile: QualityProfileInput
): ResolvedSeoMetadata => {
  const seo = site.quality?.seo;
  const defaults = seo?.defaults ?? {};
  const profileOverrides = seo?.overrides?.profile ?? {};

  const title =
    firstString(
      profileOverrides.title,
      defaults.title,
      profile.name ? `${profile.name} | ${site.title}` : undefined,
      site.title
    ) ?? "OpenLinks";

  const description =
    firstString(profileOverrides.description, defaults.description, profile.bio, site.description) ??
    "OpenLinks profile";

  const canonicalResolution = resolveCanonical(
    site,
    firstString(profileOverrides.canonical, defaults.canonical)
  );

  const fallbackImage = firstString(seo?.socialImageFallback, "/openlinks-social-fallback.svg")!;
  const image =
    firstString(profileOverrides.twitterImage, profileOverrides.ogImage, defaults.twitterImage, defaults.ogImage) ??
    fallbackImage;

  const ogTitle = firstString(profileOverrides.ogTitle, defaults.ogTitle, title) ?? title;
  const ogDescription =
    firstString(profileOverrides.ogDescription, defaults.ogDescription, description) ?? description;
  const twitterTitle =
    firstString(profileOverrides.twitterTitle, defaults.twitterTitle, ogTitle) ?? ogTitle;
  const twitterDescription =
    firstString(profileOverrides.twitterDescription, defaults.twitterDescription, ogDescription) ?? ogDescription;

  const ogUrl = firstString(profileOverrides.ogUrl, defaults.ogUrl, canonicalResolution.value) ?? canonicalResolution.value;

  const metadata: QualitySeoMetadata = {
    title,
    description,
    canonical: canonicalResolution.value,
    ogTitle,
    ogDescription,
    ogType: firstString(profileOverrides.ogType, defaults.ogType, "website") ?? "website",
    ogImage: toAbsoluteUrl(image, seo?.canonicalBaseUrl),
    ogUrl: toAbsoluteUrl(ogUrl, seo?.canonicalBaseUrl),
    twitterCard:
      firstString(profileOverrides.twitterCard, defaults.twitterCard, "summary_large_image") ??
      "summary_large_image",
    twitterTitle,
    twitterDescription,
    twitterImage: toAbsoluteUrl(image, seo?.canonicalBaseUrl)
  };

  const trace: SeoResolutionTrace = {
    titleSource:
      firstString(profileOverrides.title)
        ? "seo.overrides.profile.title"
        : firstString(defaults.title)
          ? "seo.defaults.title"
          : profile.name
            ? "profile.name + site.title fallback"
            : "site.title fallback",
    descriptionSource:
      firstString(profileOverrides.description)
        ? "seo.overrides.profile.description"
        : firstString(defaults.description)
          ? "seo.defaults.description"
          : profile.bio
            ? "profile.bio fallback"
            : "site.description fallback",
    canonicalSource: canonicalResolution.source,
    imageSource:
      firstString(profileOverrides.twitterImage, profileOverrides.ogImage)
        ? "seo.overrides.profile.image"
        : firstString(defaults.twitterImage, defaults.ogImage)
          ? "seo.defaults.image"
          : "seo.socialImageFallback"
  };

  return {
    metadata,
    trace
  };
};

const missingRequiredFields = (metadata: QualitySeoMetadata): Array<keyof QualitySeoMetadata> =>
  (Object.keys(metadata) as Array<keyof QualitySeoMetadata>).filter((key) => {
    const value = metadata[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

export const runSeoChecks = (
  site: QualitySiteInput,
  profile: QualityProfileInput
): { domainResult: QualityDomainResult; resolved: ResolvedSeoMetadata } => {
  const resolved = resolveSeoMetadata(site, profile);
  const issues: QualityIssue[] = [];

  const missingFields = missingRequiredFields(resolved.metadata);
  missingFields.forEach((field) => {
    issues.push({
      domain: "seo",
      level: "error",
      code: "SEO_REQUIRED_FIELD_MISSING",
      scope: field,
      message: `Resolved SEO metadata field '${field}' is empty.`,
      remediation: `Define '${field}' in quality.seo.defaults or quality.seo.overrides.profile.`
    });
  });

  if (resolved.trace.titleSource.includes("fallback")) {
    issues.push({
      domain: "seo",
      level: "warning",
      code: "SEO_TITLE_FALLBACK",
      scope: "title",
      message: "SEO title is using fallback composition rather than explicit SEO defaults/overrides.",
      remediation:
        "Set quality.seo.defaults.title (or quality.seo.overrides.profile.title) for deterministic social previews."
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
        "Set quality.seo.defaults.description (or quality.seo.overrides.profile.description) for controlled summaries."
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
        "Set quality.seo.defaults.ogImage/twitterImage (or profile override equivalents) when a custom social image is available."
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
      issues
    },
    resolved
  };
};
