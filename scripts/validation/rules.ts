export interface ValidationIssue {
  level: "error" | "warning";
  source: string;
  path: string;
  message: string;
  remediation: string;
}

interface PolicyInput {
  profile: Record<string, unknown>;
  links: Record<string, unknown>;
  site: Record<string, unknown>;
  sources?: {
    profile: string;
    links: string;
    site: string;
  };
}

const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

const PROFILE_KEYS = new Set([
  "name",
  "headline",
  "avatar",
  "bio",
  "location",
  "pronouns",
  "status",
  "profileLinks",
  "contact",
  "custom"
]);

const LINKS_ROOT_KEYS = new Set(["links", "groups", "order", "custom"]);
const LINK_KEYS = new Set([
  "id",
  "label",
  "url",
  "type",
  "icon",
  "description",
  "group",
  "order",
  "enabled",
  "metadata",
  "custom"
]);

const SITE_KEYS = new Set(["title", "description", "baseUrl", "theme", "ui", "custom"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unknownTopLevelWarnings = (
  source: string,
  payload: Record<string, unknown>,
  allowed: Set<string>
): ValidationIssue[] => {
  const warnings: ValidationIssue[] = [];

  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      warnings.push({
        level: "warning",
        source,
        path: `$.${key}`,
        message: `Unknown top-level key '${key}' is allowed but not part of the core contract.`,
        remediation: `Move '${key}' into a dedicated custom block if it is extension data, or document why it belongs at top level.`
      });
    }
  }

  return warnings;
};

const checkCustomConflicts = (
  source: string,
  customValue: unknown,
  reservedKeys: Set<string>,
  pathPrefix: string
): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];

  if (!isRecord(customValue)) {
    return errors;
  }

  for (const key of Object.keys(customValue)) {
    if (reservedKeys.has(key)) {
      errors.push({
        level: "error",
        source,
        path: `${pathPrefix}.${key}`,
        message: `Custom key '${key}' conflicts with reserved core key '${key}'.`,
        remediation: `Rename '${pathPrefix}.${key}' to a non-reserved extension key (for example '${key}Extra').`
      });
    }
  }

  return errors;
};

const checkScheme = (source: string, path: string, value: unknown): ValidationIssue[] => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = new URL(value);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return [
        {
          level: "error",
          source,
          path,
          message: `URL scheme '${parsed.protocol}' is not allowed.`,
          remediation: "Use one of: http, https, mailto, tel."
        }
      ];
    }
  } catch {
    return [
      {
        level: "error",
        source,
        path,
        message: "URL value is not parseable.",
        remediation: "Provide a valid absolute URL or supported scheme-based URL."
      }
    ];
  }

  return [];
};

export const runPolicyRules = ({ profile, links, site, sources: overrideSources }: PolicyInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const sources = {
    profile: "data/profile.json",
    links: "data/links.json",
    site: "data/site.json",
    ...overrideSources
  };

  issues.push(...unknownTopLevelWarnings(sources.profile, profile, PROFILE_KEYS));
  issues.push(...unknownTopLevelWarnings(sources.links, links, LINKS_ROOT_KEYS));
  issues.push(...unknownTopLevelWarnings(sources.site, site, SITE_KEYS));

  issues.push(...checkCustomConflicts(sources.profile, profile.custom, PROFILE_KEYS, "$.custom"));
  issues.push(...checkCustomConflicts(sources.links, links.custom, LINKS_ROOT_KEYS, "$.custom"));
  issues.push(...checkCustomConflicts(sources.site, site.custom, SITE_KEYS, "$.custom"));

  const profileLinks = Array.isArray(profile.profileLinks) ? profile.profileLinks : [];
  profileLinks.forEach((link, index) => {
    if (isRecord(link)) {
      issues.push(...checkScheme(sources.profile, `$.profileLinks[${index}].url`, link.url));
    }
  });

  const linkItems = Array.isArray(links.links) ? links.links : [];
  linkItems.forEach((link, index) => {
    if (!isRecord(link)) {
      return;
    }

    issues.push(...checkScheme(sources.links, `$.links[${index}].url`, link.url));
    issues.push(
      ...checkCustomConflicts(
        sources.links,
        link.custom,
        LINK_KEYS,
        `$.links[${index}].custom`
      )
    );
  });

  return issues;
};
