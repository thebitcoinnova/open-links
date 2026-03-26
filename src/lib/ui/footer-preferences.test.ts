import assert from "node:assert/strict";
import test from "node:test";
import type { SiteData } from "../content/load-content";
import { buildGitHubRepositoryUrl, buildOpenClawBootstrapPrompt } from "../openclaw-prompts";
import { resolveFooterPreferences } from "./footer-preferences";

const createSite = (maybeFooter?: NonNullable<SiteData["ui"]>["footer"]): SiteData => ({
  title: "OpenLinks",
  description: "Personal links",
  theme: {
    active: "sleek",
    available: ["sleek"],
  },
  ...(maybeFooter
    ? {
        ui: {
          footer: maybeFooter,
        },
      }
    : {}),
});

test("resolveFooterPreferences returns the expanded footer defaults", () => {
  const preferences = resolveFooterPreferences(createSite());

  assert.equal(
    preferences.description,
    "OpenLinks is a personal, free, open source, version-controlled links site.\nFork it, customize it, and publish fast.",
  );
  assert.equal(preferences.ctaLabel, "Create Your OpenLinks");
  assert.equal(preferences.ctaUrl, buildGitHubRepositoryUrl());
  assert.equal(preferences.showBuildInfo, true);
  assert.equal(preferences.prompt.enabled, true);
  assert.equal(preferences.prompt.title, "Create your own OpenLinks site");
  assert.equal(
    preferences.prompt.explanation,
    "Paste this bootstrap prompt into OpenClaw, Claude, or Codex to create a new OpenLinks site from this repository.",
  );
  assert.equal(preferences.prompt.text, buildOpenClawBootstrapPrompt());
});

test("resolveFooterPreferences trims custom prompt fields and respects explicit prompt toggles", () => {
  const preferences = resolveFooterPreferences(
    createSite({
      description: "  Custom footer copy  ",
      ctaLabel: "  Launch my fork  ",
      ctaUrl: "  https://example.com/openlinks  ",
      prompt: {
        enabled: false,
        explanation: "  Paste this into your coding agent of choice.  ",
        text: "  Follow the custom bootstrap flow exactly.  ",
        title: "  Bootstrap this fork  ",
      },
      showBuildInfo: false,
      showLastUpdated: false,
    }),
  );

  assert.equal(preferences.description, "Custom footer copy");
  assert.equal(preferences.ctaLabel, "Launch my fork");
  assert.equal(preferences.ctaUrl, "https://example.com/openlinks");
  assert.equal(preferences.showBuildInfo, false);
  assert.deepEqual(preferences.prompt, {
    enabled: false,
    explanation: "Paste this into your coding agent of choice.",
    text: "Follow the custom bootstrap flow exactly.",
    title: "Bootstrap this fork",
  });
});

test("resolveFooterPreferences keeps showBuildInfo precedence over the legacy showLastUpdated flag", () => {
  // Arrange / Act
  const preferences = resolveFooterPreferences(
    createSite({
      showBuildInfo: false,
      showLastUpdated: true,
    }),
  );

  // Assert
  assert.equal(preferences.showBuildInfo, false);
});
