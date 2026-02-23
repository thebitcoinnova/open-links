import type { JSX } from "solid-js";
import { resolveKnownSiteIcon } from "../../lib/icons/known-site-icons";
import { resolveKnownSite } from "../../lib/icons/known-sites-data";

export interface LinkSiteIconProps {
  icon?: string;
  url: string;
  label: string;
  colorMode: "brand" | "theme";
}

const siteColorStyle = (colorMode: "brand" | "theme", brandColor?: string): JSX.CSSProperties | undefined => {
  if (colorMode !== "brand" || !brandColor) {
    return undefined;
  }

  return {
    "--site-brand-color": brandColor
  };
};

export const LinkSiteIcon = (props: LinkSiteIconProps) => {
  const site = () => resolveKnownSite(props.icon, props.url);
  const iconComponent = () => {
    const resolvedSite = site();
    return resolvedSite ? resolveKnownSiteIcon(resolvedSite.id) : undefined;
  };

  return (
    <span
      class="card-icon"
      aria-hidden="true"
      data-known-site={site()?.id ?? "unknown"}
      data-color-mode={props.colorMode}
      style={siteColorStyle(props.colorMode, site()?.brandColor)}
    >
      {(() => {
        const IconComponent = iconComponent();
        return IconComponent ? <IconComponent /> : "↗";
      })()}
    </span>
  );
};

export default LinkSiteIcon;
