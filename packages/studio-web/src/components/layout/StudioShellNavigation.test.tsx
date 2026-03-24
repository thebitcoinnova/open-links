import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STUDIO_SHELL_NAV_DIALOG_LABEL,
  STUDIO_SHELL_NAV_DRAWER_CLASS,
  STUDIO_SHELL_NAV_LINKS,
  STUDIO_SHELL_NAV_OVERLAY_CLASS,
  STUDIO_SHELL_NAV_POSITIONER_CLASS,
  STUDIO_SHELL_NAV_TRIGGER_LABEL,
  createStudioShellNavigationModel,
} from "./studio-shell-navigation-model";

test("studio shell navigation keeps the shared route list in the expected order", () => {
  assert.deepEqual(
    STUDIO_SHELL_NAV_LINKS.map((link) => [link.href, link.label]),
    [
      ["/onboarding", "Onboarding"],
      ["/roadmap", "Roadmap"],
    ],
  );
});

test("studio shell navigation model exposes the mobile trigger and dialog labels", () => {
  const navigation = createStudioShellNavigationModel();

  assert.equal(navigation.triggerLabel, STUDIO_SHELL_NAV_TRIGGER_LABEL);
  assert.equal(navigation.dialogLabel, STUDIO_SHELL_NAV_DIALOG_LABEL);
  assert.equal(navigation.links, STUDIO_SHELL_NAV_LINKS);
});

test("studio shell navigation exports stable drawer animation hook classes", () => {
  assert.equal(STUDIO_SHELL_NAV_OVERLAY_CLASS, "studio-shell-navigation-overlay");
  assert.equal(STUDIO_SHELL_NAV_POSITIONER_CLASS, "studio-shell-navigation-positioner");
  assert.equal(STUDIO_SHELL_NAV_DRAWER_CLASS, "studio-shell-navigation-drawer");
});

test("studio shell navigation animation hooks stay wired in the shared stylesheet", () => {
  const styles = readFileSync(new URL("../../styles/app.css", import.meta.url), "utf8");

  assert.match(styles, /\.studio-shell-navigation-overlay\s*\{/u);
  assert.match(styles, /\.studio-shell-navigation-overlay\[data-expanded\]\s*\{/u);
  assert.match(styles, /\.studio-shell-navigation-drawer\s*\{/u);
  assert.match(styles, /\.studio-shell-navigation-drawer\[data-expanded\]\s*\{/u);
});
