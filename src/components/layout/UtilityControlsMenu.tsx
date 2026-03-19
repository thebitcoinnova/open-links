import * as Popover from "@kobalte/core/popover";
import { type JSX, createSignal, createUniqueId } from "solid-js";
import { IconMenu } from "../../lib/icons/custom-icons";
import {
  createUtilityControlsMenuCloseAutoFocusHandler,
  resolveUtilityControlsMenuOpenChange,
  resolveUtilityControlsMenuTriggerAriaLabel,
} from "./UtilityControlsMenu.helpers";

export interface UtilityControlsMenuProps {
  label?: string;
  panelLabel?: string;
  children?: JSX.Element;
}

export const UtilityControlsMenu = (props: UtilityControlsMenuProps) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const panelId = `utility-controls-panel-${createUniqueId()}`;
  const triggerLabel = () => props.label ?? "controls menu";
  const triggerAriaLabel = () =>
    resolveUtilityControlsMenuTriggerAriaLabel(isOpen(), triggerLabel());
  let maybeTriggerRef: HTMLButtonElement | undefined;
  const handleCloseAutoFocus = createUtilityControlsMenuCloseAutoFocusHandler(
    () => maybeTriggerRef,
  );

  return (
    <div class="utility-menu">
      <Popover.Root
        gutter={8}
        open={isOpen()}
        onOpenChange={(nextIsOpen) => resolveUtilityControlsMenuOpenChange(nextIsOpen, setIsOpen)}
        placement="bottom-end"
      >
        <Popover.Trigger
          ref={maybeTriggerRef}
          type="button"
          class="utility-menu-button"
          aria-controls={panelId}
          aria-expanded={isOpen()}
          aria-label={triggerAriaLabel()}
        >
          <IconMenu aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            id={panelId}
            class="utility-menu-panel"
            aria-label={props.panelLabel ?? "Theme and mode controls"}
            onCloseAutoFocus={handleCloseAutoFocus}
          >
            {props.children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export default UtilityControlsMenu;
