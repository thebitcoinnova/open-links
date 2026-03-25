import {
  type SiteSeoContentImageField,
  getSiteSeoContentImageSlotId,
} from "../content/content-image-slots";
import { type EntityType, resolveEntityPageNoun } from "../content/entity-type";

export interface SeoMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  ogImage: string;
  ogUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

export interface SeoSiteInput {
  title: string;
  description: string;
  baseUrl?: string;
  quality?: {
    seo?: {
      canonicalBaseUrl?: string;
      socialImageFallback?: string;
      defaults?: Partial<SeoMetadata>;
      overrides?: {
        profile?: Partial<SeoMetadata>;
      };
    };
  };
}

export interface SeoProfileInput {
  entityType?: EntityType;
  name?: string;
  bio?: string;
}

interface SeoResolutionTrace {
  titleSource: string;
  descriptionSource: string;
  canonicalSource: string;
  imageSource: string;
}

export interface ResolveSeoMetadataOptions {
  fallbackOrigin?: string;
  resolveImagePath?: (
    candidate: string,
    context: {
      sourceField?: SiteSeoContentImageField;
      slotId?: string;
    },
  ) => string | undefined;
}

export interface ResolvedSeoMetadata {
  metadata: SeoMetadata;
  trace: SeoResolutionTrace;
}

type SeoConfig = NonNullable<NonNullable<SeoSiteInput["quality"]>["seo"]>;

const DEFAULT_PLACEHOLDER_ORIGIN = "https://placeholder.example/";
const DEFAULT_SOCIAL_IMAGE = "/openlinks-social-fallback.png";
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

const firstString = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const normalizeAbsoluteBaseUrl = (value?: string): string | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
    return parsed.toString();
  } catch {
    return undefined;
  }
};

const toDomainRootBase = (value?: string): string => {
  const normalizedBase = normalizeAbsoluteBaseUrl(value) ?? DEFAULT_PLACEHOLDER_ORIGIN;
  const parsed = new URL(normalizedBase);
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
};

const toAbsoluteDomainUrl = (value: string, fallbackBase?: string): string => {
  try {
    return new URL(value).toString();
  } catch {
    const base = toDomainRootBase(fallbackBase);
    const normalizedValue = value.startsWith("/") ? value : `/${value}`;
    return new URL(normalizedValue, base).toString();
  }
};

const isRootPath = (value?: string): boolean => {
  if (typeof value !== "string") {
    return true;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "/";
};

export const normalizeBasePath = (value?: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "/";
  }

  const trimmed = value.trim();
  if (trimmed === "/") {
    return "/";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
};

export const resolveBasePathFromUrl = (value?: string): string => {
  const normalizedBase = normalizeAbsoluteBaseUrl(value);
  if (!normalizedBase) {
    return "/";
  }

  return normalizeBasePath(new URL(normalizedBase).pathname);
};

export const resolveBaseAwareAssetPath = (candidate: string, basePath?: string): string => {
  const trimmed = candidate.trim();
  if (trimmed.length === 0 || URL_SCHEME_PATTERN.test(trimmed) || trimmed.startsWith("//")) {
    return trimmed;
  }

  const normalizedBasePath = normalizeBasePath(basePath);
  const normalizedCandidatePath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (normalizedBasePath === "/") {
    return normalizedCandidatePath;
  }

  if (
    normalizedCandidatePath === normalizedBasePath.slice(0, -1) ||
    normalizedCandidatePath.startsWith(normalizedBasePath)
  ) {
    return normalizedCandidatePath;
  }

  return `${normalizedBasePath}${normalizedCandidatePath.replace(/^\/+/, "")}`;
};

export const isPlaceholderExampleUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "example" || hostname.endsWith(".example");
  } catch {
    return false;
  }
};

const resolveBaseOrigin = (
  site: SeoSiteInput,
  fallbackOrigin?: string,
): { value: string; source: string } => {
  const configuredBase = normalizeAbsoluteBaseUrl(site.quality?.seo?.canonicalBaseUrl);
  if (configuredBase) {
    return {
      value: configuredBase,
      source: "quality.seo.canonicalBaseUrl",
    };
  }

  const runtimeBase = normalizeAbsoluteBaseUrl(fallbackOrigin);
  if (runtimeBase) {
    return {
      value: runtimeBase,
      source: "runtime.origin",
    };
  }

  return {
    value: DEFAULT_PLACEHOLDER_ORIGIN,
    source: "placeholder.origin",
  };
};

const resolveCanonical = (
  site: SeoSiteInput,
  explicitCanonical: string | undefined,
  baseOrigin: { value: string; source: string },
): { value: string; source: string } => {
  if (explicitCanonical) {
    return {
      value: toAbsoluteDomainUrl(explicitCanonical, baseOrigin.value),
      source: "seo.override.canonical",
    };
  }

  if (!isRootPath(site.baseUrl)) {
    return {
      value: toAbsoluteDomainUrl(site.baseUrl as string, baseOrigin.value),
      source: "site.baseUrl",
    };
  }

  return {
    value: baseOrigin.value,
    source: baseOrigin.source,
  };
};

const resolveImageCandidate = (
  seo: SeoConfig | undefined,
): {
  candidate: string;
  traceSource: string;
  context: {
    sourceField?: SiteSeoContentImageField;
    slotId?: string;
  };
} => {
  const profileOverrides = seo?.overrides?.profile ?? {};
  const defaults = seo?.defaults ?? {};

  const profileTwitterImage = firstString(profileOverrides.twitterImage);
  if (profileTwitterImage) {
    return {
      candidate: profileTwitterImage,
      traceSource: "seo.overrides.profile.image",
      context: {
        sourceField: "overrides.profile.twitterImage",
        slotId: getSiteSeoContentImageSlotId("overrides.profile.twitterImage"),
      },
    };
  }

  const profileOgImage = firstString(profileOverrides.ogImage);
  if (profileOgImage) {
    return {
      candidate: profileOgImage,
      traceSource: "seo.overrides.profile.image",
      context: {
        sourceField: "overrides.profile.ogImage",
        slotId: getSiteSeoContentImageSlotId("overrides.profile.ogImage"),
      },
    };
  }

  const defaultTwitterImage = firstString(defaults.twitterImage);
  if (defaultTwitterImage) {
    return {
      candidate: defaultTwitterImage,
      traceSource: "seo.defaults.image",
      context: {
        sourceField: "defaults.twitterImage",
        slotId: getSiteSeoContentImageSlotId("defaults.twitterImage"),
      },
    };
  }

  const defaultOgImage = firstString(defaults.ogImage);
  if (defaultOgImage) {
    return {
      candidate: defaultOgImage,
      traceSource: "seo.defaults.image",
      context: {
        sourceField: "defaults.ogImage",
        slotId: getSiteSeoContentImageSlotId("defaults.ogImage"),
      },
    };
  }

  const socialImageFallback = firstString(seo?.socialImageFallback);
  if (socialImageFallback) {
    return {
      candidate: socialImageFallback,
      traceSource: "seo.socialImageFallback",
      context: {
        sourceField: "socialImageFallback",
        slotId: getSiteSeoContentImageSlotId("socialImageFallback"),
      },
    };
  }

  return {
    candidate: DEFAULT_SOCIAL_IMAGE,
    traceSource: "default.socialImage",
    context: {},
  };
};

export const resolveSeoMetadata = (
  site: SeoSiteInput,
  profile: SeoProfileInput,
  options: ResolveSeoMetadataOptions = {},
): ResolvedSeoMetadata => {
  const seo = site.quality?.seo;
  const defaults = seo?.defaults ?? {};
  const profileOverrides = seo?.overrides?.profile ?? {};
  const baseOrigin = resolveBaseOrigin(site, options.fallbackOrigin);
  const pageNoun = resolveEntityPageNoun(profile.entityType);

  const title =
    firstString(
      profileOverrides.title,
      defaults.title,
      profile.name ? `${profile.name} | ${site.title}` : undefined,
      site.title,
    ) ?? "OpenLinks";

  const description =
    firstString(
      profileOverrides.description,
      defaults.description,
      profile.bio,
      site.description,
    ) ?? `OpenLinks ${pageNoun}`;

  const canonicalResolution = resolveCanonical(
    site,
    firstString(profileOverrides.canonical, defaults.canonical),
    baseOrigin,
  );

  const imageCandidate = resolveImageCandidate(seo);
  const resolvedImagePath =
    firstString(
      options.resolveImagePath?.(imageCandidate.candidate, imageCandidate.context),
      imageCandidate.candidate,
    ) ?? imageCandidate.candidate;

  const ogTitle = firstString(profileOverrides.ogTitle, defaults.ogTitle, title) ?? title;
  const ogDescription =
    firstString(profileOverrides.ogDescription, defaults.ogDescription, description) ?? description;
  const ogUrl =
    firstString(profileOverrides.ogUrl, defaults.ogUrl, canonicalResolution.value) ??
    canonicalResolution.value;

  const twitterCard =
    firstString(profileOverrides.twitterCard, defaults.twitterCard, "summary_large_image") ??
    "summary_large_image";
  const twitterTitle =
    firstString(profileOverrides.twitterTitle, defaults.twitterTitle, ogTitle) ?? ogTitle;
  const twitterDescription =
    firstString(profileOverrides.twitterDescription, defaults.twitterDescription, ogDescription) ??
    ogDescription;

  return {
    metadata: {
      title,
      description,
      canonical: canonicalResolution.value,
      ogTitle,
      ogDescription,
      ogType: firstString(profileOverrides.ogType, defaults.ogType, "website") ?? "website",
      ogImage: toAbsoluteDomainUrl(resolvedImagePath, baseOrigin.value),
      ogUrl: toAbsoluteDomainUrl(ogUrl, baseOrigin.value),
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage: toAbsoluteDomainUrl(resolvedImagePath, baseOrigin.value),
    },
    trace: {
      titleSource: firstString(profileOverrides.title)
        ? "seo.overrides.profile.title"
        : firstString(defaults.title)
          ? "seo.defaults.title"
          : profile.name
            ? "profile.name + site.title fallback"
            : "site.title fallback",
      descriptionSource: firstString(profileOverrides.description)
        ? "seo.overrides.profile.description"
        : firstString(defaults.description)
          ? "seo.defaults.description"
          : profile.bio
            ? "profile.bio fallback"
            : "site.description fallback",
      canonicalSource: canonicalResolution.source,
      imageSource: imageCandidate.traceSource,
    },
  };
};
