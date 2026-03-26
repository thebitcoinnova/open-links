import type { BuildInfo } from "../../src/lib/build-info";
import {
  type DeployTarget,
  getCanonicalUrl,
  getPublicUrl,
  getRobotsMetaContent,
  joinOriginAndRoute,
} from "../../src/lib/deployment-config";

export interface LiveTargetExpectation {
  buildInfoUrl: string;
  expectedCanonicalUrl: string;
  expectedCommitSha?: string;
  expectedRobotsMeta: string;
  publicUrl: string;
  target: DeployTarget;
}

export function buildLiveTargetExpectation(
  target: DeployTarget,
  options: {
    expectedCommitSha?: string;
    publicOrigin?: string;
  } = {},
): LiveTargetExpectation {
  const publicOrigin = normalizePublicBaseUrl(options.publicOrigin) ?? getPublicUrl(target, "/");

  return {
    buildInfoUrl: joinOriginAndRoute(publicOrigin, "/build-info.json"),
    expectedCanonicalUrl: getCanonicalUrl("/"),
    expectedCommitSha: options.expectedCommitSha?.trim() || undefined,
    expectedRobotsMeta: getRobotsMetaContent(target),
    publicUrl: joinOriginAndRoute(publicOrigin, "/"),
    target,
  };
}

export function normalizePublicBaseUrl(input?: string) {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const normalizedPath =
      url.pathname === "/" ? "" : url.pathname.replace(/\/+$/u, "").replace(/^$/, "/");
    return `${url.origin}${normalizedPath}`;
  } catch {
    return undefined;
  }
}

export function assertLiveTargetSnapshot(
  expectation: LiveTargetExpectation,
  input: {
    buildInfo: BuildInfo;
    html: string;
  },
) {
  if (
    !input.html.includes(
      `rel="canonical" href="${expectation.expectedCanonicalUrl.replaceAll('"', "&quot;")}"`,
    )
  ) {
    throw new Error(
      `Expected ${expectation.target} HTML to canonicalize to ${expectation.expectedCanonicalUrl}.`,
    );
  }

  if (!input.html.includes(`name="robots" content="${expectation.expectedRobotsMeta}"`)) {
    throw new Error(
      `Expected ${expectation.target} HTML to include robots '${expectation.expectedRobotsMeta}'.`,
    );
  }

  if (
    expectation.expectedCommitSha &&
    input.buildInfo.commitSha.trim() !== expectation.expectedCommitSha
  ) {
    throw new Error(
      `Expected ${expectation.target} build-info.json to report commit ${expectation.expectedCommitSha}, received '${input.buildInfo.commitSha}'.`,
    );
  }
}
