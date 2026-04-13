import { appendFile } from "node:fs/promises";
import { loadCreatePagesDeploymentEnv, parsePagesDeploymentResponse } from "../lib/github-pages";

interface JsonResponseResult<T> {
  rawText: string;
  value: T;
}

const env = loadCreatePagesDeploymentEnv(process.env);

const { value: oidcTokenResponse } = await fetchJson<Record<string, unknown>>(
  env.actionsIdTokenRequestUrl,
  {
    headers: {
      Authorization: `bearer ${env.actionsIdTokenRequestToken}`,
    },
  },
  "OIDC token request",
);

const oidcToken = getOidcToken(oidcTokenResponse);

const { value: deploymentResponse } = await fetchJson<Record<string, unknown>>(
  `https://api.github.com/repos/${env.githubRepository}/pages/deployments`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      artifact_id: env.artifactId,
      oidc_token: oidcToken,
      pages_build_version: env.pagesBuildVersion,
    }),
  },
  "Pages deployment request",
);

const { deploymentId, maybePageUrl } = parsePagesDeploymentResponse(deploymentResponse);

await appendFile(env.githubOutput, `deployment_id=${deploymentId}\npage_url=${maybePageUrl}\n`);

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  description: string,
): Promise<JsonResponseResult<T>> {
  const response = await fetch(url, init);
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${description} failed (${response.status} ${response.statusText}): ${rawText}`,
    );
  }

  try {
    return {
      rawText,
      value: JSON.parse(rawText) as T,
    };
  } catch {
    throw new Error(`${description} returned invalid JSON: ${rawText}`);
  }
}

function getOidcToken(response: Record<string, unknown>) {
  const maybeToken = response.value;
  if (typeof maybeToken !== "string" || maybeToken.length === 0) {
    throw new Error("OIDC token response did not include a value.");
  }

  return maybeToken;
}
