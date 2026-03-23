import type { KnownSite } from "../icons/known-sites-data";
import { resolveKnownSite } from "../icons/known-sites-data";

export type ContactLinkKind = "email" | "telephone";
export type ContactLinkScheme = "mailto" | "tel";

export type ResolvedLinkKind =
  | {
      kind: "known-site";
      scheme?: string;
      site: KnownSite;
    }
  | {
      kind: "contact";
      scheme: ContactLinkScheme;
      contactKind: ContactLinkKind;
      value?: string;
    }
  | {
      kind: "generic";
      scheme?: string;
    };

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseUrl = (url?: string): URL | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

const decodeUrlValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const resolveLinkUrlScheme = (url?: string): string | undefined => {
  const parsed = parseUrl(url);
  if (!parsed) {
    return undefined;
  }

  return trimToUndefined(parsed.protocol.replace(/:$/u, ""));
};

export const resolveMailtoAddress = (url?: string): string | undefined => {
  const parsed = parseUrl(url);
  if (parsed?.protocol !== "mailto:") {
    return undefined;
  }

  return trimToUndefined(decodeUrlValue(parsed.pathname));
};

export const resolveContactLinkValue = (url?: string): string | undefined => {
  const parsed = parseUrl(url);
  if (!parsed) {
    return undefined;
  }

  if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
    return trimToUndefined(decodeUrlValue(parsed.pathname));
  }

  return undefined;
};

export const resolveLinkKind = (icon?: string, url?: string): ResolvedLinkKind => {
  const scheme = resolveLinkUrlScheme(url);

  if (scheme === "mailto") {
    return {
      kind: "contact",
      scheme,
      contactKind: "email",
      value: resolveContactLinkValue(url),
    };
  }

  if (scheme === "tel") {
    return {
      kind: "contact",
      scheme,
      contactKind: "telephone",
      value: resolveContactLinkValue(url),
    };
  }

  const maybeKnownSite = resolveKnownSite(icon, url);
  if (maybeKnownSite) {
    return {
      kind: "known-site",
      scheme,
      site: maybeKnownSite,
    };
  }

  return {
    kind: "generic",
    scheme,
  };
};
