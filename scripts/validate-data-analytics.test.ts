import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { analyticsHistorySetupIssues } from "./validate-data";

const ROOT = process.cwd();

const writeJsonFile = (relativePath: string, payload: unknown): string => {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return relativePath;
};
test("analytics history setup warns when x is eligible but no follower-history entry exists", (t) => {
  const baseDir = "tmp/tests/analytics-history-warning";
  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { recursive: true, force: true });
  });

  const issues = analyticsHistorySetupIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "x",
          label: "X",
          type: "rich",
          icon: "x",
          enabled: true,
          url: "https://x.com/XSTAC1",
        },
      ],
    },
    siteData: {
      title: "Site",
      description: "Desc",
      theme: { active: "sleek", available: ["sleek"] },
      ui: {},
    },
    indexPath: writeJsonFile(`${baseDir}/index.json`, {
      version: 1,
      updatedAt: "2026-04-01T10:00:00.000Z",
      entries: [],
    }),
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "warning");
  assert.match(
    issues[0]?.message ?? "",
    /analytics-capable links are missing follower-history entries: x/u,
  );
  assert.match(issues[0]?.remediation ?? "", /public:rich:sync -- --only-link x/u);
});

test("analytics history setup stays quiet when x already has a follower-history entry", (t) => {
  const baseDir = "tmp/tests/analytics-history-ok";
  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { recursive: true, force: true });
  });

  const issues = analyticsHistorySetupIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "x",
          label: "X",
          type: "rich",
          icon: "x",
          enabled: true,
          url: "https://x.com/XSTAC1",
        },
      ],
    },
    siteData: {
      title: "Site",
      description: "Desc",
      theme: { active: "sleek", available: ["sleek"] },
      ui: {},
    },
    indexPath: writeJsonFile(`${baseDir}/index.json`, {
      version: 1,
      updatedAt: "2026-04-01T10:00:00.000Z",
      entries: [
        {
          linkId: "x",
          label: "X",
          platform: "x",
          handle: "xstac1",
          canonicalUrl: "https://x.com/XSTAC1",
          audienceKind: "followers",
          csvPath: "history/followers/x.csv",
          latestAudienceCount: 5581,
          latestAudienceCountRaw: "5,581 Followers",
          latestObservedAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    }),
  });

  assert.deepEqual(issues, []);
});

test("analytics history setup warns when a second x link is missing its own history", (t) => {
  const baseDir = "tmp/tests/analytics-history-link-coverage";
  t.after(() => {
    fs.rmSync(path.join(ROOT, baseDir), { recursive: true, force: true });
  });

  const issues = analyticsHistorySetupIssues({
    linksSource: "data/links.json",
    linksData: {
      links: [
        {
          id: "paranoid-bitcoin-anarchists",
          label: "Paranoid Bitcoin Anarchists",
          type: "rich",
          icon: "x",
          enabled: true,
          url: "https://x.com/i/communities/1871996451812769951",
        },
        {
          id: "x",
          label: "X",
          type: "rich",
          icon: "x",
          enabled: true,
          url: "https://x.com/XSTAC1",
        },
      ],
    },
    siteData: {
      title: "Site",
      description: "Desc",
      theme: { active: "sleek", available: ["sleek"] },
      ui: {},
    },
    indexPath: writeJsonFile(`${baseDir}/index.json`, {
      version: 1,
      updatedAt: "2026-04-01T10:00:00.000Z",
      entries: [
        {
          linkId: "x",
          label: "X",
          platform: "x",
          handle: "xstac1",
          canonicalUrl: "https://x.com/XSTAC1",
          audienceKind: "followers",
          csvPath: "history/followers/x.csv",
          latestAudienceCount: 5581,
          latestAudienceCountRaw: "5,581 Followers",
          latestObservedAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    }),
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.level, "warning");
  assert.match(
    issues[0]?.message ?? "",
    /analytics-capable links are missing follower-history entries: paranoid-bitcoin-anarchists/u,
  );
  assert.doesNotMatch(issues[0]?.message ?? "", /entries: x/u);
  assert.match(
    issues[0]?.remediation ?? "",
    /public:rich:sync -- --only-link paranoid-bitcoin-anarchists/u,
  );
  assert.doesNotMatch(issues[0]?.remediation ?? "", /--only-link x/u);
});
