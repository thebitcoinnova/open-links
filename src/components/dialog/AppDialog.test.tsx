import assert from "node:assert/strict";
import test from "node:test";
import { createAppDialogCloseAutoFocusHandler, resolveAppDialogOpenChange } from "./AppDialog";

test("resolveAppDialogOpenChange only closes when the next state is false", () => {
  let closeCalls = 0;

  resolveAppDialogOpenChange(true, () => {
    closeCalls += 1;
  });
  resolveAppDialogOpenChange(false, () => {
    closeCalls += 1;
  });

  assert.equal(closeCalls, 1);
});

test("createAppDialogCloseAutoFocusHandler restores previous focus by default", () => {
  let focused = false;
  const event = new Event("close", { cancelable: true });
  const handler = createAppDialogCloseAutoFocusHandler(() => ({
    focus: () => {
      focused = true;
    },
  }));

  handler(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(focused, true);
});

test("createAppDialogCloseAutoFocusHandler respects a prevented callback event", () => {
  let focused = false;
  const event = new Event("close", { cancelable: true });
  const handler = createAppDialogCloseAutoFocusHandler(
    () => ({
      focus: () => {
        focused = true;
      },
    }),
    (nextEvent) => {
      nextEvent.preventDefault();
    },
  );

  handler(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(focused, false);
});
