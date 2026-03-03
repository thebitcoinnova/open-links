import { createMemo } from "solid-js";
import type { JSX } from "solid-js";
import type { ResolvedBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { resolveIconPalette } from "../../lib/icons/icon-contrast";
import { resolveKnownSiteIcon } from "../../lib/icons/known-site-icons";
import { resolveKnownSite, resolveKnownSiteById } from "../../lib/icons/known-sites-data";

export interface LinkSiteIconProps {
  icon?: string;
  url?: string;
  label: string;
  options: ResolvedBrandIconOptions;
  themeFingerprint: string;
}

const readRootColorVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
};

export const LinkSiteIcon = (props: LinkSiteIconProps) => {
  const site = createMemo(() => {
    const baseSite = resolveKnownSite(props.icon, props.url);
    if (!baseSite) {
      return undefined;
    }

    const overrideSiteId = props.options.iconOverrides[baseSite.id];
    if (!overrideSiteId) {
      return baseSite;
    }

    return resolveKnownSiteById(overrideSiteId) ?? baseSite;
  });
  const palette = createMemo(() => {
    // Dependency marker so icon palette recomputes on mode/theme changes.
    props.themeFingerprint;

    const resolvedSite = site();
    if (!resolvedSite) {
      return undefined;
    }

    const themeId =
      typeof document === "undefined" ? undefined : document.documentElement.dataset.theme;

    return resolveIconPalette({
      themeId,
      colorMode: props.options.colorMode,
      contrastMode: props.options.contrastMode,
      minContrastRatio: props.options.minContrastRatio,
      brandColor: resolvedSite.brandColor,
      themeSurfacePillColor: readRootColorVar("--surface-pill", "#1A2232"),
      themeAccentColor: readRootColorVar("--accent", "#50E3C2"),
      themeTextColor: readRootColorVar("--text-primary", "#F5F7FB"),
      themeBorderColor: readRootColorVar("--border-subtle", "#6B7280"),
    });
  });

  const siteColorStyle = createMemo<JSX.CSSProperties | undefined>(() => {
    const resolved = palette();
    if (!resolved) {
      return undefined;
    }

    return {
      "--card-icon-fg": resolved.glyphColor,
      "--card-icon-bg": resolved.chipBackgroundColor,
      "--card-icon-border": resolved.chipBorderColor,
    };
  });

  const iconComponent = createMemo(() => {
    const resolvedSite = site();
    return resolvedSite ? resolveKnownSiteIcon(resolvedSite.id) : undefined;
  });

  return (
    <span
      class="card-icon"
      aria-hidden="true"
      data-known-site={site()?.id ?? "unknown"}
      data-color-mode={props.options.colorMode}
      data-contrast-fallback={palette()?.usedFallback ? "true" : "false"}
      style={siteColorStyle()}
    >
      {(() => {
        const IconComponent = iconComponent();
        return IconComponent ? <IconComponent /> : "↗";
      })()}
    </span>
  );
};

export default LinkSiteIcon;
