import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test, { type TestContext } from "node:test";
import { type RenameSocialProfileOptions, runRenameSocialProfile } from "./rename-social-profile";

const ROOT = process.cwd();

const writeJson = (filePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const createFixture = (
  testContext: TestContext,
  name: string,
  overrides?: {
    links?: unknown;
    profile?: unknown;
    history?: string;
  },
) => {
  const fixtureRoot = path.join(ROOT, "tmp", "tests", "rename-social-profile", name);
  const linksPath = path.join(fixtureRoot, "data", "links.json");
  const profilePath = path.join(fixtureRoot, "data", "profile.json");
  const historyRoot = path.join(fixtureRoot, "public", "history", "followers");
  const historyPath = path.join(historyRoot, "x.csv");

  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  writeJson(
    linksPath,
    overrides?.links ?? {
      links: [
        {
          id: "x",
          label: "X",
          url: "https://x.com/StaciNova",
          type: "rich",
          icon: "x",
          metadata: {
            handle: "StaciNova",
          },
        },
      ],
    },
  );
  writeJson(
    profilePath,
    overrides?.profile ?? {
      name: "Staci",
      profileLinks: [
        {
          label: "X",
          url: "https://x.com/StaciNova",
        },
      ],
    },
  );
  fs.mkdirSync(historyRoot, { recursive: true });
  fs.writeFileSync(
    historyPath,
    overrides?.history ??
      [
        "capturedAt,count,countRaw,metric,handle,canonicalUrl",
        "2025-01-01T00:00:00.000Z,10,10 Followers,followers,XSTAC1,https://x.com/XSTAC1",
        "2026-01-01T00:00:00.000Z,20,20 Followers,followers,StaciNova,https://x.com/StaciNova",
        "",
      ].join("\n"),
    "utf8",
  );

  testContext.after(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  return {
    linksPath,
    profilePath,
    historyRoot,
    historyPath,
  };
};

const optionsFor = (
  fixture: ReturnType<typeof createFixture>,
  overrides?: Partial<RenameSocialProfileOptions>,
): RenameSocialProfileOptions => ({
  linkId: "x",
  newUrl: "https://x.com/StacingSats",
  apply: false,
  confirmSameAccount: false,
  linksPath: fixture.linksPath,
  profilePath: fixture.profilePath,
  historyRoot: fixture.historyRoot,
  ...overrides,
});

test("dry-run returns a structured rename plan without changing files", (t) => {
  // Arrange
  const fixture = createFixture(t, "dry-run");
  const linksBefore = fs.readFileSync(fixture.linksPath, "utf8");
  const profileBefore = fs.readFileSync(fixture.profilePath, "utf8");
  const historyBefore = fs.readFileSync(fixture.historyPath, "utf8");

  // Act
  const report = runRenameSocialProfile(optionsFor(fixture));

  // Assert
  assert.equal(report.status, "planned");
  assert.equal(report.linkId, "x");
  assert.equal(report.platform, "x");
  assert.equal(report.oldHandle, "stacinova");
  assert.equal(report.newHandle, "stacingsats");
  assert.equal(report.profileLinkMatch.status, "matched");
  assert.equal(report.profileLinkMatch.index, 0);
  assert.equal(report.cacheIdentityChange, true);
  assert.equal(report.history.csvPath, fixture.historyPath);
  assert.equal(report.history.preChangeRowCount, 2);
  assert.equal(fs.readFileSync(fixture.linksPath, "utf8"), linksBefore);
  assert.equal(fs.readFileSync(fixture.profilePath, "utf8"), profileBefore);
  assert.equal(fs.readFileSync(fixture.historyPath, "utf8"), historyBefore);
});

test("apply updates link and profile JSON atomically while leaving history untouched", (t) => {
  // Arrange
  const fixture = createFixture(t, "apply");
  const historyBefore = fs.readFileSync(fixture.historyPath, "utf8");

  // Act
  const report = runRenameSocialProfile(
    optionsFor(fixture, {
      apply: true,
      confirmSameAccount: true,
    }),
  );
  const links = JSON.parse(fs.readFileSync(fixture.linksPath, "utf8")) as {
    links: Array<{ url: string; metadata: { handle: string } }>;
  };
  const profile = JSON.parse(fs.readFileSync(fixture.profilePath, "utf8")) as {
    profileLinks: Array<{ url: string }>;
  };

  // Assert
  assert.equal(report.status, "applied");
  assert.equal(links.links[0]?.url, "https://x.com/StacingSats");
  assert.equal(links.links[0]?.metadata.handle, "stacingsats");
  assert.equal(profile.profileLinks[0]?.url, "https://x.com/StacingSats");
  assert.equal(fs.readFileSync(fixture.historyPath, "utf8"), historyBefore);
});

test("apply refuses an unconfirmed replacement or uncertain account", (t) => {
  // Arrange
  const fixture = createFixture(t, "confirmation");

  // Act / Assert
  assert.throws(
    () =>
      runRenameSocialProfile(
        optionsFor(fixture, {
          apply: true,
        }),
      ),
    /requires --confirm-same-account/u,
  );
});

test("rename refuses platform replacements", (t) => {
  // Arrange
  const fixture = createFixture(t, "platform-replacement");

  // Act / Assert
  assert.throws(
    () =>
      runRenameSocialProfile(
        optionsFor(fixture, {
          newUrl: "https://github.com/StacingSats",
        }),
      ),
    /Platform replacement refused/u,
  );
});

test("rename refuses ambiguous profile-link matches", (t) => {
  // Arrange
  const fixture = createFixture(t, "ambiguous-profile-link", {
    profile: {
      name: "Staci",
      profileLinks: [
        { label: "X", url: "https://x.com/StaciNova" },
        { label: "Social", url: "https://x.com/StaciNova" },
      ],
    },
  });

  // Act / Assert
  assert.throws(
    () => runRenameSocialProfile(optionsFor(fixture)),
    /Profile-link match is ambiguous/u,
  );
});

test("profile-link label selects exactly one ambiguous URL match", (t) => {
  // Arrange
  const fixture = createFixture(t, "profile-link-label", {
    profile: {
      name: "Staci",
      profileLinks: [
        { label: "X", url: "https://x.com/StaciNova" },
        { label: "Social", url: "https://x.com/StaciNova" },
      ],
    },
  });

  // Act
  const report = runRenameSocialProfile(
    optionsFor(fixture, {
      profileLinkLabel: "Social",
    }),
  );

  // Assert
  assert.equal(report.profileLinkMatch.status, "matched");
  assert.equal(report.profileLinkMatch.index, 1);
  assert.equal(report.profileLinkMatch.label, "Social");
});

test("identical URL and handle are a no-op", (t) => {
  // Arrange
  const fixture = createFixture(t, "no-op");
  const linksBefore = fs.readFileSync(fixture.linksPath, "utf8");

  // Act
  const report = runRenameSocialProfile(
    optionsFor(fixture, {
      newUrl: "https://x.com/StaciNova",
      apply: true,
    }),
  );

  // Assert
  assert.equal(report.status, "no_change");
  assert.equal(report.cacheIdentityChange, false);
  assert.equal(fs.readFileSync(fixture.linksPath, "utf8"), linksBefore);
});
