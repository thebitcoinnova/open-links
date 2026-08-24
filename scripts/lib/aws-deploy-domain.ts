import path from "node:path";
import type * as AwsDeploy from "./aws-deploy-contracts";
import { runCommand, runJsonCommand } from "./command";
import { deploymentConfig } from "./effective-deployment-config";

export function ensureAwsCliAvailable() {
  runCommand("aws", ["--version"]);
}

export function getAwsTemplatePath() {
  return path.resolve("infra/aws/static-site.yaml");
}

export function loadAwsCallerIdentity() {
  return runJsonCommand<AwsDeploy.AwsCallerIdentity>("aws", [
    "sts",
    "get-caller-identity",
    "--output",
    "json",
  ]);
}

export function buildSiteBucketName(accountId: string) {
  return `${deploymentConfig.bucketNamePrefix}-${accountId.toLowerCase()}`;
}

export function assessAwsDomainReadiness() {
  const zone = maybeResolveHostedZone(deploymentConfig.primaryCanonicalDomain);
  const entries = [
    {
      domain: deploymentConfig.primaryCanonicalDomain,
      label: "primary canonical host",
      blocker: zone
        ? undefined
        : `No public Route 53 hosted zone covers ${deploymentConfig.primaryCanonicalDomain}. ACM validation and alias records for this host are still blocked until registration, delegation, or hosted-zone setup finishes.`,
      ready: zone !== null,
      zoneId: zone?.id,
    } satisfies AwsDeploy.HostedZoneReadinessEntry,
  ];

  return buildDomainReadinessAssessment(entries);
}

export function formatDomainReadinessMessage(assessment: AwsDeploy.DomainReadinessAssessment) {
  const blockerLines = assessment.blockers.map((blocker) => `- ${blocker}`);
  const domain = assessment.canonical.domain;

  return [
    `AWS domain readiness is still pending for ${domain}.`,
    ...blockerLines,
    "Check mode can still report the pending state, but apply mode must wait until the missing hosted zone exists.",
  ].join("\n");
}

export function buildDomainReadinessAssessment(entries: AwsDeploy.HostedZoneReadinessEntry[]) {
  const canonical = entries[0];
  if (!canonical) {
    throw new Error("Expected a primary canonical AWS host in the deployment config.");
  }

  return {
    all: entries,
    blockers: entries
      .filter((entry) => !entry.ready && entry.blocker)
      .map((entry) => entry.blocker as string),
    canonical,
    ready: entries.every((entry) => entry.ready),
  } satisfies AwsDeploy.DomainReadinessAssessment;
}

export function resolveHostedZones() {
  const readiness = assessAwsDomainReadiness();

  if (!readiness.ready || !readiness.canonical.zoneId) {
    throw new DomainReadinessError(readiness);
  }

  const canonical = {
    domain: readiness.canonical.domain,
    label: readiness.canonical.label,
    zoneId: readiness.canonical.zoneId,
  } satisfies AwsDeploy.ResolvedHostedZoneEntry;

  return {
    all: [canonical],
    canonical,
  } satisfies AwsDeploy.ResolvedHostedZones;
}

export function validateAwsTemplate(templatePath = getAwsTemplatePath()) {
  return runJsonCommand<Record<string, unknown>>("aws", [
    "cloudformation",
    "validate-template",
    "--region",
    deploymentConfig.awsRegion,
    "--template-body",
    `file://${templatePath}`,
    "--output",
    "json",
  ]);
}

export class DomainReadinessError extends Error {
  constructor(readonly assessment: AwsDeploy.DomainReadinessAssessment) {
    super(formatDomainReadinessMessage(assessment));
    this.name = "DomainReadinessError";
  }
}

function maybeResolveHostedZone(domain: string) {
  const candidates = buildHostedZoneCandidates(domain);

  for (const candidate of candidates) {
    const zone = maybeResolveHostedZoneByName(candidate);
    if (zone) {
      return zone;
    }
  }

  return null;
}

function maybeResolveHostedZoneByName(domain: string) {
  const response = runJsonCommand<AwsDeploy.ListHostedZonesResponse>("aws", [
    "route53",
    "list-hosted-zones-by-name",
    "--dns-name",
    domain,
    "--max-items",
    "10",
    "--output",
    "json",
  ]);

  const expectedZoneName = `${domain}.`;
  const maybeZone = response.HostedZones.find(
    (zone) => zone.Name === expectedZoneName && zone.Config?.PrivateZone !== true,
  );

  return maybeZone
    ? {
        id: maybeZone.Id.replace("/hostedzone/", ""),
        name: maybeZone.Name,
      }
    : null;
}

function buildHostedZoneCandidates(domain: string) {
  const labels = domain.split(".");
  const candidates: string[] = [];

  for (let index = 0; index < labels.length - 1; index += 1) {
    candidates.push(labels.slice(index).join("."));
  }

  return candidates;
}
