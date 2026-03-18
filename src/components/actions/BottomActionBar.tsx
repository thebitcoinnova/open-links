import { For, Show } from "solid-js";
import {
  IconAnalytics,
  IconCopy,
  IconOpen,
  IconQrCode,
  IconShare,
} from "../../lib/icons/custom-icons";

export type BottomActionKind = "analytics" | "copy" | "open" | "qr" | "share";

interface BottomActionItemBase {
  active?: boolean;
  ariaLabel: string;
  kind: BottomActionKind;
  label: string;
  title?: string;
}

export interface BottomActionBarButtonItem extends BottomActionItemBase {
  onClick: () => void | Promise<void>;
}

export interface BottomActionBarLinkItem extends BottomActionItemBase {
  href: string;
  rel?: string;
  target?: "_blank" | "_self";
}

export type BottomActionBarItem = BottomActionBarButtonItem | BottomActionBarLinkItem;

export interface BottomActionBarProps {
  class?: string;
  items: BottomActionBarItem[];
  label: string;
}

const isLinkItem = (item: BottomActionBarItem): item is BottomActionBarLinkItem => "href" in item;

const resolveActionIcon = (kind: BottomActionKind) => {
  if (kind === "analytics") {
    return <IconAnalytics class="bottom-action-bar-action-icon" aria-hidden="true" />;
  }

  if (kind === "copy") {
    return <IconCopy class="bottom-action-bar-action-icon" aria-hidden="true" />;
  }

  if (kind === "open") {
    return <IconOpen class="bottom-action-bar-action-icon" aria-hidden="true" />;
  }

  if (kind === "qr") {
    return <IconQrCode class="bottom-action-bar-action-icon" aria-hidden="true" />;
  }

  return <IconShare class="bottom-action-bar-action-icon" aria-hidden="true" />;
};

export const BottomActionBar = (props: BottomActionBarProps) => {
  const rootClassName = () =>
    props.class ? `bottom-action-bar ${props.class}` : "bottom-action-bar";

  return (
    <Show when={props.items.length > 0}>
      <fieldset class={rootClassName()}>
        <legend class="sr-only bottom-action-bar-legend">{props.label}</legend>
        <For each={props.items}>
          {(item) =>
            isLinkItem(item) ? (
              <a
                class="bottom-action-bar-action"
                data-active={item.active ? "true" : "false"}
                data-kind={item.kind}
                href={item.href}
                target={item.target}
                rel={item.rel}
                aria-label={item.ariaLabel}
                title={item.title ?? item.ariaLabel}
              >
                {resolveActionIcon(item.kind)}
                <span class="bottom-action-bar-action-label">{item.label}</span>
              </a>
            ) : (
              <button
                type="button"
                class="bottom-action-bar-action"
                data-active={item.active ? "true" : "false"}
                data-kind={item.kind}
                aria-label={item.ariaLabel}
                aria-pressed={item.active}
                title={item.title ?? item.ariaLabel}
                onClick={() => item.onClick()}
              >
                {resolveActionIcon(item.kind)}
                <span class="bottom-action-bar-action-label">{item.label}</span>
              </button>
            )
          }
        </For>
      </fieldset>
    </Show>
  );
};

export default BottomActionBar;
