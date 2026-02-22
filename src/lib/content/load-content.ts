import linksData from "../../../data/links.json";
import profileData from "../../../data/profile.json";
import siteData from "../../../data/site.json";

export type LinkType = "simple" | "rich";

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
  metadata?: Record<string, unknown>;
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

  const enabledLinks = linksPayload.links.filter((link) => link.enabled !== false);
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
