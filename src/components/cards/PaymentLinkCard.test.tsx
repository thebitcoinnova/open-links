import assert from "node:assert/strict";
import test from "node:test";
import * as Collapsible from "@kobalte/core/collapsible";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { setPaymentCardEffectDebugTuningValue } from "../../lib/payments/card-effect-debug-tuning";
import { paymentCardEffectDefaultDebugTuning } from "../../lib/payments/card-effect-samples";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
import MobileOverflowMenu from "../actions/MobileOverflowMenu";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import { PaymentLinkCard, resolveMobilePaymentRailActionLayout } from "./PaymentLinkCard";

import {
  RenderedElement,
  type RenderedNode,
  assertSvgRenderOrder,
  clubOrangeLightningPaymentLink,
  collectElements,
  countElementsWithClass,
  createPreservingRuntime,
  decodeSvgDataUrl,
  explicitRailLogoPaymentLink,
  firstElementWithClass,
  firstElementWithProp,
  isRenderedElement,
  lightningPaymentLink,
  mixedProviderMultiRailPaymentLink,
  multiRailPaymentLink,
  originalNavigatorDescriptor,
  paymentLink,
  reactRuntime,
  restoreNavigator,
  setNavigator,
  setReactRuntime,
  site,
  strikeLightningPaymentLink,
} from "./PaymentLinkCard.test-helpers";

test("payment rail copy buttons keep stable copy labels", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const copyButtons = collectElements(tree).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );

  // Assert
  assert.equal(copyButtons.length, 1);
});

test("single-rail payment cards use the compact merged layout and remove duplicate icons", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const article = collectElements(tree).find((element) => element.type === "article");
  const singleLayout = firstElementWithClass(tree, "payment-single-layout");
  const railList = firstElementWithClass(tree, "payment-rails-list");
  const actionBar = firstElementWithClass(tree, "payment-card-action-bar");
  const iconCount = countElementsWithClass(tree, "card-icon");

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-layout"], "single");
  assert.equal(article.props["data-rail-count"], 1);
  assert.ok(singleLayout);
  assert.equal(railList, undefined);
  assert.equal(actionBar, undefined);
  assert.equal(iconCount, 1);
});

test("payment cards keep special effects disabled until a config opts in", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const article = collectElements(tree).find((element) => element.type === "article");
  const effectsLayer = firstElementWithClass(tree, "payment-card-effects");

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-has-effects"], "false");
  assert.equal(effectsLayer, undefined);
});

test("lightning payment cards default to lightning sparks and gold glitter when enabled", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: lightningPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const article = collectElements(tree).find((element) => element.type === "article");
  const effectsLayer = firstElementWithClass(tree, "payment-card-effects");

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-has-effects"], "true");
  assert.ok(effectsLayer);
  assert.equal(effectsLayer.props["data-tone"], "lightning");
  assert.equal(effectsLayer.props["data-glitter-palette"], "gold");
  assert.equal(effectsLayer.props["data-bombasticity"], "0.50");
  assert.match(String(effectsLayer.props["data-active-effects"] ?? ""), /lightning-particles/u);
  assert.match(String(effectsLayer.props["data-active-effects"] ?? ""), /glitter-particles/u);
  assert.ok(countElementsWithClass(tree, "payment-card-effects-particle--lightning") > 0);
  assert.ok(countElementsWithClass(tree, "payment-card-effects-particle--glitter") > 0);
});

test("site payment effect defaults can opt cards into ambient particles", () => {
  // Arrange
  const particleSite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
        },
      },
    },
  } satisfies SiteData;

  const tree = PaymentLinkCard({
    link: paymentLink,
    site: particleSite,
    brandIconOptions: resolveBrandIconOptions(particleSite as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const effectsLayer = firstElementWithClass(tree, "payment-card-effects");

  // Assert
  assert.ok(effectsLayer);
  assert.equal(effectsLayer.props["data-tone"], "default");
  assert.equal(effectsLayer.props["data-bombasticity"], "0.50");
  assert.ok(countElementsWithClass(tree, "payment-card-effects-particle--ambient") > 0);
  assert.equal(countElementsWithClass(tree, "payment-card-effects-particle--lightning"), 0);
  assert.equal(countElementsWithClass(tree, "payment-card-effects-particle--glitter"), 0);
});

test("payment bombasticity at zero disables the effect layer entirely", () => {
  // Arrange
  const zeroBombasticitySite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
          bombasticityDefault: 0,
        },
      },
    },
  } satisfies SiteData;

  const tree = PaymentLinkCard({
    link: paymentLink,
    site: zeroBombasticitySite,
    brandIconOptions: resolveBrandIconOptions(zeroBombasticitySite as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const article = collectElements(tree).find((element) => element.type === "article");
  const effectsLayer = firstElementWithClass(tree, "payment-card-effects");

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-has-effects"], "false");
  assert.equal(effectsLayer, undefined);
});

test("bombasticity ramps up much faster within the first tenth", () => {
  // Arrange
  const lowBombasticitySite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
          bombasticityDefault: 0.01,
        },
      },
    },
  } satisfies SiteData;
  const highBombasticitySite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
          bombasticityDefault: 0.05,
        },
      },
    },
  } satisfies SiteData;

  const lowTree = PaymentLinkCard({
    link: paymentLink,
    site: lowBombasticitySite,
    brandIconOptions: resolveBrandIconOptions(lowBombasticitySite as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;
  const highTree = PaymentLinkCard({
    link: paymentLink,
    site: highBombasticitySite,
    brandIconOptions: resolveBrandIconOptions(highBombasticitySite as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const lowEffectsLayer = firstElementWithClass(lowTree, "payment-card-effects");
  const highEffectsLayer = firstElementWithClass(highTree, "payment-card-effects");
  const lowAmbientCount = countElementsWithClass(lowTree, "payment-card-effects-particle--ambient");
  const highAmbientCount = countElementsWithClass(
    highTree,
    "payment-card-effects-particle--ambient",
  );

  // Assert
  assert.ok(lowEffectsLayer);
  assert.ok(highEffectsLayer);
  assert.equal(lowEffectsLayer.props["data-bombasticity"], "0.01");
  assert.equal(highEffectsLayer.props["data-bombasticity"], "0.05");
  assert.ok(highAmbientCount > lowAmbientCount);
});

test("payment effects plateau once bombasticity reaches the first tenth", () => {
  // Arrange
  const firstMaxSite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
          bombasticityDefault: 0.1,
        },
      },
    },
  } satisfies SiteData;
  const plateauSite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
          bombasticityDefault: 0.5,
        },
      },
    },
  } satisfies SiteData;

  const firstMaxTree = PaymentLinkCard({
    link: paymentLink,
    site: firstMaxSite,
    brandIconOptions: resolveBrandIconOptions(firstMaxSite as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;
  const plateauTree = PaymentLinkCard({
    link: paymentLink,
    site: plateauSite,
    brandIconOptions: resolveBrandIconOptions(plateauSite as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const firstMaxEffectsLayer = firstElementWithClass(firstMaxTree, "payment-card-effects");
  const plateauEffectsLayer = firstElementWithClass(plateauTree, "payment-card-effects");
  const firstMaxAmbientParticle = firstElementWithClass(
    firstMaxTree,
    "payment-card-effects-particle--ambient",
  );
  const plateauAmbientParticle = firstElementWithClass(
    plateauTree,
    "payment-card-effects-particle--ambient",
  );

  // Assert
  assert.ok(firstMaxEffectsLayer);
  assert.ok(plateauEffectsLayer);
  assert.ok(firstMaxAmbientParticle);
  assert.ok(plateauAmbientParticle);
  assert.equal(firstMaxEffectsLayer.props["data-bombasticity"], "0.10");
  assert.equal(plateauEffectsLayer.props["data-bombasticity"], "0.50");
  assert.equal(
    countElementsWithClass(firstMaxTree, "payment-card-effects-particle--ambient"),
    countElementsWithClass(plateauTree, "payment-card-effects-particle--ambient"),
  );
  assert.deepEqual(firstMaxEffectsLayer.props.style, plateauEffectsLayer.props.style);
  assert.deepEqual(firstMaxAmbientParticle.props.style, plateauAmbientParticle.props.style);
});

test("payment link cards pass debug tuning overrides down to the effects layer", () => {
  // Arrange
  const loudSite = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        effects: {
          enabledDefault: true,
          bombasticityDefault: 0.1,
        },
      },
    },
  } satisfies SiteData;
  const debugTuning = setPaymentCardEffectDebugTuningValue({
    tuning: setPaymentCardEffectDebugTuningValue({
      tuning: setPaymentCardEffectDebugTuningValue({
        tuning: paymentCardEffectDefaultDebugTuning,
        groupId: "ambient",
        metricId: "count",
        phase: "low",
        value: 2,
      }),
      groupId: "ambient",
      metricId: "count",
      phase: "mid",
      value: 2,
    }),
    groupId: "ambient",
    metricId: "count",
    phase: "max",
    value: 2,
  });
  const tree = PaymentLinkCard({
    link: paymentLink,
    site: loudSite,
    brandIconOptions: resolveBrandIconOptions(loudSite as SiteData),
    themeFingerprint: "test",
    effectDebugTuning: debugTuning,
  }) as RenderedNode;

  // Act
  const effectsLayer = firstElementWithClass(tree, "payment-card-effects");
  const ambientCount = countElementsWithClass(tree, "payment-card-effects-particle--ambient");

  // Assert
  assert.ok(effectsLayer);
  assert.equal(effectsLayer.props["data-bombasticity"], "0.10");
  assert.equal(ambientCount, 2);
});

test("single-rail payment cards expose inline open, copy, and QR controls", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const desktopActionBar = firstElementWithClass(tree, "payment-rail-actions-desktop");
  const qrButtons = collectElements(desktopActionBar?.props.children as RenderedNode).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Hide Bitcoin QR code",
  );
  const copyButtons = collectElements(desktopActionBar?.props.children as RenderedNode).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );
  const openLinks = collectElements(desktopActionBar?.props.children as RenderedNode).filter(
    (element) => element.type === "a" && element.props["aria-label"] === "Open Bitcoin",
  );
  const fullscreenActivators = collectElements(tree).filter(
    (element) =>
      element.type === "button" &&
      element.props.class === "payment-rail-qr-activator" &&
      element.props["aria-label"] === "Open Full Screen for Bitcoin QR code",
  );
  const actionBar = firstElementWithClass(tree, "payment-card-action-bar");

  // Assert
  assert.equal(qrButtons.length, 1);
  assert.equal(copyButtons.length, 1);
  assert.equal(openLinks.length, 1);
  assert.equal(fullscreenActivators.length, 1);
  assert.equal(actionBar, undefined);
});

test("multi-rail payment cards keep a rails list layout", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: multiRailPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const article = collectElements(tree).find((element) => element.type === "article");
  const singleLayout = firstElementWithClass(tree, "payment-single-layout");
  const railList = firstElementWithClass(tree, "payment-rails-list");
  const railItems = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes("payment-rail-item");
  });

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-layout"], "multi");
  assert.equal(article.props["data-rail-count"], 2);
  assert.equal(singleLayout, undefined);
  assert.ok(railList);
  assert.equal(railItems.length, 2);
});
