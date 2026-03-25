import * as Collapsible from "@kobalte/core/collapsible";
import { For, createSignal, createUniqueId } from "solid-js";
import { IconMenu } from "../../lib/icons/custom-icons";
import type { UiMode } from "../../lib/theme/mode-controller";
import {
  type UtilityControlsMenuRowKey,
  resolveUtilityControlsMenuRows,
  resolveUtilityControlsMenuThemeActionLabel,
  resolveUtilityControlsMenuTriggerAriaLabel,
} from "./UtilityControlsMenu.helpers";

export interface UtilityControlsMenuProps {
  activeNavigationItem?: "analytics" | "home";
  analyticsHref?: string;
  analyticsLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  isOffline?: boolean;
  label?: string;
  mode: UiMode;
  onAnalyticsSelect?: (event: MouseEvent) => void;
  onHomeSelect?: (event: MouseEvent) => void;
  onToggleMode?: () => void;
  testingGalleryHref?: string;
  testingGalleryLabel?: string;
}

const MENU_REGION_LABEL = "Site menu";

const restoreFocusSoon = (getTrigger: () => HTMLButtonElement | undefined) => {
  queueMicrotask(() => {
    getTrigger()?.focus();
  });
};

export const UtilityControlsMenu = (props: UtilityControlsMenuProps) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const panelId = `utility-controls-panel-${createUniqueId()}`;
  const triggerLabel = () => props.label ?? "site menu";
  const triggerAriaLabel = () =>
    resolveUtilityControlsMenuTriggerAriaLabel(isOpen(), triggerLabel());
  const rows = () =>
    resolveUtilityControlsMenuRows({
      activeNavigationItem: props.activeNavigationItem,
      analyticsHref: props.analyticsHref,
      analyticsLabel: props.analyticsLabel,
      canToggleMode: Boolean(props.onToggleMode),
      homeHref: props.homeHref,
      homeLabel: props.homeLabel,
      mode: props.mode,
      testingGalleryHref: props.testingGalleryHref,
      testingGalleryLabel: props.testingGalleryLabel,
    });

  let maybeTriggerRef: HTMLButtonElement | undefined;

  const closeMenuAndRestoreFocus = () => {
    setIsOpen(false);
    restoreFocusSoon(() => maybeTriggerRef);
  };

  const handleLinkSelect = (rowKey: UtilityControlsMenuRowKey, event: MouseEvent) => {
    closeMenuAndRestoreFocus();

    if (rowKey === "home") {
      props.onHomeSelect?.(event);
      return;
    }

    if (rowKey === "analytics") {
      props.onAnalyticsSelect?.(event);
    }
  };

  const handleThemeToggle = () => {
    props.onToggleMode?.();
    closeMenuAndRestoreFocus();
  };

  return (
    <Collapsible.Root class="utility-menu" open={isOpen()} onOpenChange={setIsOpen}>
      <Collapsible.Trigger
        ref={maybeTriggerRef}
        type="button"
        class="utility-menu-button"
        data-open={isOpen() ? "true" : "false"}
        aria-controls={panelId}
        aria-expanded={isOpen()}
        aria-label={triggerAriaLabel()}
      >
        <IconMenu aria-hidden="true" />
        {props.isOffline ? (
          <>
            <span class="utility-menu-button-status" aria-hidden="true" />
            <span class="sr-only">Offline status available in site menu.</span>
          </>
        ) : null}
      </Collapsible.Trigger>

      <Collapsible.Content
        as="section"
        id={panelId}
        class="utility-menu-panel"
        aria-label={MENU_REGION_LABEL}
      >
        <div class="utility-menu-list">
          <For each={rows()}>
            {(row) =>
              row.kind === "link" ? (
                <a
                  class="utility-menu-link utility-menu-row"
                  data-current={row.isCurrent ? "true" : undefined}
                  aria-current={row.isCurrent ? "page" : undefined}
                  href={row.href}
                  onClick={(event) => handleLinkSelect(row.key, event)}
                >
                  <span class="utility-menu-row-label">{row.label}</span>
                </a>
              ) : (
                <button
                  type="button"
                  class="utility-menu-action utility-menu-row"
                  aria-label={resolveUtilityControlsMenuThemeActionLabel(props.mode)}
                  onClick={handleThemeToggle}
                >
                  <span class="utility-menu-row-label">{row.label}</span>
                </button>
              )
            }
          </For>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export default UtilityControlsMenu;
