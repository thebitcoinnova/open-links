import assert from "node:assert/strict";
import test from "node:test";
import { EDITOR_TABS, resolveEditorTabIds } from "./EditorWorkspace";

test("editor workspace tabs stay in the expected order", () => {
  assert.deepEqual(
    EDITOR_TABS.map((tab) => [tab.value, tab.label]),
    [
      ["profile", "Profile"],
      ["links", "Links"],
      ["site", "Site"],
      ["advanced", "Advanced"],
    ],
  );
});

test("editor workspace tab ids keep each trigger paired with its panel", () => {
  assert.deepEqual(resolveEditorTabIds("profile"), {
    contentId: "editor-panel-profile",
    triggerId: "editor-tab-profile",
  });
  assert.deepEqual(resolveEditorTabIds("advanced"), {
    contentId: "editor-panel-advanced",
    triggerId: "editor-tab-advanced",
  });
});
