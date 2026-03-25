export interface BuildInfo {
  builtAtIso: string;
  commitSha: string;
  commitShortSha: string;
  commitUrl: string;
}

const ISO_UTC_MINUTE_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u;

export const formatBuildTimestampUtc = (builtAtIso: string): string => {
  const trimmed = builtAtIso.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (ISO_UTC_MINUTE_PREFIX.test(trimmed)) {
    return `${trimmed.slice(0, 16).replace("T", " ")} UTC`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};
