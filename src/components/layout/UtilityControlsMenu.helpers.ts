type FocusableElement = null | Pick<HTMLButtonElement, "focus"> | undefined;

export const resolveUtilityControlsMenuTriggerAriaLabel = (isOpen: boolean, label: string) =>
  `${isOpen ? "Close" : "Open"} ${label}`;

export const resolveUtilityControlsMenuOpenChange = (
  isOpen: boolean,
  setIsOpen: (value: boolean) => void,
) => {
  setIsOpen(isOpen);
};

export const createUtilityControlsMenuCloseAutoFocusHandler = (
  getTrigger: () => FocusableElement,
) => {
  return (event: Event) => {
    event.preventDefault();
    getTrigger()?.focus();
  };
};
