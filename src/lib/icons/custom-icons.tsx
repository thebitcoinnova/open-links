import type { Component } from "solid-js";
import { splitProps, mergeProps } from "solid-js";

type IconProps = Record<string, unknown> & {
  size?: number | string;
  color?: string;
  class?: string;
};

/** Substack three-bar mark matching Tabler filled-icon conventions (24x24 viewBox). */
export const IconBrandSubstack: Component<IconProps> = (rawProps) => {
  const merged = mergeProps({ size: 24, color: "currentColor" }, rawProps);
  const [local, rest] = splitProps(merged, ["size", "color", "class"]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={local.size}
      height={local.size}
      viewBox="0 0 24 24"
      fill={local.color}
      stroke="none"
      class={`tabler-icon tabler-icon-brand-substack ${local.class ?? ""}`}
      {...rest}
    >
      <rect x="4" y="4" width="16" height="2" rx="0.5" />
      <rect x="4" y="9" width="16" height="2" rx="0.5" />
      <rect x="4" y="14" width="16" height="6" rx="0.5" />
    </svg>
  );
};
