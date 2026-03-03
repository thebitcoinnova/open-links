import { type JSX, Show } from "solid-js";

export interface TopUtilityBarProps {
  title: string;
  controlsLabel?: string;
  stickyOnMobile?: boolean;
  logoPath?: string;
  logoAlt?: string;
  children?: JSX.Element;
}

const toAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = assetPath.replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPath}`;
};

export const TopUtilityBar = (props: TopUtilityBarProps) => {
  const stickyOnMobile = () => props.stickyOnMobile ?? true;
  const titleId = "top-utility-title";
  const logoSrc = () => {
    const maybePath = props.logoPath?.trim();
    if (!maybePath) {
      return undefined;
    }
    return toAssetUrl(maybePath);
  };

  return (
    <header class="top-utility-bar" data-sticky-mobile={stickyOnMobile() ? "true" : "false"}>
      <h2 class="utility-title" id={titleId}>
        <span class="utility-brand">
          <Show when={logoSrc()}>
            {(src) => (
              <img
                class="utility-logo"
                src={src()}
                alt={props.logoAlt ?? ""}
                aria-hidden={props.logoAlt ? undefined : "true"}
              />
            )}
          </Show>
          <span>{props.title}</span>
        </span>
      </h2>
      <div
        class="utility-actions"
        aria-label={props.controlsLabel ?? "Display controls"}
        aria-labelledby={titleId}
      >
        {props.children}
      </div>
    </header>
  );
};

export default TopUtilityBar;
