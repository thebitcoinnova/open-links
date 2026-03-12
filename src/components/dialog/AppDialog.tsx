import * as Dialog from "@kobalte/core/dialog";
import type { ParentProps } from "solid-js";
import { createEffect } from "solid-js";

export interface AppDialogProps extends ParentProps {
  ariaLabel: string;
  contentClass?: string;
  modal?: boolean;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  open: boolean;
  overlayClass?: string;
  positionerClass?: string;
}

type FocusableElement = null | Pick<HTMLElement, "focus"> | undefined;

const joinClassNames = (...values: Array<string | undefined>): string =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");

export const resolveAppDialogOpenChange = (isOpen: boolean, onClose: () => void) => {
  if (!isOpen) {
    onClose();
  }
};

export const restoreAppDialogFocus = (maybeElement: FocusableElement) => {
  maybeElement?.focus();
};

export const createAppDialogCloseAutoFocusHandler = (
  getPreviousFocus: () => FocusableElement,
  maybeHandler?: (event: Event) => void,
) => {
  return (event: Event) => {
    maybeHandler?.(event);

    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    restoreAppDialogFocus(getPreviousFocus());
  };
};

export const AppDialog = (props: AppDialogProps) => {
  let maybePreviousFocus: FocusableElement;

  createEffect(() => {
    if (!props.open || typeof document === "undefined") {
      return;
    }

    maybePreviousFocus = document.activeElement as HTMLElement | null;
  });

  const handleCloseAutoFocus = createAppDialogCloseAutoFocusHandler(
    () => maybePreviousFocus,
    props.onCloseAutoFocus,
  );

  return (
    <Dialog.Root
      modal={props.modal ?? true}
      onOpenChange={(isOpen) => resolveAppDialogOpenChange(isOpen, props.onClose)}
      open={props.open}
    >
      <Dialog.Portal>
        <Dialog.Overlay class={joinClassNames("app-dialog-overlay", props.overlayClass)} />
        <div class={joinClassNames("app-dialog-positioner", props.positionerClass)}>
          <Dialog.Content
            aria-label={props.ariaLabel}
            class={joinClassNames("app-dialog-content", props.contentClass)}
            onCloseAutoFocus={handleCloseAutoFocus}
          >
            {props.children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AppDialog;
