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

type RenderedNode = string | number | boolean | null | undefined | RenderedElement | RenderedNode[];

interface RenderedElement {
  type: unknown;
  props: Record<string, unknown>;
}

const reactRuntime = {
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: RenderedNode[]) {
    const normalizedChildren =
      children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
    const normalizedProps =
      normalizedChildren === undefined
        ? { ...(props ?? {}) }
        : { ...(props ?? {}), children: normalizedChildren };

    if (typeof type === "function") {
      return type(normalizedProps);
    }

    return {
      type,
      props: normalizedProps,
    } satisfies RenderedElement;
  },
  Fragment(props: { children?: RenderedNode }) {
    return props.children ?? null;
  },
};

const createPreservingRuntime = (...preservedTypes: unknown[]) => {
  const preserved = new Set(preservedTypes);

  return {
    ...reactRuntime,
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: RenderedNode[]
    ) {
      const normalizedChildren =
        children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
      const normalizedProps =
        normalizedChildren === undefined
          ? { ...(props ?? {}) }
          : { ...(props ?? {}), children: normalizedChildren };

      if (preserved.has(type)) {
        return {
          type,
          props: normalizedProps,
        } satisfies RenderedElement;
      }

      if (typeof type === "function") {
        return type(normalizedProps);
      }

      return {
        type,
        props: normalizedProps,
      } satisfies RenderedElement;
    },
  };
};

const setReactRuntime = (runtime: typeof reactRuntime) => {
  (
    globalThis as typeof globalThis & {
      React?: typeof reactRuntime;
    }
  ).React = runtime;
};

setReactRuntime(createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content));

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

const setNavigator = (value: Navigator) => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
};

const restoreNavigator = () => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  }
};

const isRenderedElement = (value: RenderedNode): value is RenderedElement =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "type" in value &&
  "props" in value;

const collectElements = (node: RenderedNode): RenderedElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectElements(entry));
  }

  if (!isRenderedElement(node)) {
    return [];
  }

  return [node, ...collectElements(node.props.children as RenderedNode)];
};

const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

const countElementsWithClass = (node: RenderedNode, className: string): number =>
  collectElements(node).filter((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  }).length;

const site = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
  ui: {
    richCards: {
      renderMode: "auto",
      sourceLabelDefault: "show",
      imageTreatment: "cover",
      mobile: {
        imageLayout: "inline",
      },
    },
  },
} as const satisfies SiteData;

const paymentLink = {
  id: "tip-jar",
  label: "Tip Jar",
  type: "payment",
  payment: {
    rails: [
      {
        id: "btc",
        rail: "bitcoin",
        address: "bc1qexample123",
      },
    ],
  },
} as const satisfies OpenLink;

const multiRailPaymentLink = {
  id: "support",
  label: "Support",
  type: "payment",
  payment: {
    rails: [
      {
        id: "btc",
        rail: "bitcoin",
        address: "bc1qexample123",
      },
      {
        id: "patreon",
        rail: "patreon",
        url: "https://patreon.com/example",
      },
    ],
  },
} as const satisfies OpenLink;

const lightningPaymentLink = {
  id: "lightning-tips",
  label: "Lightning Tips",
  type: "payment",
  payment: {
    primaryRailId: "lightning",
    effects: {
      enabled: true,
    },
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
      },
    ],
  },
} as const satisfies OpenLink;

const clubOrangeLightningPaymentLink = {
  id: "cluborange-lightning-tips",
  label: "Club Orange Tips",
  icon: "cluborange",
  type: "payment",
  payment: {
    primaryRailId: "lightning",
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        address: "peterryszkiewicz@cluborange.org",
        qr: {
          badge: {
            mode: "auto",
          },
        },
      },
    ],
  },
} as const satisfies OpenLink;

const decodeSvgDataUrl = (value: string): string => {
  const prefix = "data:image/svg+xml;charset=utf-8,";

  assert.ok(value.startsWith(prefix));
  return decodeURIComponent(value.slice(prefix.length));
};

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
  const fullscreenButtons = collectElements(tree).filter(
    (element) => element.type === "button" && element.props.children === "Open Full Screen",
  );
  const actionBar = firstElementWithClass(tree, "payment-card-action-bar");

  // Assert
  assert.equal(qrButtons.length, 1);
  assert.equal(copyButtons.length, 1);
  assert.equal(openLinks.length, 1);
  assert.equal(fullscreenButtons.length, 1);
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

test("payment rail copy actions emit a toast when clipboard copy succeeds", async () => {
  // Arrange
  const calls: Array<{ message: string; variant: "default" | "error" }> = [];

  registerActionToastClient({
    default: (message: string) => {
      calls.push({ message, variant: "default" });
    },
    error: (message) => {
      calls.push({ message, variant: "error" });
    },
  });

  setNavigator({
    clipboard: {
      writeText: async () => undefined,
    } as unknown as Clipboard,
  } as Navigator);

  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const desktopActionBar = firstElementWithClass(tree, "payment-rail-actions-desktop");
  const copyButton = collectElements(desktopActionBar?.props.children as RenderedNode).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );

  assert.ok(copyButton);

  await (copyButton.props.onClick as () => Promise<void>)();

  // Assert
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.message, "Bitcoin copied");
  assert.equal(calls[0]?.variant, "default");

  clearActionToastClient();
  restoreNavigator();
});

test("payment cards pass themeFingerprint to inline QR renderers", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );

  // Act
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "sleek:dark",
  }) as RenderedNode;
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(qr);
  assert.equal(qr.props.themeFingerprint, "sleek:dark");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("club orange lightning tip cards resolve an auto composite QR badge", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );

  // Act
  const tree = PaymentLinkCard({
    link: clubOrangeLightningPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;
  const article = collectElements(tree).find((element) => element.type === "article");
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-layout"], "single");
  assert.ok(qr);
  assert.equal(qr.props.logoSize, 0.24);
  assert.match(String(qr.props.logoUrl), /^data:image\/svg\+xml/u);

  const svg = decodeSvgDataUrl(String(qr.props.logoUrl));
  assert.match(svg, /#E86B10/u);
  assert.match(svg, /#F2A900/u);

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("mobile payment rail action layout keeps open and QR inline before copy", () => {
  // Act
  const layout = resolveMobilePaymentRailActionLayout(["copy", "open", "qr"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["open", "qr"],
    overflowKinds: ["copy"],
  });
});

test("mobile payment rail action layout keeps two actions inline when copy is already primary", () => {
  // Act
  const layout = resolveMobilePaymentRailActionLayout(["copy", "qr"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["qr", "copy"],
    overflowKinds: [],
  });
});
