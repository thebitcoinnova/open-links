import { A } from "@solidjs/router";
import type { ParentProps } from "solid-js";
import { type ButtonProps, buttonClassName } from "./button";

interface ButtonLinkBaseProps extends ParentProps {
  class?: string;
  href: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}

interface ExternalButtonLinkProps extends ButtonLinkBaseProps {
  external: true;
  rel?: string;
  target?: string;
}

interface InternalButtonLinkProps extends ButtonLinkBaseProps {
  external?: false;
}

export type ButtonLinkProps = ExternalButtonLinkProps | InternalButtonLinkProps;

export function ButtonLink(props: ButtonLinkProps) {
  const className = () => buttonClassName(props);

  if (props.external) {
    return (
      <a
        class={className()}
        href={props.href}
        rel={props.rel ?? "noreferrer"}
        target={props.target ?? "_blank"}
      >
        {props.children}
      </a>
    );
  }

  return (
    <A class={className()} href={props.href}>
      {props.children}
    </A>
  );
}

export default ButtonLink;
