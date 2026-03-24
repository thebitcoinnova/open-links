import * as Dialog from "@kobalte/core/dialog";
import * as Popover from "@kobalte/core/popover";
import { Show, createSignal, createUniqueId, onCleanup, onMount } from "solid-js";
import { IconMenu } from "../../lib/icons/custom-icons";
import type { UiMode } from "../../lib/theme/mode-controller";
import ThemeToggle from "../theme/ThemeToggle";
import {
  createUtilityControlsMenuCloseAutoFocusHandler,
  resolveUtilityControlsMenuNavigationBadgeLabel,
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
  const triggerLabel = () => props.label ?? "site menu";
  const panelLabel = () => props.panelLabel ?? "Site menu";
  const modeStatusLabel = () =>
    props.modePolicyLabel ?? `${props.mode === "dark" ? "Dark" : "Light"} mode fixed`;
  const triggerAriaLabel = () =>
    resolveUtilityControlsMenuTriggerAriaLabel(isDesktopOpen() || isMobileOpen(), triggerLabel());
  const hasNavigationSection = () => Boolean(props.homeHref) || Boolean(props.analyticsHref);
  const hasUtilitySection = () => Boolean(props.testingGalleryHref);
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
      <div class="utility-menu-meta">
        <span class="utility-menu-meta-item">
          {props.themeLabel} · {props.themeIntensity}
        </span>
        <span class="utility-menu-meta-item">{props.cardModeLabel}</span>
        <Show when={props.isOffline}>
          <span class="utility-menu-meta-item utility-menu-meta-item--status">Offline ready</span>
        </Show>
      </div>

      <Show when={hasNavigationSection()}>
        <section class="utility-menu-section" aria-label="Page navigation">
          <p class="utility-menu-section-label">Navigate</p>
          <div class="utility-menu-card utility-menu-card--list">
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
                  <span class="utility-menu-row-supporting">Links and profile</span>
                </div>
                <span class="utility-menu-badge">
                  {resolveUtilityControlsMenuNavigationBadgeLabel(
                    props.activeNavigationItem === "home",
                  )}
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
                    {props.analyticsSupportingText ?? "Audience insights"}
                  </span>
                </div>
                <span class="utility-menu-badge">
                  {resolveUtilityControlsMenuNavigationBadgeLabel(
                    props.activeNavigationItem === "analytics",
                  )}
                </span>
              </a>
            </Show>
          </div>
        </section>
      </Show>

      <Show when={hasUtilitySection()}>
        <section class="utility-menu-section" aria-label="Utility links">
          <p class="utility-menu-section-label">Extras</p>
          <div class="utility-menu-card utility-menu-card--list">
            <Show when={props.testingGalleryHref}>
              <a
                class="utility-menu-link utility-menu-row utility-menu-row--split"
                href={props.testingGalleryHref}
                onClick={closeAllMenus}
              >
                <div class="utility-menu-row-copy">
                  <span class="utility-menu-row-label">
                    {props.testingGalleryLabel ?? "Tip card sparks"}
                  </span>
                  <span class="utility-menu-row-supporting">Visual effect sandbox</span>
                </div>
                <span class="utility-menu-badge">Open</span>
              </a>
            </Show>
          </div>
        </section>
      </Show>

      <Show when={props.isOffline}>
        <div class="utility-menu-footer">
          <p class="utility-menu-note">Offline-safe content is active where available.</p>
        </div>
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
              <span class="sr-only">Offline status available in site menu.</span>
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
                  <p class="utility-menu-kicker">Menu</p>
                  <h3 class="utility-menu-title">{panelLabel()}</h3>
                  <p class="utility-menu-description">Quick links and display controls.</p>
                </div>
                <div class="utility-menu-header-actions">
                  <Show
                    when={props.onToggleMode}
                    fallback={<span class="utility-menu-badge">{modeStatusLabel()}</span>}
                  >
                    <ThemeToggle mode={props.mode} onToggle={() => props.onToggleMode?.()} />
                  </Show>
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
              <span class="sr-only">Offline status available in site menu.</span>
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
                    <p class="utility-menu-kicker">Menu</p>
                    <Dialog.Title class="utility-menu-title">{panelLabel()}</Dialog.Title>
                    <p class="utility-menu-description">Quick links and display controls.</p>
                  </div>
                  <div class="utility-menu-header-actions">
                    <Show
                      when={props.onToggleMode}
                      fallback={<span class="utility-menu-badge">{modeStatusLabel()}</span>}
                    >
                      <ThemeToggle mode={props.mode} onToggle={() => props.onToggleMode?.()} />
                    </Show>
                    <Dialog.CloseButton
                      type="button"
                      class="utility-menu-close-button"
                      aria-label={`Close ${panelLabel()}`}
                    >
                      Close
                    </Dialog.CloseButton>
                  </div>
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
