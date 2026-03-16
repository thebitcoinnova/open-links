import { classifyPagesDeploymentStatus, loadWaitForPagesDeploymentEnv } from "../lib/github-pages";

interface JsonResponseResult<T> {
  rawText: string;
  value: T;
}

const env = loadWaitForPagesDeploymentEnv(process.env);
const timeoutMs = 10 * 60 * 1000;
const pollIntervalMs = 5 * 1000;
const deadline = Date.now() + timeoutMs;

while (true) {
  const { rawText, value: deploymentResponse } = await fetchJson<Record<string, unknown>>(
    `https://api.github.com/repos/${env.githubRepository}/pages/deployments/${env.deploymentId}`,
    {
      headers: {
        Authorization: `Bearer ${env.githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    "Pages deployment status request",
  );

  const phase = classifyPagesDeploymentStatus(deploymentResponse.status);
  if (phase === "success") {
    break;
  }

  if (phase === "failure") {
    console.log(rawText);
    process.exit(1);
  }

  if (Date.now() >= deadline) {
    console.log(`Timed out waiting for Pages deployment ${env.deploymentId}.`);
    console.log(rawText);
    process.exit(1);
  }

  await sleep(pollIntervalMs);
}

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

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
