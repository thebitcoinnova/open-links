import path from "node:path";
import { runCommand } from "./command";
import {
  type DeployTarget,
  normalizeOrigin,
  resolveRailwayPublicOrigin,
  resolveRenderPublicOrigin,
} from "./effective-deployment-config";
import { resolveGitHubRepositorySlug } from "./github-repository";

export type ProviderDeployTarget = Extract<DeployTarget, "railway" | "render">;

type CommandRunner = typeof runCommand;

interface ProviderDeployOptions {
  env?: Record<string, string | undefined>;
  runCommandImpl?: CommandRunner;
}

export function isProviderDeployTarget(value?: string): value is ProviderDeployTarget {
  return value === "railway" || value === "render";
}

export function parseProviderDeployTarget(value?: string): ProviderDeployTarget {
  if (isProviderDeployTarget(value)) {
    return value;
  }

  throw new Error(
    `Unsupported provider deploy target '${value ?? ""}'. Expected 'render' or 'railway'.`,
  );
}

export function resolveProviderDeployPublicOrigin(
  target: ProviderDeployTarget,
  options: ProviderDeployOptions = {},
) {
  const env = options.env ?? process.env;

  return target === "render"
    ? resolveRenderPublicOrigin(env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN, env.RENDER_EXTERNAL_URL)
    : resolveRailwayPublicOrigin(env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN, env.RAILWAY_PUBLIC_DOMAIN);
}

export function buildProviderDeployEnvironment(
  target: ProviderDeployTarget,
  options: ProviderDeployOptions = {},
) {
  const env = options.env ?? process.env;
  const runCommandImpl = options.runCommandImpl ?? runCommand;
  const repositorySlug =
    env.GITHUB_REPOSITORY?.trim() ||
    resolveGitHubRepositorySlug(undefined, {
      env,
      runCommandImpl,
    });
  const publicOrigin = resolveProviderDeployPublicOrigin(target, { env });

  return {
    GITHUB_REPOSITORY: repositorySlug,
    OPENLINKS_DEPLOY_PUBLIC_ORIGIN: publicOrigin,
    OPENLINKS_DEPLOY_TARGET: target,
  } satisfies Record<string, string>;
}

export function getProviderArtifactDirectory(target: ProviderDeployTarget) {
  return path.resolve(".artifacts/deploy", target);
}

export function normalizeCanonicalBaseUrl(publicOrigin: string) {
  return `${normalizeOrigin(publicOrigin)}/`;
}
