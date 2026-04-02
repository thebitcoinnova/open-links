import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type DeployTarget,
  type DeploymentResolutionState,
  getDeploymentState,
  isPlaceholderDeployPublicOrigin,
  normalizeOrigin,
} from "../../src/lib/deployment-config";
import { type DeployUrlRow, replaceReadmeDeployUrlBlock } from "./readme-deploy-urls";

export interface SyncDeploymentTrackedFilesOptions {
  mode: "apply" | "check";
  readmePath?: string;
  sitePath?: string;
  state?: DeploymentResolutionState;
}

export interface SyncDeploymentTrackedFilesResult {
  changedPaths: string[];
  plannedChanges: string[];
  resultingUrls: string[];
  skippedReasons: string[];
}

export async function syncDeploymentTrackedFiles(
  options: SyncDeploymentTrackedFilesOptions,
): Promise<SyncDeploymentTrackedFilesResult> {
  const state = options.state ?? getDeploymentState();
  const readmePath = path.resolve(options.readmePath ?? "README.md");
  const sitePath = path.resolve(options.sitePath ?? "data/site.json");
  const originalReadme = await readFile(readmePath, "utf8");
  const originalSite = await readFile(sitePath, "utf8");
  const nextReadme = replaceReadmeDeployUrlBlock(
    originalReadme,
    buildReadmeDeployRowsFromState(state),
  ).content;
  const nextSite = updateSiteCanonicalBaseUrl(originalSite, state.primaryCanonicalOrigin);
  const changedPaths: string[] = [];
  const plannedChanges: string[] = [];
  const skippedReasons: string[] = [];
  const resultingUrls = state.enabledTargets
    .map((target) => state.targets[target].publicOrigin)
    .filter(
      (origin, index, array) =>
        !isPlaceholderDeployPublicOrigin(origin) && array.indexOf(origin) === index,
    );

  if (nextSite !== originalSite) {
    changedPaths.push(sitePath);
    plannedChanges.push(
      `Sync data/site.json canonicalBaseUrl to ${state.primaryCanonicalOrigin}/.`,
    );
    if (options.mode === "apply") {
      await writeFile(sitePath, nextSite, "utf8");
    }
  }

  if (nextReadme !== originalReadme) {
    changedPaths.push(readmePath);
    plannedChanges.push("Sync README deployment URL rows from config/deployment.json.");
    if (options.mode === "apply") {
      await writeFile(readmePath, nextReadme, "utf8");
    }
  }

  for (const target of state.enabledTargets) {
    if (isPlaceholderDeployPublicOrigin(state.targets[target].publicOrigin)) {
      skippedReasons.push(
        `${target} is enabled but does not yet have a tracked public origin; README deploy rows omit it until the host URL is configured.`,
      );
    }
  }

  return {
    changedPaths,
    plannedChanges,
    resultingUrls,
    skippedReasons,
  };
}

export function buildReadmeDeployRowsFromState(state: DeploymentResolutionState): DeployUrlRow[] {
  return state.enabledTargets
    .filter((target) => !isPlaceholderDeployPublicOrigin(state.targets[target].publicOrigin))
    .map((target) => buildReadmeDeployRow(target, state));
}

function buildReadmeDeployRow(
  target: DeployTarget,
  state: DeploymentResolutionState,
): DeployUrlRow {
  const targetConfig = state.targets[target];
  const additionalUrls = targetConfig.shouldIndex
    ? "none"
    : `canonical=${normalizeOrigin(state.primaryCanonicalOrigin)}`;

  return {
    additionalUrls,
    evidence: buildDeployEvidence(target),
    primaryUrl: targetConfig.publicOrigin,
    status: "active",
    target,
  };
}

function buildDeployEvidence(target: DeployTarget) {
  switch (target) {
    case "aws":
      return "deploy-production.yml -> Deploy AWS Site";
    case "github-pages":
      return "deploy-production.yml -> Deploy GitHub Pages";
    case "railway":
      return "Railway -> live /build-info.json";
    case "render":
      return "Render -> live /build-info.json";
  }
}

function updateSiteCanonicalBaseUrl(siteContent: string, canonicalBaseUrl: string) {
  const siteJson = JSON.parse(siteContent) as {
    quality?: {
      seo?: {
        canonicalBaseUrl?: string;
      };
    };
  };

  const nextSiteJson = {
    ...siteJson,
    quality: {
      ...siteJson.quality,
      seo: {
        ...siteJson.quality?.seo,
        canonicalBaseUrl: `${normalizeOrigin(canonicalBaseUrl)}/`,
      },
    },
  };

  return `${JSON.stringify(nextSiteJson, null, 2)}\n`;
}
