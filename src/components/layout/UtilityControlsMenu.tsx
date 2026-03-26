import * as Dialog from "@kobalte/core/dialog";
import * as Popover from "@kobalte/core/popover";
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

const createCloseAutoFocusHandler = (getTrigger: () => HTMLButtonElement | undefined) => {
  return (event: Event) => {
    event.preventDefault();
    restoreFocusSoon(getTrigger);
  };
};

export const UtilityControlsMenu = (props: UtilityControlsMenuProps) => {
  const [isDesktopOpen, setIsDesktopOpen] = createSignal(false);
  const [isMobileOpen, setIsMobileOpen] = createSignal(false);
  const desktopPanelId = `utility-controls-panel-desktop-${createUniqueId()}`;
  const mobilePanelId = `utility-controls-panel-mobile-${createUniqueId()}`;
  const triggerLabel = () => props.label ?? "site menu";
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

  let maybeDesktopTriggerRef: HTMLButtonElement | undefined;
  let maybeMobileTriggerRef: HTMLButtonElement | undefined;

  const closeDesktopMenu = () => {
    setIsDesktopOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  const handleLinkSelect = (
    rowKey: UtilityControlsMenuRowKey,
    event: MouseEvent,
    closeMenu: () => void,
  ) => {
    closeMenu();

    if (rowKey === "home") {
      props.onHomeSelect?.(event);
      return;
    }

    if (rowKey === "analytics") {
      props.onAnalyticsSelect?.(event);
    }
  };

  const handleThemeToggle = (closeMenu: () => void) => {
    props.onToggleMode?.();
    closeMenu();
  };

  const handleDesktopCloseAutoFocus = createCloseAutoFocusHandler(() => maybeDesktopTriggerRef);
  const handleMobileCloseAutoFocus = createCloseAutoFocusHandler(() => maybeMobileTriggerRef);

  const renderTriggerContents = () => (
    <>
      <IconMenu aria-hidden="true" />
      {props.isOffline ? (
        <>
          <span class="utility-menu-button-status" aria-hidden="true" />
          <span class="sr-only">Offline status available in site menu.</span>
        </>
      ) : null}
    </>
  );

  const renderRows = (closeMenu: () => void) => (
    <div class="utility-menu-list">
      <For each={rows()}>
        {(row) =>
          row.kind === "link" ? (
            <a
              class="utility-menu-link utility-menu-row"
              data-current={row.isCurrent ? "true" : undefined}
              aria-current={row.isCurrent ? "page" : undefined}
              href={row.href}
              onClick={(event) => handleLinkSelect(row.key, event, closeMenu)}
            >
              <span class="utility-menu-row-label">{row.label}</span>
            </a>
          ) : (
            <button
              type="button"
              class="utility-menu-action utility-menu-row"
              aria-label={resolveUtilityControlsMenuThemeActionLabel(props.mode)}
              onClick={() => handleThemeToggle(closeMenu)}
            >
              <span class="utility-menu-row-label">{row.label}</span>
            </button>
          )
        }
      </For>
    </div>
  );

  return (
    <div class="utility-menu">
      <Popover.Root
        gutter={8}
        open={isDesktopOpen()}
        onOpenChange={setIsDesktopOpen}
        placement="bottom-end"
      >
        <Popover.Trigger
          ref={maybeDesktopTriggerRef}
          type="button"
          class="utility-menu-button utility-menu-button--desktop"
          data-open={isDesktopOpen() ? "true" : "false"}
          aria-controls={desktopPanelId}
          aria-expanded={isDesktopOpen()}
          aria-label={resolveUtilityControlsMenuTriggerAriaLabel(isDesktopOpen(), triggerLabel())}
        >
          {renderTriggerContents()}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            id={desktopPanelId}
            class="utility-menu-panel utility-menu-panel--desktop"
            onCloseAutoFocus={handleDesktopCloseAutoFocus}
            aria-label={MENU_REGION_LABEL}
          >
            <Popover.Title class="sr-only">{MENU_REGION_LABEL}</Popover.Title>
            {renderRows(closeDesktopMenu)}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root open={isMobileOpen()} onOpenChange={setIsMobileOpen}>
        <Dialog.Trigger
          ref={maybeMobileTriggerRef}
          type="button"
          class="utility-menu-button utility-menu-button--mobile"
          data-open={isMobileOpen() ? "true" : "false"}
          aria-controls={mobilePanelId}
          aria-expanded={isMobileOpen()}
          aria-label={resolveUtilityControlsMenuTriggerAriaLabel(isMobileOpen(), triggerLabel())}
        >
          {renderTriggerContents()}
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay class="utility-menu-overlay" />
          <div class="utility-menu-drawer-positioner">
            <Dialog.Content
              id={mobilePanelId}
              class="utility-menu-drawer"
              onCloseAutoFocus={handleMobileCloseAutoFocus}
              aria-label={MENU_REGION_LABEL}
            >
              <div class="utility-menu-drawer-header">
                <Dialog.Title class="utility-menu-drawer-title">{MENU_REGION_LABEL}</Dialog.Title>
                <Dialog.CloseButton
                  type="button"
                  class="utility-menu-close-button"
                  aria-label={`Close ${triggerLabel()}`}
                >
                  Close
                </Dialog.CloseButton>
              </div>

              {renderRows(closeMobileMenu)}
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default UtilityControlsMenu;
