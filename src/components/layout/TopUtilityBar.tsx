import type { JSX } from "solid-js";

export interface TopUtilityBarProps {
  title: string;
  children?: JSX.Element;
}

export const TopUtilityBar = (props: TopUtilityBarProps) => {
  return (
    <header class="top-utility-bar" role="banner">
      <p class="utility-title">{props.title}</p>
      <div class="utility-actions">{props.children}</div>
    </header>
  );
};

export default TopUtilityBar;
