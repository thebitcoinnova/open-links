export const DEFAULT_QR_FOREGROUND_COLOR = "#111827";
export const DEFAULT_QR_BACKGROUND_COLOR = "#FFFFFF";

export interface ResolveQrThemeColorsInput {
  foregroundColor?: string;
  backgroundColor?: string;
  readCssVariable?: (name: string, fallback: string) => string;
}

export interface ResolvedQrThemeColors {
  foregroundColor: string;
  backgroundColor: string;
}

const readRootCssVariable = (name: string, fallback: string): string => {
  if (typeof document === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
};

const readResolvedColor = (
  name: string,
  fallback: string,
  readCssVariable: (name: string, fallback: string) => string,
): string => {
  const value = readCssVariable(name, fallback).trim();
  return value.length > 0 ? value : fallback;
};

export const resolveQrThemeColors = (
  input: ResolveQrThemeColorsInput = {},
): ResolvedQrThemeColors => {
  const readCssVariable = input.readCssVariable ?? readRootCssVariable;

  return {
    foregroundColor:
      input.foregroundColor ??
      readResolvedColor("--text-primary", DEFAULT_QR_FOREGROUND_COLOR, readCssVariable),
    backgroundColor:
      input.backgroundColor ??
      readResolvedColor("--surface-panel", DEFAULT_QR_BACKGROUND_COLOR, readCssVariable),
  };
};
