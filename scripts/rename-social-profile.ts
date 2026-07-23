#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { normalizeHandle, resolveHandleFromUrl } from "../src/lib/identity/handle-resolver";
import { resolvePublicEnrichmentStrategy } from "./enrichment/strategy-registry";

interface SocialLink {
  id?: unknown;
  url?: unknown;
  icon?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

interface LinksPayload {
  links?: unknown;
  [key: string]: unknown;
}

interface ProfileLink {
  label?: unknown;
  url?: unknown;
  [key: string]: unknown;
}

interface ProfilePayload {
  profileLinks?: unknown;
  [key: string]: unknown;
}

export interface RenameSocialProfileOptions {
  linkId: string;
  newUrl: string;
  profileLinkLabel?: string;
  apply: boolean;
  confirmSameAccount: boolean;
  linksPath: string;
  profilePath: string;
  historyRoot: string;
}

export interface RenameSocialProfileReport {
  status: "planned" | "applied" | "no_change";
  linkId: string;
  platform: string;
  oldUrl: string;
  newUrl: string;
  oldHandle: string;
  newHandle: string;
  sameAccountConfirmed: boolean;
  profileLinkMatch: {
    status: "matched" | "none";
    index?: number;
    label?: string;
  };
  cacheIdentityChange: boolean;
  history: {
    csvPath: string;
    preChangeRowCount: number;
  };
}

interface RenamePlan {
  report: RenameSocialProfileReport;
  nextLinks: LinksPayload;
  nextProfile: ProfilePayload;
  profileChanged: boolean;
}

const DEFAULT_LINKS_PATH = "data/links.json";
const DEFAULT_PROFILE_PATH = "data/profile.json";
const DEFAULT_HISTORY_ROOT = "public/history/followers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = <T>(filePath: string): T => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${filePath}: ${message}`);
  }
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizedUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

const countHistoryRows = (csvPath: string): number => {
  if (!fs.existsSync(csvPath)) {
    return 0;
  }

  const lines = fs
    .readFileSync(csvPath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.length > 0);
  return Math.max(0, lines.length - 1);
};

const resolveProfileIdentity = (
  url: string,
  icon: string | undefined,
  label: string,
): { platform: string; handle: string } => {
  const resolution = resolveHandleFromUrl({ url, icon });
  if (resolution.reason !== "resolved" || !resolution.extractorId || !resolution.handle) {
    throw new Error(
      `${label} must be a supported social-profile URL with a resolvable handle; got '${url}' (${resolution.reason}).`,
    );
  }

  return {
    platform: resolution.extractorId,
    handle: resolution.handle,
  };
};

const resolveProfileLinkMatch = (input: {
  profileLinks: ProfileLink[];
  oldUrl: string;
  profileLinkLabel?: string;
}): { index?: number; label?: string } => {
  const oldUrl = normalizedUrl(input.oldUrl);
  const expectedLabel = input.profileLinkLabel?.trim().toLowerCase();
  const matches = input.profileLinks
    .map((profileLink, index) => ({ profileLink, index }))
    .filter(({ profileLink }) => {
      if (typeof profileLink.url !== "string" || normalizedUrl(profileLink.url) !== oldUrl) {
        return false;
      }
      if (!expectedLabel) {
        return true;
      }
      return (
        typeof profileLink.label === "string" &&
        profileLink.label.trim().toLowerCase() === expectedLabel
      );
    });

  if (matches.length > 1) {
    throw new Error(
      `Profile-link match is ambiguous for '${input.oldUrl}'. Use --profile-link-label to select exactly one entry.`,
    );
  }
  if (input.profileLinkLabel && matches.length === 0) {
    throw new Error(
      `No profileLinks entry matches '${input.oldUrl}' with label '${input.profileLinkLabel}'.`,
    );
  }

  const match = matches[0];
  return match
    ? {
        index: match.index,
        label: typeof match.profileLink.label === "string" ? match.profileLink.label : undefined,
      }
    : {};
};

export const buildRenameSocialProfilePlan = (
  options: RenameSocialProfileOptions,
  linksPayload: LinksPayload,
  profilePayload: ProfilePayload,
): RenamePlan => {
  if (!Array.isArray(linksPayload.links)) {
    throw new Error(`${options.linksPath} must contain a top-level links array.`);
  }

  const matches = linksPayload.links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => isRecord(link) && link.id === options.linkId);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one links[] entry with id '${options.linkId}', found ${matches.length}.`,
    );
  }

  const matchedLink = matches[0];
  if (!matchedLink || !isRecord(matchedLink.link) || typeof matchedLink.link.url !== "string") {
    throw new Error(`Link '${options.linkId}' must have a URL.`);
  }

  const icon = typeof matchedLink.link.icon === "string" ? matchedLink.link.icon : undefined;
  const oldUrl = matchedLink.link.url;
  const oldIdentity = resolveProfileIdentity(oldUrl, icon, "Existing URL");
  const newIdentity = resolveProfileIdentity(options.newUrl, icon, "New URL");
  if (oldIdentity.platform !== newIdentity.platform) {
    throw new Error(
      `Platform replacement refused: '${oldIdentity.platform}' cannot be renamed to '${newIdentity.platform}'. Create a new link ID for a replacement account.`,
    );
  }

  const oldHandle = normalizeHandle(oldIdentity.handle);
  const newHandle = normalizeHandle(newIdentity.handle);
  if (!oldHandle || !newHandle) {
    throw new Error("Unable to normalize the old and new social-profile handles.");
  }

  const sameHandle = oldHandle === newHandle;
  const sameUrl = normalizedUrl(oldUrl) === normalizedUrl(options.newUrl);
  const noChange = sameHandle && sameUrl;
  if (!noChange && options.apply && !options.confirmSameAccount) {
    throw new Error(
      "Applying a handle rename requires --confirm-same-account. Replacement or uncertain accounts must use a new link ID.",
    );
  }

  const profileLinks = Array.isArray(profilePayload.profileLinks)
    ? profilePayload.profileLinks.map((profileLink) => (isRecord(profileLink) ? profileLink : {}))
    : [];
  const profileLinkMatch = resolveProfileLinkMatch({
    profileLinks,
    oldUrl,
    profileLinkLabel: options.profileLinkLabel,
  });
  const historyPath = path.join(options.historyRoot, `${options.linkId}.csv`);
  const oldSourceUrl = resolvePublicEnrichmentStrategy({
    url: oldUrl,
    icon,
  }).source.sourceUrl;
  const newSourceUrl = resolvePublicEnrichmentStrategy({
    url: options.newUrl,
    icon,
  }).source.sourceUrl;
  const status = noChange ? "no_change" : options.apply ? "applied" : "planned";
  const report: RenameSocialProfileReport = {
    status,
    linkId: options.linkId,
    platform: oldIdentity.platform,
    oldUrl,
    newUrl: options.newUrl,
    oldHandle: oldIdentity.handle,
    newHandle: newIdentity.handle,
    sameAccountConfirmed: options.confirmSameAccount,
    profileLinkMatch:
      profileLinkMatch.index === undefined
        ? { status: "none" }
        : {
            status: "matched",
            index: profileLinkMatch.index,
            label: profileLinkMatch.label,
          },
    cacheIdentityChange: oldSourceUrl !== newSourceUrl,
    history: {
      csvPath: historyPath,
      preChangeRowCount: countHistoryRows(historyPath),
    },
  };

  const nextLinks = cloneJson(linksPayload);
  const nextProfile = cloneJson(profilePayload);
  if (noChange) {
    return {
      report,
      nextLinks,
      nextProfile,
      profileChanged: false,
    };
  }

  const nextLink = (nextLinks.links as SocialLink[])[matchedLink.index];
  if (!nextLink) {
    throw new Error(`Internal error: link '${options.linkId}' disappeared while planning.`);
  }
  nextLink.url = options.newUrl;
  if (isRecord(nextLink.metadata) && typeof nextLink.metadata.handle === "string") {
    const metadataHandle = normalizeHandle(nextLink.metadata.handle);
    if (metadataHandle && metadataHandle !== oldHandle) {
      throw new Error(
        `Link '${options.linkId}' has manual metadata.handle '${nextLink.metadata.handle}' that does not match the old URL. Resolve the identity ambiguity before renaming.`,
      );
    }
    nextLink.metadata.handle = newIdentity.handle;
  }

  if (profileLinkMatch.index !== undefined) {
    const nextProfileLinks = nextProfile.profileLinks;
    if (!Array.isArray(nextProfileLinks) || !isRecord(nextProfileLinks[profileLinkMatch.index])) {
      throw new Error("Internal error: matched profileLinks entry disappeared while planning.");
    }
    nextProfileLinks[profileLinkMatch.index].url = options.newUrl;
  }

  return {
    report,
    nextLinks,
    nextProfile,
    profileChanged: profileLinkMatch.index !== undefined,
  };
};

const writeJsonAtomically = (filePath: string, payload: unknown): string => {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return temporaryPath;
};

const applyRenamePlan = (
  options: RenameSocialProfileOptions,
  plan: RenamePlan,
  originalLinks: string,
): void => {
  if (plan.report.status === "no_change") {
    return;
  }

  const linksTemporaryPath = writeJsonAtomically(options.linksPath, plan.nextLinks);
  const profileTemporaryPath = plan.profileChanged
    ? writeJsonAtomically(options.profilePath, plan.nextProfile)
    : undefined;

  try {
    fs.renameSync(linksTemporaryPath, options.linksPath);
    if (profileTemporaryPath) {
      fs.renameSync(profileTemporaryPath, options.profilePath);
    }
  } catch (error: unknown) {
    if (fs.existsSync(linksTemporaryPath)) {
      fs.rmSync(linksTemporaryPath, { force: true });
    }
    if (profileTemporaryPath && fs.existsSync(profileTemporaryPath)) {
      fs.rmSync(profileTemporaryPath, { force: true });
    }
    fs.writeFileSync(options.linksPath, originalLinks, "utf8");
    throw error;
  }
};

export const runRenameSocialProfile = (
  options: RenameSocialProfileOptions,
): RenameSocialProfileReport => {
  const originalLinks = fs.readFileSync(options.linksPath, "utf8");
  const linksPayload = readJson<LinksPayload>(options.linksPath);
  const profilePayload = readJson<ProfilePayload>(options.profilePath);
  const plan = buildRenameSocialProfilePlan(options, linksPayload, profilePayload);

  if (options.apply) {
    applyRenamePlan(options, plan, originalLinks);
  }

  return plan.report;
};

const flagValue = (argv: string[], flag: string): string | undefined => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};

const usage = (): string =>
  [
    "Usage:",
    "  bun run social:profile:rename -- --link-id <id> --new-url <url>",
    "    [--profile-link-label <label>] [--format json] [--apply --confirm-same-account]",
  ].join("\n");

export const parseRenameSocialProfileArgs = (argv: string[]): RenameSocialProfileOptions => {
  const linkId = flagValue(argv, "--link-id")?.trim();
  const newUrl = flagValue(argv, "--new-url")?.trim();
  if (!linkId || !newUrl) {
    throw new Error(usage());
  }

  return {
    linkId,
    newUrl,
    profileLinkLabel: flagValue(argv, "--profile-link-label"),
    apply: argv.includes("--apply"),
    confirmSameAccount: argv.includes("--confirm-same-account"),
    linksPath: flagValue(argv, "--links") ?? DEFAULT_LINKS_PATH,
    profilePath: flagValue(argv, "--profile") ?? DEFAULT_PROFILE_PATH,
    historyRoot: flagValue(argv, "--history-root") ?? DEFAULT_HISTORY_ROOT,
  };
};

const formatTextReport = (report: RenameSocialProfileReport): string =>
  [
    `Social profile rename: ${report.status}`,
    `Link: ${report.linkId} (${report.platform})`,
    `Handle: ${report.oldHandle} -> ${report.newHandle}`,
    `URL: ${report.oldUrl} -> ${report.newUrl}`,
    `Profile link: ${report.profileLinkMatch.status}`,
    `Cache identity changes: ${report.cacheIdentityChange ? "yes" : "no"}`,
    `History: ${report.history.csvPath} (${report.history.preChangeRowCount} existing rows)`,
  ].join("\n");

if (import.meta.main) {
  try {
    const argv = process.argv.slice(2);
    const options = parseRenameSocialProfileArgs(argv);
    const report = runRenameSocialProfile(options);
    process.stdout.write(
      argv.includes("--format") && flagValue(argv, "--format") === "json"
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${formatTextReport(report)}\n`,
    );
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
