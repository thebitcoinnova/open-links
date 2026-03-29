import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { detectForkTemplateSeedSignals, runForkReset } from "./reset-fork-template";

const writeJson = (absolutePath: string, payload: unknown) => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const writeText = (absolutePath: string, content: string) => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
};

const seedWorkspace = () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-fork-reset-"));

  writeJson(path.join(rootDir, "data/profile.json"), {
    avatar: "https://avatars.githubusercontent.com/u/3519085?v=4",
    bio: "An agentic engineer.",
    headline: "Peter's OpenLinks",
    name: "Peter Ryszkiewicz",
    profileLinks: [{ label: "GitHub", url: "https://github.com/pRizz" }],
  });
  writeJson(path.join(rootDir, "data/links.json"), {
    links: [
      {
        enabled: true,
        icon: "github",
        id: "github",
        label: "GitHub",
        order: 1,
        type: "rich",
        url: "https://github.com/pRizz",
      },
      {
        enabled: true,
        icon: "openlinks",
        id: "openlinks-home",
        label: "OpenLinks",
        order: 2,
        type: "simple",
        url: "https://openlinks.us",
      },
    ],
  });
  writeJson(path.join(rootDir, "data/site.json"), {
    quality: {
      seo: {
        canonicalBaseUrl: "https://openlinks.us/",
      },
    },
    title: "OpenLinks",
  });
  writeText(
    path.join(rootDir, "README.md"),
    [
      "# OpenLinks",
      "OPENCLAW_DEPLOY_URLS_START",
      "| target | status | primary_url | additional_urls | evidence |",
      "|--------|--------|-------------|-----------------|----------|",
      "| aws | active | https://openlinks.us/ | none | Deploy Production -> Deploy AWS Canonical Site |",
      "| github-pages | active | https://prizz.github.io/open-links/ | canonical=https://openlinks.us/ | Deploy Production -> Deploy GitHub Pages Mirror |",
      "OPENCLAW_DEPLOY_URLS_END",
      "",
    ].join("\n"),
  );

  writeText(path.join(rootDir, "public/badges/openlinks.svg"), "<svg>Peter Ryszkiewicz</svg>\n");
  writeJson(path.join(rootDir, "data/cache/rich-public-cache.json"), {
    entries: { github: { metadata: { title: "Peter Ryszkiewicz" } } },
  });
  writeJson(path.join(rootDir, "data/cache/rich-authenticated-cache.json"), {
    entries: { linkedin: { metadata: { title: "Peter Ryszkiewicz | LinkedIn" } } },
  });
  writeJson(path.join(rootDir, "data/cache/profile-avatar.json"), { resolvedPath: "seeded" });
  writeJson(path.join(rootDir, "data/cache/content-images.json"), {
    entries: { github: { resolvedPath: "cache/content-images/github.jpg" } },
  });
  writeText(path.join(rootDir, "public/cache/content-images/github.jpg"), "seeded");
  writeText(path.join(rootDir, "public/cache/profile-avatar/profile-avatar.jpg"), "seeded");
  writeText(path.join(rootDir, "public/cache/rich-authenticated/.gitkeep"), "");
  writeText(path.join(rootDir, "public/cache/rich-authenticated/linkedin.jpg"), "seeded");
  writeText(path.join(rootDir, "public/history/followers/index.json"), "{}\n");
  writeText(path.join(rootDir, "public/history/followers/github.csv"), "seeded\n");
  writeText(path.join(rootDir, "public/generated/seo/social-preview.png"), "seeded");
  writeText(path.join(rootDir, "public/generated/seo/social-preview.svg"), "seeded");
  writeText(path.join(rootDir, "data/generated/rich-metadata.json"), "{}\n");
  writeText(path.join(rootDir, "data/generated/rich-enrichment-report.json"), "{}\n");

  return rootDir;
};

test("detectForkTemplateSeedSignals finds inherited upstream identity markers", () => {
  const rootDir = seedWorkspace();

  try {
    const signals = detectForkTemplateSeedSignals(rootDir);

    assert.ok(signals.length >= 4);
    assert.match(signals.join("\n"), /seeded upstream identity/u);
    assert.match(signals.join("\n"), /README deploy URLs/u);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test("runForkReset rewrites starter data, clears generated identity artifacts, and empties README deploy rows", () => {
  const rootDir = seedWorkspace();

  try {
    const result = runForkReset({ rootDir });
    const profile = JSON.parse(fs.readFileSync(path.join(rootDir, "data/profile.json"), "utf8"));
    const links = JSON.parse(fs.readFileSync(path.join(rootDir, "data/links.json"), "utf8"));
    const site = JSON.parse(fs.readFileSync(path.join(rootDir, "data/site.json"), "utf8"));
    const followerHistoryIndex = JSON.parse(
      fs.readFileSync(path.join(rootDir, "public/history/followers/index.json"), "utf8"),
    );
    const readme = fs.readFileSync(path.join(rootDir, "README.md"), "utf8");

    assert.equal(result.changed, true);
    assert.deepEqual(profile.name, "Your Name");
    assert.equal(links.links[0]?.url, "https://github.com");
    assert.equal(site.title, "Minimal OpenLinks");
    assert.deepEqual(followerHistoryIndex.entries, []);
    assert.doesNotMatch(readme, /https:\/\/openlinks\.us/u);
    assert.doesNotMatch(readme, /https:\/\/prizz\.github\.io\/open-links/u);
    assert.equal(fs.existsSync(path.join(rootDir, "public/badges/openlinks.svg")), false);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(rootDir, "data/cache/rich-public-cache.json"), "utf8")),
      {
        $schema: "../../schema/rich-public-cache.schema.json",
        entries: {},
        version: 1,
      },
    );
    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(path.join(rootDir, "data/cache/rich-authenticated-cache.json"), "utf8"),
      ),
      {
        $schema: "../../schema/rich-authenticated-cache.schema.json",
        entries: {},
        updatedAt: "1970-01-01T00:00:00.000Z",
        version: 1,
      },
    );
    assert.equal(
      fs.existsSync(path.join(rootDir, "public/cache/content-images/github.jpg")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(rootDir, "public/cache/rich-authenticated/.gitkeep")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(rootDir, "public/cache/rich-authenticated/linkedin.jpg")),
      false,
    );
    assert.equal(fs.existsSync(path.join(rootDir, "public/history/followers/github.csv")), false);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test("runForkReset refuses customized repos without --force", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-links-fork-reset-custom-"));

  try {
    writeJson(path.join(rootDir, "data/profile.json"), { name: "Staci Costopoulos" });
    writeJson(path.join(rootDir, "data/links.json"), {
      links: [{ id: "website", label: "Website", type: "simple", url: "https://example.com" }],
    });
    writeJson(path.join(rootDir, "data/site.json"), { title: "Staci Links" });
    writeText(
      path.join(rootDir, "README.md"),
      [
        "OPENCLAW_DEPLOY_URLS_START",
        "| target | status | primary_url | additional_urls | evidence |",
        "|--------|--------|-------------|-----------------|----------|",
        "OPENCLAW_DEPLOY_URLS_END",
        "",
      ].join("\n"),
    );

    assert.throws(
      () => runForkReset({ rootDir }),
      /Refusing to reset because this repo no longer looks like inherited starter state/u,
    );

    const forcedResult = runForkReset({ force: true, rootDir });
    assert.equal(forcedResult.changed, true);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});
