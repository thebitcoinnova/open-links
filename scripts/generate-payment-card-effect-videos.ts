import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import {
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  buildPaymentCardEffectCaptureSearchParams,
  createPaymentCardEffectVideoScenarios,
} from "../src/lib/payments/card-effect-samples";
import { runCommand } from "./lib/command";

const ROOT = process.cwd();
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = 4175;
const PREVIEW_READY_TIMEOUT_MS = 60_000;
const VIDEO_DURATION_SECONDS = 2;
const VIDEO_FRAMES_PER_SECOND = 12;
const VIDEO_FRAME_COUNT = VIDEO_DURATION_SECONDS * VIDEO_FRAMES_PER_SECOND;
const VIDEO_CAPTURE_INTERVAL_MS = 1000 / VIDEO_FRAMES_PER_SECOND;
const VIDEO_VIEWPORT = { width: 960, height: 1280 } as const;
export const DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_DIR = "public/generated/payment-card-effects/videos";
export const DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_TEMP_DIR =
  "output/playwright/payment-card-effects/videos";

export interface PaymentCardEffectVideoOutput {
  fixtureId: string;
  title: string;
  bombasticity: number;
  outputPath: string;
  publicPath: string;
  tempFramesDir: string;
}

export interface PaymentCardEffectVideoResult extends PaymentCardEffectVideoOutput {
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

const buildPreviewUrl = (pathname: string, searchParams?: URLSearchParams): string => {
  const url = new URL(
    `${pathname.startsWith("/") ? pathname : `/${pathname}`}`,
    `http://${PREVIEW_HOST}:${PREVIEW_PORT}`,
  );

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
};

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

const removeDirectoryContents = (directoryPath: string): void => {
  fs.rmSync(directoryPath, { force: true, recursive: true });
  fs.mkdirSync(directoryPath, { recursive: true });
};

const renderVideoFromFrames = ({
  framesDir,
  outputPath,
}: {
  framesDir: string;
  outputPath: string;
}): Buffer => {
  const tempOutputPath = `${outputPath}.tmp.webm`;
  fs.mkdirSync(path.dirname(tempOutputPath), { recursive: true });
  fs.rmSync(tempOutputPath, { force: true });

  runCommand("ffmpeg", [
    "-y",
    "-framerate",
    `${VIDEO_FRAMES_PER_SECOND}`,
    "-i",
    path.join(framesDir, "frame-%03d.png"),
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuva420p",
    "-b:v",
    "0",
    "-crf",
    "40",
    "-an",
    tempOutputPath,
  ]);

  const buffer = fs.readFileSync(tempOutputPath);
  fs.rmSync(tempOutputPath, { force: true });
  return buffer;
};

export const resolvePaymentCardEffectVideoOutputs = (
  rootDir = ROOT,
  outputDir = DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_DIR,
  tempDir = DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_TEMP_DIR,
): PaymentCardEffectVideoOutput[] =>
  createPaymentCardEffectVideoScenarios().map((scenario) => {
    const relativeOutputPath = path.posix.join(
      outputDir.replace(/\\/gu, "/"),
      `${scenario.outputFileName}.webm`,
    );
    const relativeTempFramesDir = path.posix.join(
      tempDir.replace(/\\/gu, "/"),
      scenario.outputFileName,
    );

    return {
      fixtureId: scenario.fixtureId,
      title: scenario.title,
      bombasticity: scenario.bombasticity,
      outputPath: absolutePath(rootDir, relativeOutputPath),
      publicPath: normalizePublicAssetPath(relativeOutputPath),
      tempFramesDir: absolutePath(rootDir, relativeTempFramesDir),
    };
  });

export const generatePaymentCardEffectVideos = async ({
  rootDir = ROOT,
  outputDir = DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_DIR,
  tempDir = DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_TEMP_DIR,
}: {
  rootDir?: string;
  outputDir?: string;
  tempDir?: string;
} = {}): Promise<PaymentCardEffectVideoResult[]> => {
  const outputs = resolvePaymentCardEffectVideoOutputs(rootDir, outputDir, tempDir);

  runCommand("bunx", ["vite", "build"], { cwd: rootDir });

  const previewServer = startPreviewServer(rootDir);

  try {
    await waitForPreviewServer(previewServer.readOutput);

    const browser = await launchChromium();

    try {
      const page = await browser.newPage({
        viewport: VIDEO_VIEWPORT,
      });
      const results: PaymentCardEffectVideoResult[] = [];

      for (const output of outputs) {
        removeDirectoryContents(output.tempFramesDir);

        await page.goto(
          buildPreviewUrl(
            PAYMENT_CARD_EFFECT_SAMPLES_PATH,
            buildPaymentCardEffectCaptureSearchParams({
              fixtureId: output.fixtureId,
              bombasticity: output.bombasticity,
            }),
          ),
          { waitUntil: "networkidle" },
        );
        await page.locator('main[aria-label="Payment card effect samples"]').waitFor({
          state: "visible",
        });
        await page.evaluate(async () => {
          await document.fonts.ready;
        });

        const locator = page.locator(
          `[data-payment-card-effect-sample="${output.fixtureId}"] .payment-link-card`,
        );
        await locator.waitFor({ state: "visible" });

        for (let frameIndex = 0; frameIndex < VIDEO_FRAME_COUNT; frameIndex += 1) {
          const screenshotPath = path.join(
            output.tempFramesDir,
            `frame-${String(frameIndex).padStart(3, "0")}.png`,
          );

          await locator.screenshot({
            path: screenshotPath,
            animations: "allow",
          });

          if (frameIndex < VIDEO_FRAME_COUNT - 1) {
            await page.waitForTimeout(VIDEO_CAPTURE_INTERVAL_MS);
          }
        }

        const encodedVideo = renderVideoFromFrames({
          framesDir: output.tempFramesDir,
          outputPath: output.outputPath,
        });

        results.push({
          ...output,
          status: writeIfChanged(output.outputPath, encodedVideo),
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
    const results = await generatePaymentCardEffectVideos();

    for (const result of results) {
      console.log(
        `Payment card effect video: ${result.status} (${path.relative(ROOT, result.outputPath)})`,
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate payment card effect videos: ${message}`);
    process.exitCode = 1;
  }
}
