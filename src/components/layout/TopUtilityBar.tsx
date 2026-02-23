import type { JSX } from "solid-js";

export interface TopUtilityBarProps {
  title: string;
  controlsLabel?: string;
  stickyOnMobile?: boolean;
  children?: JSX.Element;
}

export const TopUtilityBar = (props: TopUtilityBarProps) => {
  const stickyOnMobile = () => props.stickyOnMobile ?? true;
  const titleId = "top-utility-title";

  return (
    <header class="top-utility-bar" data-sticky-mobile={stickyOnMobile() ? "true" : "false"}>
      <h2 class="utility-title" id={titleId}>
        {props.title}
      </h2>
      <div
        class="utility-actions"
        role="group"
        aria-label={props.controlsLabel ?? "Display controls"}
        aria-labelledby={titleId}
      >
        {props.children}
      </div>
    </header>
  );
};

export default TopUtilityBar;
