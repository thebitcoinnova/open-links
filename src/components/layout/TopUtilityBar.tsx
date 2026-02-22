import type { JSX } from "solid-js";

export interface TopUtilityBarProps {
  title: string;
  controlsLabel?: string;
  children?: JSX.Element;
}

export const TopUtilityBar = (props: TopUtilityBarProps) => {
  return (
    <header class="top-utility-bar">
      <p class="utility-title">{props.title}</p>
      <div class="utility-actions" role="group" aria-label={props.controlsLabel ?? "Display controls"}>
        {props.children}
      </div>
    </header>
  );
};

export default TopUtilityBar;
