const toTrimmedText = (value: string | null | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const LEADING_ABOUT_LABEL_PATTERN = /^About(?=[A-Z])/;

export interface ResolveLinkedinDescriptionInput {
  about?: string | null;
  headline?: string | null;
  fallbackDescription?: string | null;
}

export const sanitizeLinkedinDescription = (
  value: string | null | undefined,
): string | undefined => {
  const trimmed = toTrimmedText(value);
  if (!trimmed) {
    return undefined;
  }

  const sanitized = trimmed.replace(LEADING_ABOUT_LABEL_PATTERN, "").trim();
  return sanitized.length > 0 ? sanitized : undefined;
};

export const resolveLinkedinDescription = (
  input: ResolveLinkedinDescriptionInput,
): string | undefined =>
  sanitizeLinkedinDescription(input.about) ??
  sanitizeLinkedinDescription(input.headline) ??
  sanitizeLinkedinDescription(input.fallbackDescription);
