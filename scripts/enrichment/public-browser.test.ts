import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  type PublicBrowserJsonResult,
  type PublicBrowserProfileConfig,
  type PublicReferralBrowserCaptureResult,
  capturePublicReferralTextFromBrowser,
  type runPublicBrowserJson,
} from "./public-browser";

const successResponse = (data: unknown): PublicBrowserJsonResult<unknown> => ({
  command: [],
  status: 0,
  stdout: "",
  stderr: "",
  response: {
    success: true,
    data,
  },
});

const createBrowserRunner = (
  handler: (args: string[], config: PublicBrowserProfileConfig) => PublicBrowserJsonResult<unknown>,
) =>
  ((args: string[], config: PublicBrowserProfileConfig) =>
    handler(args, config) as PublicBrowserJsonResult<unknown>) as typeof runPublicBrowserJson;

test("capturePublicReferralTextFromBrowser returns a structured snapshot from eval payload", () => {
  const commands: string[] = [];
  const result = capturePublicReferralTextFromBrowser(
    {
      linkId: "deal",
      sourceUrl: "https://example.com/deal",
      generatedAt: "2026-03-31T00:00:00.000Z",
      browserWaitMs: 2_000,
    },
    {
      runPublicBrowserJsonImpl: createBrowserRunner((args) => {
        commands.push(args.join(" "));
        if (args[0] === "eval") {
          return successResponse({
            result: {
              currentUrl: "https://example.com/deal",
              title: "Example Deal",
              bodyText: "Get $20 off your first order. Supports the project.",
              candidateTexts: ["Get $20 off your first order.", "Supports the project."],
            },
          });
        }

        return successResponse(null);
      }),
    },
  );

  assert.deepEqual(commands.slice(0, 3), [
    "open https://example.com/deal",
    "wait 1500",
    "wait 8000",
  ]);
  assert.match(commands[3] ?? "", /^eval --base64 /u);
  assert.equal(commands[4], "close");
  assert.equal(result.ok, true);
  assert.equal(result.snapshot?.title, "Example Deal");
  assert.deepEqual(result.snapshot?.candidateTexts, [
    "Get $20 off your first order.",
    "Supports the project.",
  ]);
});

test("capturePublicReferralTextFromBrowser reports a usable error when browser eval does not return structured data", () => {
  const result = capturePublicReferralTextFromBrowser(
    {
      linkId: "deal",
      sourceUrl: "https://example.com/deal",
      generatedAt: "2026-03-31T00:00:00.000Z",
      browserWaitMs: 1_000,
    },
    {
      runPublicBrowserJsonImpl: createBrowserRunner((args) => {
        if (args[0] === "eval") {
          return successResponse(null);
        }

        return successResponse(null);
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /did not return structured snapshot data/u);
});
