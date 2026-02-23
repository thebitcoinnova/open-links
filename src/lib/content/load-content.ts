import linksData from "../../../data/links.json";
import profileData from "../../../data/profile.json";
import siteData from "../../../data/site.json";

export type LinkType = "simple" | "rich";
export type CompositionMode = "balanced" | "identity-first" | "links-first" | "links-only";
export type GroupingStyle = "subtle" | "none" | "bands";
export type ProfileRichness = "minimal" | "standard" | "rich";
export type DensityMode = "compact" | "medium" | "spacious";
export type ModePolicy = "dark-toggle" | "static-dark" | "static-light";
export type LinkTargetMode = "new-tab-external" | "same-tab" | "new-tab-all";
export type DesktopColumnsMode = "one" | "two";
export type TypographyScaleMode = "fixed" | "compact" | "expressive";
export type TargetSizeMode = "comfortable" | "compact" | "large";
export type RichCardRenderMode = "auto" | "simple";
export type SourceLabelDefault = "show" | "hide";
export type RichImageTreatment = "cover" | "thumbnail" | "off";

export interface RichLinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  enrichmentStatus?: "fetched" | "partial" | "failed" | "skipped";
  enrichedAt?: string;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LinkEnrichmentPolicy {
  enabled?: boolean;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OpenLink {
  id: string;
  label: string;
  url: string;
  type: LinkType;
  icon?: string;
  description?: string;
  group?: string;
  order?: number;
  enabled?: boolean;
  metadata?: RichLinkMetadata;
  enrichment?: LinkEnrichmentPolicy;
  custom?: Record<string, unknown>;
}

export interface LinkGroup {
  id: string;
  label: string;
  order?: number;
}

export interface ProfileData {
  name: string;
  headline: string;
  avatar: string;
  bio: string;
  location?: string;
  pronouns?: string;
  status?: string;
  profileLinks?: Array<{ label: string; url: string }>;
  contact?: Record<string, string>;
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SiteData {
  title: string;
  description: string;
  baseUrl?: string;
  theme: {
    active: string;
    available: string[];
  };
  ui?: {
    compositionMode?: CompositionMode;
    groupingStyle?: GroupingStyle;
    profileRichness?: ProfileRichness;
    density?: DensityMode;
    modePolicy?: ModePolicy;
    linkTarget?: LinkTargetMode;
    desktopColumns?: DesktopColumnsMode;
    typographyScale?: TypographyScaleMode;
    targetSize?: TargetSizeMode;
    richCards?: {
      renderMode?: RichCardRenderMode;
      sourceLabelDefault?: SourceLabelDefault;
      imageTreatment?: RichImageTreatment;
      enrichment?: {
        enabledByDefault?: boolean;
        timeoutMs?: number;
        retries?: number;
        metadataPath?: string;
        reportPath?: string;
      };
    };
  };
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LinksData {
  links: OpenLink[];
  groups?: LinkGroup[];
  order?: string[];
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

interface GeneratedRichMetadataPayload {
  generatedAt?: string;
  links?: Record<string, { metadata?: RichLinkMetadata }>;
}

const generatedMetadataModules = import.meta.glob<{ default: GeneratedRichMetadataPayload }>(
  "../../../data/generated/rich-metadata.json",
  { eager: true }
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveGeneratedMetadata = (): Record<string, RichLinkMetadata> => {
  const module = Object.values(generatedMetadataModules)[0];
  const payload = module?.default;

  if (!payload?.links || !isRecord(payload.links)) {
    return {};
  }

  const mapped: Record<string, RichLinkMetadata> = {};

  for (const [linkId, value] of Object.entries(payload.links)) {
    if (!isRecord(value) || !isRecord(value.metadata)) {
      continue;
    }
    mapped[linkId] = value.metadata as RichLinkMetadata;
  }

  return mapped;
};

const mergeGeneratedMetadata = (
  links: OpenLink[],
  generatedByLink: Record<string, RichLinkMetadata>
): OpenLink[] =>
  links.map((link) => {
    const generated = generatedByLink[link.id];
    if (!generated) {
      return link;
    }

    return {
      ...link,
      metadata: {
        ...(link.metadata ?? {}),
        ...generated
      }
    };
  });

const rankByExplicitOrder = (links: OpenLink[], explicitOrder: string[] = []): OpenLink[] => {
  const orderIndex = new Map(explicitOrder.map((id, index) => [id, index]));
  return [...links].sort((left, right) => {
    const explicitLeft = orderIndex.get(left.id);
    const explicitRight = orderIndex.get(right.id);

    if (explicitLeft !== undefined || explicitRight !== undefined) {
      if (explicitLeft === undefined) return 1;
      if (explicitRight === undefined) return -1;
      return explicitLeft - explicitRight;
    }

    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
};

export const loadContent = () => {
  const profile = profileData as ProfileData;
  const site = siteData as SiteData;
  const linksPayload = linksData as LinksData;
  const generatedMetadata = resolveGeneratedMetadata();

  const mergedLinks = mergeGeneratedMetadata(linksPayload.links, generatedMetadata);
  const enabledLinks = mergedLinks.filter((link) => link.enabled !== false);
  const links = rankByExplicitOrder(enabledLinks, linksPayload.order);

  const groups = [...(linksPayload.groups ?? [])].sort(
    (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
  );

  return {
    profile,
    site,
    links,
    groups,
    linksPayload
  };
};
