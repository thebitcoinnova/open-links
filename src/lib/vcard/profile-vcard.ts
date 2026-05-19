import { resolveEntityType } from "../content/entity-type";
import type {
  OpenLink,
  ProfileData,
  SiteSharingVCardConfig,
  SiteSharingVCardCustomUrl,
} from "../content/load-content";

export interface ProfileVCardInput {
  config?: SiteSharingVCardConfig;
  links?: OpenLink[];
  photoUri?: string;
  profile: ProfileData;
  profileUrl: string;
}

export interface ProfileVCardDownload {
  contents: string;
  filename: string;
}

interface VCardUrlEntry {
  label?: string;
  url: string;
}

const VCARD_LINE_ENDING = "\r\n";
const VCARD_MAX_LINE_OCTETS = 75;
const UTF8_ENCODER = new TextEncoder();

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const escapeTextValue = (value: string): string =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r\n|\r|\n/gu, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");

const escapeParameterValue = (value: string): string => {
  const escaped = value.replaceAll('"', "").replaceAll("\\", "\\\\");
  return /[:;,]/u.test(escaped) || /\s/u.test(escaped) ? `"${escaped}"` : escaped;
};

const countUtf8Octets = (value: string): number => UTF8_ENCODER.encode(value).length;

const foldContentLine = (line: string): string => {
  let currentLine = "";
  let currentOctets = 0;
  const foldedLines: string[] = [];

  for (const char of Array.from(line)) {
    const charOctets = countUtf8Octets(char);
    if (currentLine.length > 0 && currentOctets + charOctets > VCARD_MAX_LINE_OCTETS) {
      foldedLines.push(currentLine);
      currentLine = ` ${char}`;
      currentOctets = 1 + charOctets;
      continue;
    }

    currentLine += char;
    currentOctets += charOctets;
  }

  foldedLines.push(currentLine);
  return foldedLines.join(VCARD_LINE_ENDING);
};

const stripControlCharacters = (value: string): string =>
  Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("");

const stripCombiningMarks = (value: string): string =>
  Array.from(value.normalize("NFKD"))
    .filter((char) => !/\p{Mark}/u.test(char))
    .join("");

const isAbsoluteUri = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const resolveVCardFilename = (profileName: string, maybeFilename?: string): string => {
  const configured = trimToUndefined(maybeFilename);
  if (configured) {
    const sanitized = stripControlCharacters(configured.replaceAll(/[\\/]/gu, "-")).trim();
    if (sanitized.length > 0) {
      return sanitized.toLowerCase().endsWith(".vcf") ? sanitized : `${sanitized}.vcf`;
    }
  }

  const slug = stripCombiningMarks(profileName)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

  return `${slug || "profile"}.vcf`;
};

const appendTextLine = (lines: string[], name: string, maybeValue: string | undefined) => {
  const value = trimToUndefined(maybeValue);
  if (!value) {
    return;
  }

  lines.push(`${name}:${escapeTextValue(value)}`);
};

const appendStructuredNameLine = (lines: string[], formattedName: string) => {
  const nameParts = formattedName.split(/\s+/u).filter((part) => part.length > 0);
  const familyName = nameParts.length > 1 ? (nameParts.at(-1) ?? "") : "";
  const givenName = nameParts.length > 1 ? nameParts[0] : formattedName;
  const additionalNames = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
  const components = [familyName, givenName, additionalNames, "", ""].map(escapeTextValue);

  lines.push(`N:${components.join(";")}`);
};

const resolveDataUriMediaType = (uri: string): string | undefined => {
  const match = /^data:([^;,]+)[;,]/u.exec(uri);
  const mediaType = match?.[1]?.trim().toLowerCase();

  return mediaType?.startsWith("image/") ? mediaType : undefined;
};

const appendPhotoLine = (lines: string[], maybePhotoUri: string | undefined) => {
  const photoUri = trimToUndefined(maybePhotoUri);
  if (!photoUri || !isAbsoluteUri(photoUri)) {
    return;
  }

  const mediaType = resolveDataUriMediaType(photoUri);
  lines.push(
    mediaType
      ? `PHOTO;MEDIATYPE=${escapeParameterValue(mediaType)}:${photoUri}`
      : `PHOTO:${photoUri}`,
  );
};

const appendUriLine = (
  lines: string[],
  name: string,
  maybeValue: string | undefined,
  maybeLabel?: string,
) => {
  const value = trimToUndefined(maybeValue);
  if (!value || !isAbsoluteUri(value)) {
    return;
  }

  const label = trimToUndefined(maybeLabel);
  lines.push(label ? `${name};TYPE=${escapeParameterValue(label)}:${value}` : `${name}:${value}`);
};

const resolveConfiguredLinks = (links: OpenLink[], linkIds: string[] = []): VCardUrlEntry[] => {
  if (linkIds.length === 0) {
    return [];
  }

  const allowedIds = new Set(linkIds.map((id) => id.trim()).filter((id) => id.length > 0));
  return links
    .filter((link) => allowedIds.has(link.id) && link.enabled !== false)
    .map((link) => ({
      label: link.label,
      url: link.url ?? "",
    }));
};

const normalizeCustomUrls = (customUrls: SiteSharingVCardCustomUrl[] = []): VCardUrlEntry[] =>
  customUrls.map((entry) => ({
    label: entry.label,
    url: entry.url,
  }));

const resolveVCardUrls = (input: ProfileVCardInput): VCardUrlEntry[] => {
  const include = input.config?.include;
  const includeProfileUrl = include?.profileUrl !== false;
  const candidates: VCardUrlEntry[] = [
    ...(includeProfileUrl ? [{ url: input.profileUrl }] : []),
    ...resolveConfiguredLinks(input.links ?? [], include?.linkIds),
    ...normalizeCustomUrls(include?.customUrls),
  ];
  const seen = new Set<string>();
  const urls: VCardUrlEntry[] = [];

  for (const candidate of candidates) {
    const url = trimToUndefined(candidate.url);
    if (!url || !isAbsoluteUri(url)) {
      continue;
    }

    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    urls.push({
      label: candidate.label,
      url,
    });
  }

  return urls;
};

export const buildProfileVCard = (input: ProfileVCardInput): string => {
  const fields = input.config?.fields;
  const lines = ["BEGIN:VCARD", "VERSION:4.0"];
  const entityType = resolveEntityType(input.profile.entityType);
  const formattedName = trimToUndefined(input.profile.name) ?? "Profile";

  appendTextLine(lines, "FN", formattedName);
  if (entityType === "organization") {
    appendTextLine(lines, "KIND", "org");
  } else {
    appendStructuredNameLine(lines, formattedName);
  }
  appendTextLine(lines, "ORG", fields?.organization);
  appendTextLine(lines, "TITLE", fields?.title);
  appendTextLine(lines, "ROLE", fields?.role);
  appendTextLine(lines, "NOTE", fields?.note);
  appendTextLine(lines, "EMAIL", fields?.email);
  appendTextLine(lines, "TEL", fields?.phone);
  appendPhotoLine(lines, input.photoUri);

  for (const entry of resolveVCardUrls(input)) {
    appendUriLine(lines, "URL", entry.url, entry.label);
  }

  lines.push("END:VCARD");
  return `${lines.map(foldContentLine).join(VCARD_LINE_ENDING)}${VCARD_LINE_ENDING}`;
};

export const resolveProfileVCardDownload = (
  input: ProfileVCardInput,
): ProfileVCardDownload | undefined => {
  if (input.config?.enabled !== true) {
    return undefined;
  }

  return {
    contents: buildProfileVCard(input),
    filename: resolveVCardFilename(input.profile.name, input.config.filename),
  };
};
