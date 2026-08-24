export type DeployTarget = "aws" | "github-pages" | "railway" | "render";
export type AwsPriceClass = "PriceClass_100" | "PriceClass_200" | "PriceClass_All";

export interface TrackedDeployTargetConfig {
  priceClass?: AwsPriceClass;
  publicOrigin?: string;
  resourcePrefix?: string;
}

export interface TrackedDeploymentConfig {
  enabledTargets: DeployTarget[];
  primaryTarget: DeployTarget;
  targets: Partial<Record<DeployTarget, TrackedDeployTargetConfig>>;
}

export interface DeployTargetConfig {
  basePath: string;
  id: DeployTarget;
  label: string;
  publicOrigin: string;
  shouldIndex: boolean;
}

export interface DeploymentResolutionState {
  awsPriceClass: AwsPriceClass;
  awsResourcePrefix: string;
  defaultRepositorySlug: string;
  enabledTargets: DeployTarget[];
  githubPagesBasePath: string;
  githubPagesDefaultBasePath: string;
  githubPagesDefaultUrl: string;
  githubPagesOrigin: string;
  primaryCanonicalDomain: string;
  primaryCanonicalOrigin: string;
  primaryTarget: DeployTarget;
  repositorySlug: string;
  targets: Record<DeployTarget, DeployTargetConfig>;
  trackedConfig: TrackedDeploymentConfig;
  upstreamRepository: boolean;
}

export interface DeploymentResolutionOptions {
  env?: Record<string, string | undefined>;
  repositorySlug?: string;
  trackedConfig?: TrackedDeploymentConfig;
}

export interface GitHubRepositoryContext {
  defaultRepositorySlug: string;
  githubPagesOwner: string;
  githubPagesRepository: string;
  repositorySlug: string;
}

export interface GitHubPagesUrlOptions {
  env?: Record<string, string | undefined>;
  publicOrigin?: string;
  trackedConfig?: TrackedDeploymentConfig;
}
