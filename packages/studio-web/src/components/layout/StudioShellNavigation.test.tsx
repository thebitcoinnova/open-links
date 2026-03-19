import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_SHELL_NAV_DIALOG_LABEL,
  STUDIO_SHELL_NAV_LINKS,
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
