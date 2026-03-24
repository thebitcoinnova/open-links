import assert from "node:assert/strict";
import test from "node:test";
import {
  createUtilityControlsMenuCloseAutoFocusHandler,
  resolveUtilityControlsMenuNavigationBadgeLabel,
  resolveUtilityControlsMenuOpenChange,
  resolveUtilityControlsMenuTriggerAriaLabel,
} from "./UtilityControlsMenu.helpers";

test("utility controls menu trigger label reflects the next toggle action", () => {
  assert.equal(
    resolveUtilityControlsMenuTriggerAriaLabel(false, "controls menu"),
    "Open controls menu",
  );
  assert.equal(
    resolveUtilityControlsMenuTriggerAriaLabel(true, "controls menu"),
    "Close controls menu",
  );
});

test("utility controls menu open-change handler tracks open and close transitions", () => {
  const openStates: boolean[] = [];

  resolveUtilityControlsMenuOpenChange(true, (nextOpen) => {
    openStates.push(nextOpen);
  });
  resolveUtilityControlsMenuOpenChange(false, (nextOpen) => {
    openStates.push(nextOpen);
  });

  assert.deepEqual(openStates, [true, false]);
});

test("utility controls menu close autofocus restores focus to the trigger", () => {
  let focused = false;
  const event = new Event("close", { cancelable: true });
  const handleCloseAutoFocus = createUtilityControlsMenuCloseAutoFocusHandler(() => ({
    focus: () => {
      focused = true;
    },
  }));

  handleCloseAutoFocus(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(focused, true);
});

test("utility controls menu navigation badge reflects the active destination", () => {
  assert.equal(resolveUtilityControlsMenuNavigationBadgeLabel(true), "Current");
  assert.equal(resolveUtilityControlsMenuNavigationBadgeLabel(false), "Open");
});
