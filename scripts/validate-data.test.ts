import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  collectReferralCatalogIssues,
  pathTouchesHookRichArtifactInputs,
  resolveHookRichArtifactCheckDecision,
} from "./validate-data";

const ROOT = process.cwd();

const writeChangedPathsFile = (relativePath: string, entries: string[]): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${entries.join("\n")}\n`, "utf8");
  return relativePath;
};

const writeJsonFile = (relativePath: string, payload: unknown): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return relativePath;
};

test("hook mode skips generated rich-artifact checks for unrelated staged script paths", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-skip-paths.txt", [
    "scripts/quality/perf.ts",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, false);
  assert.equal(
    decision.humanNote,
    "Hook mode skipped generated rich-artifact checks because staged paths did not touch rich metadata/image inputs.",
  );
});

test("hook mode enforces generated rich-artifact checks when data links change", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-links-paths.txt", [
    "data/links.json",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.humanNote, undefined);
});

test("hook mode enforces generated rich-artifact checks when content-image sync inputs change", (t) => {
  // Arrange
  const changedPathsFile = writeChangedPathsFile("tmp/tests/hook-images-paths.txt", [
    "scripts/sync-content-images.ts",
  ]);
  t.after(() => {
    fs.rmSync(path.join(ROOT, changedPathsFile), { force: true });
  });

  // Act
  const decision = resolveHookRichArtifactCheckDecision({
    mode: "hook",
    changedPathsFile,
  });

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.humanNote, undefined);
});

test("hook mode falls back to full validation when no changed-paths file is provided", () => {
  // Arrange
  const input = {
    mode: "hook" as const,
  };

  // Act
  const decision = resolveHookRichArtifactCheckDecision(input);

  // Assert
  assert.equal(decision.shouldRun, true);
  assert.match(decision.humanNote ?? "", /fell back to full validation/u);
});

test("rich-artifact trigger matcher covers exact and prefix-based hook paths", () => {
  // Arrange
  const exactMatch = "data/cache/content-images.json";
  const prefixMatch = "public/cache/content-images/example.jpg";
  const generatedSeoMatch = "public/generated/seo/social-preview.png";
  const legacyPath = "data/generated/content-images.json";
  const avatarTrigger = "scripts/sync-profile-avatar.ts";
  const socialPreviewTrigger = "scripts/generate-site-social-preview.ts";
  const policyTrigger = "data/policy/remote-cache-policy.json";
  const localPolicyTrigger = "data/policy/remote-cache-policy.local.json";
  const nonMatch = "scripts/quality/perf.ts";

  // Act
  const exactTriggered = pathTouchesHookRichArtifactInputs(exactMatch);
  const prefixTriggered = pathTouchesHookRichArtifactInputs(prefixMatch);
  const generatedSeoTriggered = pathTouchesHookRichArtifactInputs(generatedSeoMatch);
  const legacyTriggered = pathTouchesHookRichArtifactInputs(legacyPath);
  const avatarTriggered = pathTouchesHookRichArtifactInputs(avatarTrigger);
  const socialPreviewTriggered = pathTouchesHookRichArtifactInputs(socialPreviewTrigger);
  const policyTriggered = pathTouchesHookRichArtifactInputs(policyTrigger);
  const localPolicyTriggered = pathTouchesHookRichArtifactInputs(localPolicyTrigger);
  const unrelatedTriggered = pathTouchesHookRichArtifactInputs(nonMatch);

  // Assert
  assert.equal(exactTriggered, true);
  assert.equal(prefixTriggered, true);
  assert.equal(generatedSeoTriggered, true);
  assert.equal(legacyTriggered, false);
  assert.equal(avatarTriggered, true);
  assert.equal(socialPreviewTriggered, true);
  assert.equal(policyTriggered, true);
  assert.equal(localPolicyTriggered, true);
  assert.equal(unrelatedTriggered, false);
});

test("referral catalog validation allows a missing optional local overlay file", (t) => {
  const baseDir = "tmp/tests/referral-catalog-no-overlay";
  const catalogPath = writeJsonFile(`${baseDir}/referral-catalog.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange",
        kind: "referral",
        canonicalProgramUrl: "https://www.cluborange.org/signup",
      },
    ],
    offers: [
      {
        offerId: "club-orange-signup",
        familyId: "club-orange",
        label: "Club Orange signup referral",
      },
    ],
    matchers: [
      {
        matcherId: "club-orange-signup-co-path",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Hosted signup path code",
        explanation: "Uses /co/<code> links.",
        hosts: ["signup.cluborange.org"],
        pathPrefix: "/co/",
      },
    ],
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = collectReferralCatalogIssues({
    catalogPath,
    linksData: { links: [] },
    linksSource: "data/links.json",
    localCatalogPath: `${baseDir}/referral-catalog.local.json`,
  });

  assert.deepEqual(issues, []);
});

test("referral catalog validation reports malformed local overlay payloads", (t) => {
  const baseDir = "tmp/tests/referral-catalog-bad-overlay";
  const catalogPath = writeJsonFile(`${baseDir}/referral-catalog.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [],
    offers: [],
    matchers: [],
  });
  const localCatalogPath = writeJsonFile(`${baseDir}/referral-catalog.local.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: {},
    offers: [],
    matchers: [],
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = collectReferralCatalogIssues({
    catalogPath,
    linksData: { links: [] },
    linksSource: "data/links.json",
    localCatalogPath,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.source, localCatalogPath);
  assert.match(issues[0]?.path ?? "", /\$\.families/u);
  assert.match(issues[0]?.message ?? "", /must be array/u);
});

test("referral catalog validation reports duplicate ids and broken link references", (t) => {
  const baseDir = "tmp/tests/referral-catalog-bad-refs";
  const catalogPath = writeJsonFile(`${baseDir}/referral-catalog.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange",
        kind: "referral",
        canonicalProgramUrl: "https://www.cluborange.org/signup",
      },
    ],
    offers: [
      {
        offerId: "club-orange-signup",
        familyId: "missing-family",
        label: "Club Orange signup referral",
      },
    ],
    matchers: [
      {
        matcherId: "club-orange-signup-query-referral",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Canonical signup referral query",
        explanation: "Uses ?referral=<code> on /signup.",
        hosts: ["www.cluborange.org"],
        pathExact: "/signup",
        requiredQueryKeys: ["referral"],
      },
    ],
  });
  const localCatalogPath = writeJsonFile(`${baseDir}/referral-catalog.local.json`, {
    $schema: "../../schema/referral-catalog.schema.json",
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange override",
        kind: "referral",
        canonicalProgramUrl: "https://fork.example.com/club-orange",
      },
      {
        familyId: "club-orange",
        label: "Club Orange duplicate override",
        kind: "referral",
        canonicalProgramUrl: "https://fork.example.com/club-orange-duplicate",
      },
    ],
    offers: [],
    matchers: [],
  });

  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { force: true, recursive: true });
  });

  const issues = collectReferralCatalogIssues({
    catalogPath,
    linksData: {
      links: [
        {
          id: "cluborange-referral",
          referral: {
            catalogRef: {
              familyId: "club-orange",
              offerId: "club-orange-signup",
              matcherId: "missing-matcher",
            },
          },
        },
      ],
    },
    linksSource: "data/links.json",
    localCatalogPath,
  });

  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /Duplicate referral catalog family id 'club-orange'/u,
  );
  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /offer 'club-orange-signup' references unknown familyId 'missing-family'/u,
  );
  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /references unknown referral catalog matcherId 'missing-matcher'/u,
  );
  assert.match(
    issues.map((issue) => `${issue.source} ${issue.path} ${issue.message}`).join("\n"),
    /mixes familyId 'club-orange' with offerId 'club-orange-signup' from family 'missing-family'/u,
  );
});
