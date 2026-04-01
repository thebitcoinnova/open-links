import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const DIST_ASSETS_DIR = path.join(ROOT, "dist", "assets");

const readBuiltMainBundle = (): string => {
  const bundleNames = fs
    .readdirSync(DIST_ASSETS_DIR)
    .filter((name) => name.startsWith("index-") && name.endsWith(".js"))
    .sort();

  assert.ok(
    bundleNames.length > 0,
    "Expected a built main bundle in dist/assets. Run `bun run build` before this smoke test.",
  );

  const bundlePath = path.join(DIST_ASSETS_DIR, bundleNames[0] as string);
  return fs.readFileSync(bundlePath, "utf8");
};

test("built bundle inlines runtime asset and catalog manifests", () => {
  // Arrange
  const builtBundle = readBuiltMainBundle();

  // Assert
  assert.doesNotMatch(builtBundle, /import\.meta\.glob/u);
  assert.match(builtBundle, /cache\/profile-avatar\/profile-avatar\.jpg/u);
  assert.match(builtBundle, /cache\/content-images\//u);
  assert.match(builtBundle, /link:[a-z0-9-]+:image/u);
  assert.match(builtBundle, /club-orange-signup/u);
  assert.match(builtBundle, /club-orange-signup-co-path/u);
});
