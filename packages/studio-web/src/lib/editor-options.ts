export type LinkType = "simple" | "rich" | "payment";

export interface StudioSiteData {
  description?: string;
  sharing?: {
    vcard?: StudioVCardConfig;
  };
  theme?: {
    active?: string;
    available?: string[];
  };
  title?: string;
  ui?: {
    analytics?: {
      pageEnabled?: boolean;
    };
  };
}

export type StudioVCardField = "email" | "phone" | "organization" | "title" | "role" | "note";

export interface StudioVCardCustomUrl {
  label?: string;
  url: string;
}

export interface StudioVCardConfig {
  enabled?: boolean;
  filename?: string;
  fields?: Partial<Record<StudioVCardField, string>>;
  include?: {
    photo?: boolean;
    profileUrl?: boolean;
    linkIds?: string[];
    customUrls?: StudioVCardCustomUrl[];
  };
  custom?: Record<string, unknown>;
}

const ALL_THEME_IDS = [
  "sleek",
  "sleek-emerald",
  "sleek-mono",
  "midnight",
  "daybreak",
  "neutral",
  "editorial",
  "futuristic",
  "humanist",
] as const;

const VALID_THEME_IDS = new Set<string>(ALL_THEME_IDS);

const resolveAvailableThemeIds = (site: StudioSiteData): string[] => {
  const available = site.theme?.available ?? [];
  const valid = available.filter((themeId) => VALID_THEME_IDS.has(themeId));

  if (valid.length > 0) {
    return [...new Set(valid)];
  }

  return ["sleek", "daybreak"];
};

export interface StudioSelectOption {
  label: string;
  value: string;
}

export type StudioConfirmAction = "save" | "sync";
export interface StudioConfirmDialogCopy {
  confirmLabel: string;
  description: string;
  title: string;
}

export const STUDIO_LINK_TYPE_OPTIONS: Array<StudioSelectOption & { value: LinkType }> = [
  { value: "simple", label: "Simple" },
  { value: "rich", label: "Rich" },
  { value: "payment", label: "Payment" },
];

export const STUDIO_ANALYTICS_PAGE_VISIBILITY_OPTIONS: StudioSelectOption[] = [
  { value: "true", label: "Shown" },
  { value: "false", label: "Hidden" },
];

export const STUDIO_VCARD_VISIBILITY_OPTIONS: StudioSelectOption[] = [
  { value: "false", label: "Hidden" },
  { value: "true", label: "Shown" },
];

export const STUDIO_VCARD_PROFILE_URL_OPTIONS: StudioSelectOption[] = [
  { value: "true", label: "Included" },
  { value: "false", label: "Excluded" },
];

export const STUDIO_VCARD_PHOTO_OPTIONS: StudioSelectOption[] = [
  { value: "false", label: "Excluded" },
  { value: "true", label: "Included" },
];

export const resolveStudioThemeOptions = (site: StudioSiteData): StudioSelectOption[] =>
  resolveAvailableThemeIds(site).map((themeId) => ({
    value: themeId,
    label: themeId,
  }));

export const resolveStudioAnalyticsPageVisibilityValue = (site: StudioSiteData): string =>
  site.ui?.analytics?.pageEnabled !== false ? "true" : "false";

export const resolveStudioVCardVisibilityValue = (site: StudioSiteData): string =>
  site.sharing?.vcard?.enabled === true ? "true" : "false";

export const resolveStudioVCardProfileUrlValue = (site: StudioSiteData): string =>
  site.sharing?.vcard?.include?.profileUrl === false ? "false" : "true";

export const resolveStudioVCardPhotoValue = (site: StudioSiteData): string =>
  site.sharing?.vcard?.include?.photo === true ? "true" : "false";

export const resolveStudioVCardFilenameValue = (site: StudioSiteData): string =>
  site.sharing?.vcard?.filename ?? "";

export const resolveStudioVCardFieldValue = (
  site: StudioSiteData,
  field: StudioVCardField,
): string => site.sharing?.vcard?.fields?.[field] ?? "";

export const resolveStudioVCardLinkIdsValue = (site: StudioSiteData): string =>
  site.sharing?.vcard?.include?.linkIds?.join(", ") ?? "";

export const parseStudioVCardLinkIdsDraft = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[,\n]/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

export const resolveStudioVCardCustomUrlsValue = (site: StudioSiteData): string =>
  (site.sharing?.vcard?.include?.customUrls ?? [])
    .map((entry) => (entry.label ? `${entry.label} | ${entry.url}` : entry.url))
    .join("\n");

export const parseStudioVCardCustomUrlsDraft = (value: string): StudioVCardCustomUrl[] =>
  value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [maybeLabel, ...urlParts] = line.split("|");
      if (urlParts.length === 0) {
        return {
          url: maybeLabel.trim(),
        };
      }

      return {
        label: maybeLabel.trim() || undefined,
        url: urlParts.join("|").trim(),
      };
    })
    .filter((entry) => entry.url.length > 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const withoutEmptyObjects = (vcard: StudioVCardConfig): StudioVCardConfig => {
  const nextVCard = { ...vcard };

  if (nextVCard.fields && Object.keys(nextVCard.fields).length === 0) {
    const { fields: _emptyFields, ...rest } = nextVCard;
    return withoutEmptyObjects(rest);
  }

  if (nextVCard.include && Object.keys(nextVCard.include).length === 0) {
    const { include: _emptyInclude, ...rest } = nextVCard;
    return withoutEmptyObjects(rest);
  }

  return nextVCard;
};

export const updateStudioVCardConfig = (
  site: Record<string, unknown>,
  update: (vcard: StudioVCardConfig) => StudioVCardConfig,
): Record<string, unknown> => {
  const currentSharing = isRecord(site.sharing) ? site.sharing : {};
  const currentVCard = isRecord(currentSharing.vcard)
    ? (currentSharing.vcard as StudioVCardConfig)
    : {};

  return {
    ...site,
    sharing: {
      ...currentSharing,
      vcard: withoutEmptyObjects(update(currentVCard)),
    },
  };
};

export const updateStudioVCardEnabled = (
  site: Record<string, unknown>,
  enabled: boolean,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => ({
    ...vcard,
    enabled,
  }));

export const updateStudioVCardProfileUrl = (
  site: Record<string, unknown>,
  included: boolean,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => ({
    ...vcard,
    include: {
      ...(vcard.include ?? {}),
      profileUrl: included,
    },
  }));

export const updateStudioVCardPhoto = (
  site: Record<string, unknown>,
  included: boolean,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => {
    const include = { ...(vcard.include ?? {}) };
    if (included) {
      return {
        ...vcard,
        include: {
          ...include,
          photo: true,
        },
      };
    }

    const { photo: _removedPhoto, ...remainingInclude } = include;
    return {
      ...vcard,
      include: remainingInclude,
    };
  });

export const updateStudioVCardFilename = (
  site: Record<string, unknown>,
  value: string,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => {
    const trimmed = value.trim();
    const nextVCard = { ...vcard };

    if (trimmed.length > 0) {
      return {
        ...nextVCard,
        filename: trimmed,
      };
    }

    const { filename: _removedFilename, ...rest } = nextVCard;
    return rest;
  });

export const updateStudioVCardField = (
  site: Record<string, unknown>,
  field: StudioVCardField,
  value: string,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => {
    const fields = { ...(vcard.fields ?? {}) };
    const trimmed = value.trim();

    if (trimmed.length > 0) {
      fields[field] = trimmed;
    } else {
      const { [field]: _removedField, ...remainingFields } = fields;
      return {
        ...vcard,
        fields: remainingFields,
      };
    }

    return {
      ...vcard,
      fields,
    };
  });

export const updateStudioVCardLinkIds = (
  site: Record<string, unknown>,
  value: string,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => {
    const include = { ...(vcard.include ?? {}) };
    const linkIds = parseStudioVCardLinkIdsDraft(value);

    if (linkIds.length > 0) {
      include.linkIds = linkIds;
    } else {
      const { linkIds: _removedLinkIds, ...remainingInclude } = include;
      return {
        ...vcard,
        include: remainingInclude,
      };
    }

    return {
      ...vcard,
      include,
    };
  });

export const updateStudioVCardCustomUrls = (
  site: Record<string, unknown>,
  value: string,
): Record<string, unknown> =>
  updateStudioVCardConfig(site, (vcard) => {
    const include = { ...(vcard.include ?? {}) };
    const customUrls = parseStudioVCardCustomUrlsDraft(value);

    if (customUrls.length > 0) {
      include.customUrls = customUrls;
    } else {
      const { customUrls: _removedCustomUrls, ...remainingInclude } = include;
      return {
        ...vcard,
        include: remainingInclude,
      };
    }

    return {
      ...vcard,
      include,
    };
  });

export const resolveStudioConfirmDialogCopy = (
  action: StudioConfirmAction,
): StudioConfirmDialogCopy =>
  action === "save"
    ? {
        confirmLabel: "Save to main",
        description:
          "This will commit the current editor changes directly to the repository's main branch and may trigger deployment workflows.",
        title: "Save changes to main?",
      }
    : {
        confirmLabel: "Sync upstream",
        description:
          "This will pull upstream changes into the managed repository and may surface merge conflicts that need manual resolution.",
        title: "Sync upstream changes?",
      };

export const resolveEditorLinkAccordionValue = (index: number, maybeLinkId: unknown): string =>
  typeof maybeLinkId === "string" && maybeLinkId.trim().length > 0
    ? maybeLinkId
    : `link-${index + 1}`;

const resolveLinkHost = (maybeUrl: unknown): string | undefined => {
  if (typeof maybeUrl !== "string" || maybeUrl.trim().length === 0) {
    return undefined;
  }

  try {
    return new URL(maybeUrl).host;
  } catch {
    return maybeUrl;
  }
};

export const resolveEditorLinkAccordionSummary = (
  index: number,
  link: Record<string, unknown>,
) => ({
  detail:
    resolveLinkHost(link.url) ??
    (typeof link.url === "string" && link.url.trim().length > 0 ? link.url : "No URL configured"),
  meta:
    typeof link.type === "string" && link.type.trim().length > 0
      ? link.type.toUpperCase()
      : "SIMPLE",
  summary:
    typeof link.label === "string" && link.label.trim().length > 0
      ? link.label
      : `Link ${index + 1}`,
});
