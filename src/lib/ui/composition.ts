import type {
  CompositionMode,
  GroupingStyle,
  LinkGroup,
  OpenLink,
  ProfileRichness,
  SiteData,
} from "../content/load-content";

export interface ResolvedLinkSection {
  id: string;
  label?: string;
  links: OpenLink[];
}

export interface CompositionConfig {
  mode: CompositionMode;
  grouping: GroupingStyle;
  profileRichness: ProfileRichness;
  profileEmphasis: "balanced" | "identity" | "supporting";
  blocks: Array<"profile" | "links">;
}

const getMode = (site: SiteData): CompositionMode => {
  const value = site.ui?.compositionMode;
  if (value === "identity-first" || value === "links-first" || value === "links-only") {
    return value;
  }
  return "balanced";
};

const getGrouping = (site: SiteData): GroupingStyle => {
  const value = site.ui?.groupingStyle;
  if (value === "none" || value === "bands") {
    return value;
  }
  return "subtle";
};

const getProfileRichness = (site: SiteData): ProfileRichness => {
  const value = site.ui?.profileRichness;
  if (value === "minimal" || value === "rich") {
    return value;
  }
  return "standard";
};

const blocksForMode = (mode: CompositionMode): Array<"profile" | "links"> => {
  if (mode === "links-first") return ["links", "profile"];
  if (mode === "links-only") return ["links"];
  return ["profile", "links"];
};

const emphasisForMode = (mode: CompositionMode): "balanced" | "identity" | "supporting" => {
  if (mode === "identity-first") return "identity";
  if (mode === "links-first") return "supporting";
  return "balanced";
};

export const resolveComposition = (site: SiteData): CompositionConfig => {
  const mode = getMode(site);

  return {
    mode,
    grouping: getGrouping(site),
    profileRichness: getProfileRichness(site),
    profileEmphasis: emphasisForMode(mode),
    blocks: blocksForMode(mode),
  };
};

const groupedSections = (links: OpenLink[], groups: LinkGroup[]): ResolvedLinkSection[] => {
  const byGroup = new Map<string, OpenLink[]>();

  for (const link of links) {
    const key = link.group ?? "ungrouped";
    const existing = byGroup.get(key) ?? [];
    existing.push(link);
    byGroup.set(key, existing);
  }

  if (groups.length === 0) {
    return [{ id: "all", label: "Links", links }];
  }

  const sections = groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      links: byGroup.get(group.id) ?? [],
    }))
    .filter((section) => section.links.length > 0);

  const leftovers = byGroup.get("ungrouped") ?? [];
  if (leftovers.length > 0) {
    sections.push({ id: "ungrouped", label: "More", links: leftovers });
  }

  return sections;
};

export const resolveLinkSections = (
  links: OpenLink[],
  groups: LinkGroup[],
  grouping: GroupingStyle,
): ResolvedLinkSection[] => {
  if (grouping === "none") {
    return [{ id: "all", links }];
  }

  return groupedSections(links, groups);
};
