import { IconMenu2 } from "@tabler/icons-solidjs";
import { Show, createSignal, createUniqueId, onCleanup, onMount, type JSX } from "solid-js";

export interface UtilityControlsMenuProps {
  label?: string;
  panelLabel?: string;
  children?: JSX.Element;
}

export const UtilityControlsMenu = (props: UtilityControlsMenuProps) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const panelId = `utility-controls-panel-${createUniqueId()}`;
  const triggerLabel = () => props.label ?? "controls menu";
  const triggerAriaLabel = () => `${isOpen() ? "Close" : "Open"} ${triggerLabel()}`;
  let containerRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleToggle = () => {
    setIsOpen((open) => !open);
  };

  const handleDocumentPointerDown = (event: PointerEvent) => {
    if (!isOpen()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (containerRef?.contains(target)) {
      return;
    }

    closeMenu();
  };

  const handleFocusOut = (event: FocusEvent) => {
    if (!isOpen()) {
      return;
    }

    const currentTarget = event.currentTarget as HTMLDivElement | null;
    const nextTarget = event.relatedTarget as Node | null;

    if (currentTarget && nextTarget && currentTarget.contains(nextTarget)) {
      return;
    }

    closeMenu();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen() || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    closeMenu();
    triggerRef?.focus();
  };

  onMount(() => {
    document.addEventListener("pointerdown", handleDocumentPointerDown);
  });

  onCleanup(() => {
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
  });

  return (
    <div class="utility-menu" ref={containerRef} onFocusOut={handleFocusOut} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        class="utility-menu-button"
        aria-label={triggerAriaLabel()}
        aria-expanded={isOpen() ? "true" : "false"}
        aria-controls={panelId}
        onClick={handleToggle}
      >
        <IconMenu2 aria-hidden="true" />
      </button>
      <Show when={isOpen()}>
        <div id={panelId} class="utility-menu-panel" role="group" aria-label={props.panelLabel ?? "Theme and mode controls"}>
          {props.children}
        </div>
      </Show>
    </div>
  );
};

export default UtilityControlsMenu;
