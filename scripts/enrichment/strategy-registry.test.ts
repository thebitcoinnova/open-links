import assert from "node:assert/strict";
import test from "node:test";
import { getAuthenticatedExtractorPlugin } from "../authenticated-extractors/registry";
import { resolvePublicAugmentationTarget } from "./public-augmentation";
import {
  listEnrichmentStrategies,
  resolveEnrichmentStrategy,
  resolvePublicEnrichmentStrategy,
} from "./strategy-registry";

test("resolves the default public-direct strategy for generic rich links", () => {
  // Arrange
  const strategy = resolvePublicEnrichmentStrategy({
    url: "https://bitcoinblacksheep.com/",
  });

  // Assert
  assert.equal(strategy.id, "public-direct-html");
  assert.equal(strategy.branch, "public_direct");
  assert.equal(strategy.sourceKind, "html");
  assert.equal(strategy.source.sourceUrl, "https://bitcoinblacksheep.com/");
});

test("resolves the x public strategy and keeps the legacy adapter aligned", () => {
  // Arrange
  const strategy = resolvePublicEnrichmentStrategy({
    url: "https://x.com/pryszkie",
    icon: "x",
  });
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/pryszkie",
    icon: "x",
  });

  // Assert
  assert.equal(strategy.id, "x-public-oembed");
  assert.equal(strategy.branch, "public_augmented");
  assert.equal(strategy.sourceKind, "oembed");
  assert.ok(target);
  assert.equal(target.id, "x-public-oembed");
  assert.equal(target.sourceUrl, strategy.source.sourceUrl);
  assert.equal(target.acceptHeader, strategy.source.acceptHeader);
});

test("resolves the medium and substack public strategies with their rewritten source urls", () => {
  // Arrange
  const medium = resolvePublicEnrichmentStrategy({
    url: "https://medium.com/@peterryszkiewicz",
    icon: "medium",
  });
  const substack = resolvePublicEnrichmentStrategy({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
    metadataHandle: "@peterryszkiewicz",
  });

  // Assert
  assert.equal(medium.id, "medium-public-feed");
  assert.equal(medium.sourceKind, "xml");
  assert.equal(medium.source.sourceUrl, "https://medium.com/feed/@peterryszkiewicz");
  assert.equal(substack.id, "substack-public-profile");
  assert.equal(substack.source.sourceUrl, "https://substack.com/@peterryszkiewicz");
});

test("resolves the Rumble public strategy to the about page for profile metadata", () => {
  // Arrange
  const strategy = resolvePublicEnrichmentStrategy({
    url: "https://rumble.com/c/InTheLitterBox/videos",
  });
  const target = resolvePublicAugmentationTarget({
    url: "https://rumble.com/c/InTheLitterBox/videos",
  });

  // Assert
  assert.equal(strategy.id, "rumble-public-profile");
  assert.equal(strategy.branch, "public_augmented");
  assert.equal(strategy.sourceKind, "html");
  assert.equal(strategy.source.sourceUrl, "https://rumble.com/c/InTheLitterBox/about");
  assert.ok(target);
  assert.equal(target.id, "rumble-public-profile");
  assert.equal(target.sourceUrl, strategy.source.sourceUrl);
});

test("resolves authenticated strategies and keeps the legacy authenticated adapter aligned", () => {
  // Arrange
  const strategy = resolveEnrichmentStrategy({
    url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
    authenticatedExtractorId: "linkedin-auth-browser",
  });
  const plugin = getAuthenticatedExtractorPlugin("linkedin-auth-browser");

  // Assert
  assert.equal(strategy.id, "linkedin-auth-browser");
  assert.equal(strategy.branch, "authenticated_required");
  assert.equal(strategy.sourceKind, "authenticated_browser");
  assert.ok(plugin);
  assert.equal(plugin.id, "linkedin-auth-browser");
  assert.equal(strategy.branch === "authenticated_required" ? strategy.plugin.id : "", plugin.id);
});

test("lists the current public, authenticated, and default direct strategies", () => {
  // Act
  const strategyIds = listEnrichmentStrategies()
    .map((strategy) => strategy.id)
    .sort();

  // Assert
  assert.deepEqual(strategyIds, [
    "facebook-auth-browser",
    "instagram-public-profile",
    "linkedin-auth-browser",
    "medium-public-feed",
    "primal-public-profile",
    "public-direct-html",
    "rumble-public-profile",
    "substack-public-profile",
    "x-public-oembed",
    "youtube-public-profile",
  ]);
});
