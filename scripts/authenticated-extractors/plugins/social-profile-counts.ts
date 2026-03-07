const COUNT_SUFFIX_MULTIPLIERS = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
} as const;

const safeTrim = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.replaceAll("\u00a0", " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseAudienceCount = (rawValue: string | undefined): number | undefined => {
  const trimmed = safeTrim(rawValue);
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/([0-9][0-9.,\s]*)([KMB])?/i);
  if (!match) {
    return undefined;
  }

  let numericPart = match[1].replace(/\s+/g, "");
  const suffix = match[2]?.toLowerCase() as keyof typeof COUNT_SUFFIX_MULTIPLIERS | undefined;

  if (suffix) {
    if (numericPart.includes(",") && !numericPart.includes(".")) {
      numericPart = numericPart.replace(/,/g, ".");
    } else {
      numericPart = numericPart.replace(/,/g, "");
    }

    const numeric = Number.parseFloat(numericPart);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }

    return Math.round(numeric * COUNT_SUFFIX_MULTIPLIERS[suffix]);
  }

  numericPart = numericPart.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, "");
  if (!/^\d+$/.test(numericPart)) {
    return undefined;
  }

  const numeric = Number.parseInt(numericPart, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
};
