import { describe, expect, test } from "bun:test";
import {
  classifyForkOwnedPaths,
  getForkOwnedPathConfig,
  isForkOwnedPath,
} from "../../src/services/fork-owned-paths.js";

describe("fork-owned path helpers", () => {
  test("marks personalized data and generated identity artifacts as fork-owned", () => {
    expect(isForkOwnedPath("data/profile.json")).toBe(true);
    expect(isForkOwnedPath("public/cache/content-images/example.png")).toBe(true);
    expect(isForkOwnedPath("docs/assets/openlinks-preview.png")).toBe(true);
  });

  test("leaves shared source and docs files outside the fork-owned contract", () => {
    expect(isForkOwnedPath("src/lib/deployment-config.ts")).toBe(false);
    expect(isForkOwnedPath("packages/studio-api/src/services/github-repo.ts")).toBe(false);
    expect(isForkOwnedPath("docs/studio-self-serve.md")).toBe(false);
  });

  test("classifies mixed path sets deterministically", () => {
    expect(
      classifyForkOwnedPaths([
        "src/lib/deployment-config.ts",
        "data/profile.json",
        "public/cache/content-images/example.png",
      ]),
    ).toEqual({
      forkOwnedPaths: ["data/profile.json", "public/cache/content-images/example.png"],
      sharedPaths: ["src/lib/deployment-config.ts"],
    });
  });

  test("exposes the tracked contract for docs and service code", () => {
    const config = getForkOwnedPathConfig();
    expect(config.exactPaths).toContain("data/profile.json");
    expect(config.directoryPrefixes).toContain("public/cache/content-images/");
  });
});
