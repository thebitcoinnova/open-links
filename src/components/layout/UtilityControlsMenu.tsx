import * as Dialog from "@kobalte/core/dialog";
import * as Popover from "@kobalte/core/popover";
import { Show, createSignal, createUniqueId, onCleanup, onMount } from "solid-js";
import { IconMenu } from "../../lib/icons/custom-icons";
import type { UiMode } from "../../lib/theme/mode-controller";
import ThemeToggle from "../theme/ThemeToggle";
import {
  createUtilityControlsMenuCloseAutoFocusHandler,
  resolveUtilityControlsMenuOpenChange,
  resolveUtilityControlsMenuTriggerAriaLabel,
} from "./UtilityControlsMenu.helpers";

export interface UtilityControlsMenuProps {
  activeNavigationItem?: "analytics" | "home";
  analyticsHref?: string;
  analyticsLabel?: string;
  analyticsSupportingText?: string;
  homeHref?: string;
  homeLabel?: string;
  cardModeLabel: string;
  isOffline?: boolean;
  label?: string;
  mode: UiMode;
  modePolicyLabel?: string;
  onAnalyticsSelect?: (event: MouseEvent) => void;
  onHomeSelect?: (event: MouseEvent) => void;
  onToggleMode?: () => void;
  panelLabel?: string;
  testingGalleryHref?: string;
  testingGalleryLabel?: string;
  themeIntensity: string;
  themeLabel: string;
}

export const UtilityControlsMenu = (props: UtilityControlsMenuProps) => {
  const [isDesktopOpen, setIsDesktopOpen] = createSignal(false);
  const [isMobileOpen, setIsMobileOpen] = createSignal(false);
  const desktopPanelId = `utility-controls-panel-${createUniqueId()}`;
  const mobilePanelId = `utility-controls-drawer-${createUniqueId()}`;
  const triggerLabel = () => props.label ?? "site controls";
  const panelLabel = () => props.panelLabel ?? "Site controls";
  const triggerAriaLabel = () =>
    resolveUtilityControlsMenuTriggerAriaLabel(isDesktopOpen() || isMobileOpen(), triggerLabel());
  const hasNavigationSection = () => Boolean(props.homeHref) || Boolean(props.analyticsHref);
  const hasUtilitySection = () => props.isOffline || Boolean(props.testingGalleryHref);
  let maybeDesktopTriggerRef: HTMLButtonElement | undefined;
  let maybeMobileTriggerRef: HTMLButtonElement | undefined;
  const handleDesktopCloseAutoFocus = createUtilityControlsMenuCloseAutoFocusHandler(
    () => maybeDesktopTriggerRef,
  );
  const handleMobileCloseAutoFocus = createUtilityControlsMenuCloseAutoFocusHandler(
    () => maybeMobileTriggerRef,
  );
  const closeAllMenus = () => {
    setIsDesktopOpen(false);
    setIsMobileOpen(false);
  };
  const handleDesktopOpenChange = (nextIsOpen: boolean) => {
    setIsMobileOpen(false);
    resolveUtilityControlsMenuOpenChange(nextIsOpen, setIsDesktopOpen);
  };
  const handleMobileOpenChange = (nextIsOpen: boolean) => {
    setIsDesktopOpen(false);
    resolveUtilityControlsMenuOpenChange(nextIsOpen, setIsMobileOpen);
  };

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mobileMedia = window.matchMedia("(max-width: 760px)");
    const handleBreakpointChange = () => {
      closeAllMenus();
    };

    mobileMedia.addEventListener("change", handleBreakpointChange);
    onCleanup(() => mobileMedia.removeEventListener("change", handleBreakpointChange));
  });

  const renderMenuSections = () => (
    <>
      <Show when={hasNavigationSection()}>
        <section class="utility-menu-section" aria-label="Page navigation">
          <p class="utility-menu-section-label">Navigation</p>
          <div class="utility-menu-card">
            <Show when={props.homeHref}>
              <a
                class="utility-menu-link utility-menu-row utility-menu-row--split"
                aria-current={props.activeNavigationItem === "home" ? "page" : undefined}
                href={props.homeHref}
                onClick={(event) => {
                  closeAllMenus();
                  props.onHomeSelect?.(event);
                }}
              >
                <div class="utility-menu-row-copy">
                  <span class="utility-menu-row-label">{props.homeLabel ?? "Home"}</span>
                  <span class="utility-menu-row-supporting">Return to the main links page.</span>
                </div>
                <span class="utility-menu-badge">
                  {props.activeNavigationItem === "home" ? "Current" : "Open"}
                </span>
              </a>
            </Show>
            <Show when={props.analyticsHref}>
              <a
                class="utility-menu-link utility-menu-row utility-menu-row--split"
                aria-current={props.activeNavigationItem === "analytics" ? "page" : undefined}
                href={props.analyticsHref}
                onClick={(event) => {
                  closeAllMenus();
                  props.onAnalyticsSelect?.(event);
                }}
              >
                <div class="utility-menu-row-copy">
                  <span class="utility-menu-row-label">{props.analyticsLabel ?? "Analytics"}</span>
                  <span class="utility-menu-row-supporting">
                    {props.analyticsSupportingText ?? "Open follower analytics."}
                  </span>
                </div>
                <span class="utility-menu-badge">
                  {props.activeNavigationItem === "analytics" ? "Current" : "Open"}
                </span>
              </a>
            </Show>
          </div>
        </section>
      </Show>

      <section class="utility-menu-section" aria-label="Appearance settings">
        <p class="utility-menu-section-label">Appearance</p>
        <div class="utility-menu-card">
          <div class="utility-menu-row utility-menu-row--split">
            <div class="utility-menu-row-copy">
              <span class="utility-menu-row-label">Color mode</span>
              <span class="utility-menu-row-supporting">
                Switch between light and dark presentation.
              </span>
            </div>
            <Show
              when={props.onToggleMode}
              fallback={
                <span class="utility-menu-badge">
                  {props.modePolicyLabel ??
                    `${props.mode === "dark" ? "Dark" : "Light"} mode fixed`}
                </span>
              }
            >
              <ThemeToggle mode={props.mode} onToggle={() => props.onToggleMode?.()} />
            </Show>
          </div>
          <div class="utility-menu-row utility-menu-row--split">
            <div class="utility-menu-row-copy">
              <span class="utility-menu-row-label">Theme palette</span>
              <span class="utility-menu-row-supporting">
                Current surface styling and intensity.
              </span>
            </div>
            <span class="utility-menu-badge">
              {props.themeLabel} · {props.themeIntensity}
            </span>
          </div>
        </div>
      </section>

      <section class="utility-menu-section" aria-label="Content settings">
        <p class="utility-menu-section-label">Content</p>
        <div class="utility-menu-card">
          <div class="utility-menu-row utility-menu-row--split">
            <div class="utility-menu-row-copy">
              <span class="utility-menu-row-label">Card rendering</span>
              <span class="utility-menu-row-supporting">
                Current balance between simple and rich cards.
              </span>
            </div>
            <span class="utility-menu-badge">{props.cardModeLabel}</span>
          </div>
        </div>
      </section>

      <Show when={hasUtilitySection()}>
        <section class="utility-menu-section" aria-label="Utility links and status">
          <p class="utility-menu-section-label">Utilities</p>
          <div class="utility-menu-card">
            <Show when={props.isOffline}>
              <div class="utility-menu-row utility-menu-row--split">
                <div class="utility-menu-row-copy">
                  <span class="utility-menu-row-label">Connection</span>
                  <span class="utility-menu-row-supporting">
                    The page is using offline-safe resources where available.
                  </span>
                </div>
                <span class="utility-menu-badge utility-menu-badge--status">Offline</span>
              </div>
            </Show>
            <Show when={props.testingGalleryHref}>
              <a
                class="utility-menu-link utility-menu-row utility-menu-row--split"
                href={props.testingGalleryHref}
                onClick={closeAllMenus}
              >
                <div class="utility-menu-row-copy">
                  <span class="utility-menu-row-label">
                    {props.testingGalleryLabel ?? "Payment card effects gallery"}
                  </span>
                  <span class="utility-menu-row-supporting">
                    Open the visual testing gallery for payment card effects.
                  </span>
                </div>
                <span class="utility-menu-badge">Open</span>
              </a>
            </Show>
          </div>
        </section>
      </Show>
    </>
  );

  return (
    <div class="utility-menu">
      <Popover.Root
        gutter={8}
        open={isDesktopOpen()}
        onOpenChange={handleDesktopOpenChange}
        placement="bottom-end"
      >
        <Popover.Trigger
          ref={maybeDesktopTriggerRef}
          type="button"
          class="utility-menu-button utility-menu-button--desktop"
          data-open={isDesktopOpen() ? "true" : "false"}
          aria-controls={desktopPanelId}
          aria-expanded={isDesktopOpen()}
          aria-label={triggerAriaLabel()}
        >
          <IconMenu aria-hidden="true" />
          <Show when={props.isOffline}>
            <>
              <span class="utility-menu-button-status" aria-hidden="true" />
              <span class="sr-only">Offline status available in site controls.</span>
            </>
          </Show>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            id={desktopPanelId}
            class="utility-menu-panel"
            aria-label={panelLabel()}
            onCloseAutoFocus={handleDesktopCloseAutoFocus}
          >
            <div class="utility-menu-shell">
              <div class="utility-menu-header">
                <div class="utility-menu-header-copy">
                  <p class="utility-menu-kicker">Preferences</p>
                  <h3 class="utility-menu-title">{panelLabel()}</h3>
                  <p class="utility-menu-description">
                    Adjust appearance, card rendering, and utility shortcuts.
                  </p>
                </div>
              </div>
              {renderMenuSections()}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root open={isMobileOpen()} onOpenChange={handleMobileOpenChange}>
        <Dialog.Trigger
          ref={maybeMobileTriggerRef}
          type="button"
          class="utility-menu-button utility-menu-button--mobile"
          data-open={isMobileOpen() ? "true" : "false"}
          aria-controls={mobilePanelId}
          aria-expanded={isMobileOpen()}
          aria-label={triggerAriaLabel()}
        >
          <IconMenu aria-hidden="true" />
          <Show when={props.isOffline}>
            <>
              <span class="utility-menu-button-status" aria-hidden="true" />
              <span class="sr-only">Offline status available in site controls.</span>
            </>
          </Show>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay class="utility-menu-overlay" />
          <div class="utility-menu-drawer-positioner">
            <Dialog.Content
              id={mobilePanelId}
              class="utility-menu-drawer"
              aria-label={panelLabel()}
              onCloseAutoFocus={handleMobileCloseAutoFocus}
            >
              <div class="utility-menu-shell">
                <div class="utility-menu-header">
                  <div class="utility-menu-header-copy">
                    <p class="utility-menu-kicker">Preferences</p>
                    <Dialog.Title class="utility-menu-title">{panelLabel()}</Dialog.Title>
                    <p class="utility-menu-description">
                      Adjust appearance, card rendering, and utility shortcuts.
                    </p>
                  </div>
                  <Dialog.CloseButton
                    type="button"
                    class="utility-menu-close-button"
                    aria-label={`Close ${panelLabel()}`}
                  >
                    Done
                  </Dialog.CloseButton>
                </div>
                {renderMenuSections()}
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default UtilityControlsMenu;
