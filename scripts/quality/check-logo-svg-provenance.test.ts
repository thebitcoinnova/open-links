import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT_PATH = path.join(ROOT, "scripts/quality/check-logo-svg-provenance.ts");

const createFixture = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-logo-provenance-"));
  fs.mkdirSync(path.join(tempDir, "src/lib/icons"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "public/payment-logos"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "public/branding/openlinks-logo"), { recursive: true });
  return tempDir;
};

const writeFixtureFile = (rootDir: string, relativePath: string, content: string) => {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
};

const runGuard = (cwd: string) =>
  spawnSync("bun", [SCRIPT_PATH], {
    cwd,
    encoding: "utf8",
  });

test("passes when TS custom logo code includes a valid provenance block", (t) => {
  const tempDir = createFixture();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  writeFixtureFile(
    tempDir,
    "src/lib/icons/custom-icons.tsx",
    `/**
 * SVG Logo Provenance
 * Source: https://simpleicons.org/icons/linkedin
 * Method: Copied the LinkedIn mark path from Simple Icons into a local fallback icon component.
 */
export const IconLinkedin = "ok";
`,
  );

  const result = runGuard(tempDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS/u);
});

test("passes when a hand-authored logo SVG asset includes a valid XML provenance comment", (t) => {
  const tempDir = createFixture();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  writeFixtureFile(
    tempDir,
    "public/payment-logos/test.svg",
    `<!--
SVG Logo Provenance
Source: Hand-authored
Method: Simplified in-repo circular payment badge for testing.
Notes: Built for test coverage rather than copied from a vendor SVG.
-->
<svg xmlns="http://www.w3.org/2000/svg"></svg>
`,
  );

  const result = runGuard(tempDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS/u);
});

test("fails when TS custom logo code is missing provenance metadata", (t) => {
  const tempDir = createFixture();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  writeFixtureFile(
    tempDir,
    "src/lib/icons/custom-icons.tsx",
    `export const IconLinkedin = "missing";\n`,
  );

  const result = runGuard(tempDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing_ts_provenance_comment/u);
  assert.match(result.stderr, /IconLinkedin/u);
});

test("fails when a hand-authored logo SVG asset is missing provenance metadata", (t) => {
  const tempDir = createFixture();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  writeFixtureFile(
    tempDir,
    "public/payment-logos/test.svg",
    `<svg xmlns="http://www.w3.org/2000/svg"></svg>\n`,
  );

  const result = runGuard(tempDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing_svg_provenance_comment/u);
  assert.match(result.stderr, /hand-authored logo asset/u);
});

test("fails when a hand-authored provenance block omits Notes", (t) => {
  const tempDir = createFixture();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  writeFixtureFile(
    tempDir,
    "public/payment-logos/test.svg",
    `<!--
SVG Logo Provenance
Source: Hand-authored
Method: Simplified in-repo circular payment badge for testing.
-->
<svg xmlns="http://www.w3.org/2000/svg"></svg>
`,
  );

  const result = runGuard(tempDir);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing_notes_field/u);
});

test("ignores generated logo outputs and simple-icons-only code paths", (t) => {
  const tempDir = createFixture();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  writeFixtureFile(
    tempDir,
    "src/lib/icons/custom-icons.tsx",
    `import type { SimpleIcon } from "simple-icons";
export const createSimpleIcon = (icon: SimpleIcon) => icon;
`,
  );
  writeFixtureFile(
    tempDir,
    "public/branding/openlinks-logo/openlinks-logo.svg",
    `<svg xmlns="http://www.w3.org/2000/svg"></svg>\n`,
  );

  const result = runGuard(tempDir);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS/u);
});
