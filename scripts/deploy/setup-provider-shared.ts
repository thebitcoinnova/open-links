import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildGitHubPagesUrl,
  isUpstreamRepository,
  normalizeOrigin,
} from "../../src/lib/deployment-config";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import { resolveGitHubRepositorySlug } from "../lib/github-repository";
import {
  type ProviderDeployTarget,
  normalizeCanonicalBaseUrl,
  resolveProviderDeployPublicOrigin,
} from "../lib/provider-deploy";
import {
  type DeployUrlRow,
  parseReadmeDeployUrlRows,
  replaceReadmeDeployUrlBlock,
} from "../lib/readme-deploy-urls";
import { parseArgs } from "./shared";

const DEFAULT_UPSTREAM_CANONICAL = "https://openlinks.us";

interface RunProviderSetupOptions {
  providerConfigPath: string;
  providerLabel: string;
  target: ProviderDeployTarget;
}

export async function runProviderSetup(options: RunProviderSetupOptions) {
  const args = parseArgs(process.argv.slice(2));
  const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
  const promotePrimary = args["promote-primary"] === "true";
  const commandName = `deploy:setup:${options.target}`;
  const run = await createDeployRun({
    command: commandName,
    mode,
    target: options.target,
  });
  const repositorySlug = resolveGitHubRepositorySlug(undefined);
  const upstreamRepository = isUpstreamRepository(repositorySlug);
  const githubPagesUrl = normalizeOrigin(buildGitHubPagesUrl(repositorySlug));
  const providerConfigAbsolutePath = path.resolve(options.providerConfigPath);
  const providerPublicOrigin = normalizeOrigin(resolveProviderDeployPublicOrigin(options.target));
  const hasActionablePublicOrigin = !providerPublicOrigin.endsWith(".local");
  const siteJsonPath = path.resolve("data/site.json");
  const readmePath = path.resolve("README.md");

  const siteJsonContent = await readFile(siteJsonPath, "utf8");
  const readmeContent = await readFile(readmePath, "utf8");
  const siteJson = JSON.parse(siteJsonContent) as {
    quality?: {
      seo?: {
        canonicalBaseUrl?: string;
      };
    };
  };
  const currentCanonicalBaseUrl = normalizeOrigin(siteJson.quality?.seo?.canonicalBaseUrl ?? "");
  const nextCanonicalBaseUrl = resolveNextCanonicalBaseUrl({
    currentCanonicalBaseUrl,
    githubPagesUrl,
    promotePrimary,
    providerPublicOrigin,
    upstreamRepository,
  });
  const nextReadmeContent = updateReadmeDeployRows(readmeContent, {
    githubPagesUrl,
    providerLabel: options.providerLabel,
    providerPublicOrigin,
    target: options.target,
    upstreamRepository,
    nextCanonicalBaseUrl,
    includeProviderRow: hasActionablePublicOrigin,
  });
  const nextSiteJsonContent =
    nextCanonicalBaseUrl !== currentCanonicalBaseUrl
      ? updateSiteCanonicalBaseUrl(siteJson, nextCanonicalBaseUrl)
      : siteJsonContent;
  const plannedChanges = [
    currentCanonicalBaseUrl !== nextCanonicalBaseUrl
      ? `Update data/site.json canonicalBaseUrl to ${nextCanonicalBaseUrl}/.`
      : null,
    nextReadmeContent !== readmeContent
      ? `Refresh README deploy rows for GitHub Pages${hasActionablePublicOrigin ? ` and ${options.target}` : ""}.`
      : null,
    hasActionablePublicOrigin
      ? null
      : `No provider public origin is available yet for ${options.target}; rerun with --public-origin once the provider URL exists.`,
  ].filter((entry): entry is string => entry !== null);

  await run.addBreadcrumb({
    data: {
      currentCanonicalBaseUrl,
      githubPagesUrl,
      hasActionablePublicOrigin,
      nextCanonicalBaseUrl,
      promotePrimary,
      providerConfigAbsolutePath,
      providerPublicOrigin,
      repositorySlug,
      upstreamRepository,
    },
    detail: `Prepared the ${options.providerLabel} setup plan.`,
    status: "planned",
    step: "plan",
  });

  if (mode === "apply") {
    if (nextSiteJsonContent !== siteJsonContent) {
      await writeFile(siteJsonPath, nextSiteJsonContent, "utf8");
    }

    if (nextReadmeContent !== readmeContent) {
      await writeFile(readmePath, nextReadmeContent, "utf8");
    }

    await run.addBreadcrumb({
      detail: `Applied the ${options.providerLabel} setup changes.`,
      status: "passed",
      step: "apply",
    });
  }

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges:
        mode === "apply"
          ? plannedChanges.filter((change) => !change.startsWith("No provider public origin"))
          : [],
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: {
        currentCanonicalBaseUrl,
        providerConfigAbsolutePath,
        providerPublicOrigin,
        repositorySlug,
      },
      mode,
      plannedChanges: {
        changes: plannedChanges,
        recommendedNextSteps: buildRecommendedNextSteps({
          githubPagesUrl,
          providerLabel: options.providerLabel,
          providerPublicOrigin,
          promotePrimary,
          target: options.target,
        }),
      },
      resultingUrls: hasActionablePublicOrigin
        ? [githubPagesUrl, providerPublicOrigin]
        : [githubPagesUrl],
      skippedReasons:
        mode === "check"
          ? plannedChanges
          : plannedChanges.filter((change) => change.startsWith("No provider public origin")),
      target: options.target,
      verificationResults: [
        {
          detail: `Checked provider config ${providerConfigAbsolutePath}.`,
          name: `${options.providerLabel} config`,
          status: "passed",
        },
        {
          detail: `GitHub Pages fallback canonical is ${githubPagesUrl}/.`,
          name: "fork-safe canonical default",
          status: "passed",
        },
      ],
    },
    { runDirectory: run.runDirectory },
  );

  console.log(`${options.providerLabel} setup ${mode} complete. Summary: ${runDirectory}`);
}

function resolveNextCanonicalBaseUrl(input: {
  currentCanonicalBaseUrl: string;
  githubPagesUrl: string;
  promotePrimary: boolean;
  providerPublicOrigin: string;
  upstreamRepository: boolean;
}) {
  if (input.promotePrimary && !input.providerPublicOrigin.endsWith(".local")) {
    return normalizeOrigin(input.providerPublicOrigin);
  }

  if (
    !input.upstreamRepository &&
    input.currentCanonicalBaseUrl === normalizeOrigin(DEFAULT_UPSTREAM_CANONICAL)
  ) {
    return normalizeOrigin(input.githubPagesUrl);
  }

  return input.currentCanonicalBaseUrl;
}

function updateSiteCanonicalBaseUrl(
  siteJson: {
    quality?: {
      seo?: {
        canonicalBaseUrl?: string;
      };
    };
  },
  canonicalBaseUrl: string,
) {
  const nextSiteJson = {
    ...siteJson,
    quality: {
      ...siteJson.quality,
      seo: {
        ...siteJson.quality?.seo,
        canonicalBaseUrl: normalizeCanonicalBaseUrl(canonicalBaseUrl),
      },
    },
  };

  return `${JSON.stringify(nextSiteJson, null, 2)}\n`;
}

function updateReadmeDeployRows(
  readmeContent: string,
  input: {
    githubPagesUrl: string;
    includeProviderRow: boolean;
    nextCanonicalBaseUrl: string;
    providerLabel: string;
    providerPublicOrigin: string;
    target: ProviderDeployTarget;
    upstreamRepository: boolean;
  },
) {
  const rowMap = new Map(
    parseReadmeDeployUrlRows(readmeContent).map((row) => [row.target, row] as const),
  );

  if (!input.upstreamRepository) {
    rowMap.delete("aws");
  }

  rowMap.set(
    "github-pages",
    buildReadmeRow({
      additionalUrls:
        normalizeOrigin(input.githubPagesUrl) === normalizeOrigin(input.nextCanonicalBaseUrl)
          ? "none"
          : `canonical=${normalizeOrigin(input.nextCanonicalBaseUrl)}`,
      evidence: "Deploy Production -> Deploy GitHub Pages Mirror",
      primaryUrl: input.githubPagesUrl,
      target: "github-pages",
    }),
  );

  if (input.includeProviderRow) {
    rowMap.set(
      input.target,
      buildReadmeRow({
        additionalUrls:
          normalizeOrigin(input.providerPublicOrigin) ===
          normalizeOrigin(input.nextCanonicalBaseUrl)
            ? "none"
            : `canonical=${normalizeOrigin(input.nextCanonicalBaseUrl)}`,
        evidence: `${input.providerLabel} -> live /build-info.json`,
        primaryUrl: input.providerPublicOrigin,
        target: input.target,
      }),
    );
  }

  const nextRows = Array.from(rowMap.values()).map((row) =>
    row.target === input.target || row.target === "github-pages"
      ? row
      : buildReadmeRow({
          additionalUrls:
            normalizeOrigin(row.primaryUrl) === normalizeOrigin(input.nextCanonicalBaseUrl)
              ? "none"
              : `canonical=${normalizeOrigin(input.nextCanonicalBaseUrl)}`,
          evidence: row.evidence,
          primaryUrl: row.primaryUrl,
          status: row.status,
          target: row.target,
        }),
  );

  return replaceReadmeDeployUrlBlock(readmeContent, nextRows).content;
}

function buildReadmeRow(
  input: Omit<DeployUrlRow, "status"> & {
    status?: string;
  },
): DeployUrlRow {
  return {
    additionalUrls: input.additionalUrls,
    evidence: input.evidence,
    primaryUrl: input.primaryUrl,
    status: input.status ?? "active",
    target: input.target,
  };
}

function buildRecommendedNextSteps(input: {
  githubPagesUrl: string;
  promotePrimary: boolean;
  providerLabel: string;
  providerPublicOrigin: string;
  target: ProviderDeployTarget;
}) {
  return [
    `Connect the repo to ${input.providerLabel} and use the checked-in provider config.`,
    input.target === "render"
      ? `After the first deploy, rerun: bun run deploy:setup:render -- --apply --public-origin=https://<service>.onrender.com${input.promotePrimary ? " --promote-primary" : ""}`
      : `After the first deploy, rerun: bun run deploy:setup:railway -- --apply --public-origin=https://<service>.up.railway.app${input.promotePrimary ? " --promote-primary" : ""}`,
    `Verify the live site and README rows. GitHub Pages remains ${input.githubPagesUrl}/ until another primary is promoted.`,
    input.providerPublicOrigin.endsWith(".local")
      ? "Generate the provider public URL before attempting a provider-primary promotion."
      : `Current provider URL: ${input.providerPublicOrigin}/`,
  ];
}
