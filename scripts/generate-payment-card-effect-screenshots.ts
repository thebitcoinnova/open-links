import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import {
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  paymentCardEffectSampleFixtures,
} from "../src/lib/payments/card-effect-samples";
import { runCommand } from "./lib/command";

const ROOT = process.cwd();
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = 4174;
const PREVIEW_READY_TIMEOUT_MS = 60_000;

export const DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_DIR = "public/generated/payment-card-effects";

export interface PaymentCardEffectScreenshotOutput {
  fixtureId: string;
  title: string;
  outputPath: string;
  publicPath: string;
}

export interface PaymentCardEffectScreenshotResult extends PaymentCardEffectScreenshotOutput {
  status: "unchanged" | "written";
}

const absolutePath = (rootDir: string, value: string): string =>
  path.isAbsolute(value) ? value : path.join(rootDir, value);

const normalizePublicAssetPath = (value: string): string =>
  `/${value.replace(/^public\//u, "").replace(/\\/gu, "/")}`;

const writeIfChanged = (filePath: string, content: Buffer): "unchanged" | "written" => {
  const currentBuffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;

  if (currentBuffer?.equals(content)) {
    return "unchanged";
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return "written";
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const buildPreviewUrl = (pathname: string): string =>
  `http://${PREVIEW_HOST}:${PREVIEW_PORT}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;

const startPreviewServer = (rootDir: string) => {
  const child = spawn(
    "bunx",
    ["vite", "preview", "--host", PREVIEW_HOST, "--port", `${PREVIEW_PORT}`, "--strictPort"],
    {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";

  child.stdout.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });

  return {
    child,
    readOutput: () => output,
  };
};

const waitForPreviewServer = async (readOutput: () => string) => {
  const url = buildPreviewUrl(PAYMENT_CARD_EFFECT_SAMPLES_PATH);
  const deadline = Date.now() + PREVIEW_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(250);
  }

  const details = readOutput().trim();
  throw new Error(
    details
      ? `Timed out waiting for preview server at ${url}.\n${details}`
      : `Timed out waiting for preview server at ${url}.`,
  );
};

const stopPreviewServer = async (child: ReturnType<typeof startPreviewServer>["child"]) => {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await sleep(250);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await sleep(100);
  }
};

const launchChromium = async () => {
  try {
    return await chromium.launch();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\nInstall the Playwright browser runtime with: bunx playwright install chromium`,
    );
  }
};

export const resolvePaymentCardEffectScreenshotOutputs = (
  rootDir = ROOT,
  outputDir = DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_DIR,
): PaymentCardEffectScreenshotOutput[] =>
  paymentCardEffectSampleFixtures.map((fixture) => {
    const relativeOutputPath = path.posix.join(
      outputDir.replace(/\\/gu, "/"),
      `${fixture.outputFileName}.png`,
    );

    return {
      fixtureId: fixture.id,
      title: fixture.title,
      outputPath: absolutePath(rootDir, relativeOutputPath),
      publicPath: normalizePublicAssetPath(relativeOutputPath),
    };
  });

export const generatePaymentCardEffectScreenshots = async ({
  rootDir = ROOT,
  outputDir = DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_DIR,
}: {
  rootDir?: string;
  outputDir?: string;
} = {}): Promise<PaymentCardEffectScreenshotResult[]> => {
  const outputs = resolvePaymentCardEffectScreenshotOutputs(rootDir, outputDir);

  runCommand("bunx", ["vite", "build"], { cwd: rootDir });

  const previewServer = startPreviewServer(rootDir);

  try {
    await waitForPreviewServer(previewServer.readOutput);

    const browser = await launchChromium();

    try {
      const page = await browser.newPage({
        viewport: {
          width: 1440,
          height: 2200,
        },
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(buildPreviewUrl(PAYMENT_CARD_EFFECT_SAMPLES_PATH), {
        waitUntil: "networkidle",
      });
      await page.locator('main[aria-label="Payment card effect samples"]').waitFor({
        state: "visible",
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const results: PaymentCardEffectScreenshotResult[] = [];

      for (const output of outputs) {
        const locator = page.locator(
          `[data-payment-card-effect-sample="${output.fixtureId}"] .payment-link-card`,
        );
        await locator.waitFor({ state: "visible" });
        const screenshot = await locator.screenshot({
          animations: "disabled",
        });

        results.push({
          ...output,
          status: writeIfChanged(output.outputPath, screenshot),
        });
      }

      return results;
    } finally {
      await browser.close();
    }
  } finally {
    await stopPreviewServer(previewServer.child);
  }
};

if (import.meta.main) {
  try {
    const results = await generatePaymentCardEffectScreenshots();

    for (const result of results) {
      console.log(
        `Payment card effect screenshot: ${result.status} (${path.relative(ROOT, result.outputPath)})`,
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate payment card effect screenshots: ${message}`);
    process.exitCode = 1;
  }
}
