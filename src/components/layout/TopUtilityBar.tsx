import type { JSX } from "solid-js";

export interface TopUtilityBarProps {
  title: string;
  controlsLabel?: string;
  stickyOnMobile?: boolean;
  children?: JSX.Element;
}

export const TopUtilityBar = (props: TopUtilityBarProps) => {
  const stickyOnMobile = () => props.stickyOnMobile ?? true;

  return (
    <header class="top-utility-bar" data-sticky-mobile={stickyOnMobile() ? "true" : "false"}>
      <p class="utility-title">{props.title}</p>
      <div class="utility-actions" role="group" aria-label={props.controlsLabel ?? "Display controls"}>
        {props.children}
      </div>
    </header>
  );
};

export default TopUtilityBar;
