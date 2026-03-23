import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import {
  PaymentLinkCard,
  resolvePaymentQrPanelStages,
  settlePaymentQrPanelStage,
} from "./PaymentLinkCard";

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

setReactRuntime(reactRuntime);

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
  assert.ok(countElementsWithClass(tree, "payment-card-effects-particle--ambient") > 0);
  assert.equal(countElementsWithClass(tree, "payment-card-effects-particle--lightning"), 0);
  assert.equal(countElementsWithClass(tree, "payment-card-effects-particle--glitter"), 0);
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
  const qrButtons = collectElements(tree).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Hide Bitcoin QR code",
  );
  const copyButtons = collectElements(tree).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );
  const openLinks = collectElements(tree).filter(
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
  const copyButton = collectElements(tree).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );

  assert.ok(copyButton);

  await (copyButton.props.onClick as () => Promise<void>)();

  // Assert
  assert.deepEqual(calls, [{ message: "Bitcoin copied", variant: "default" }]);

  clearActionToastClient();
  restoreNavigator();
});

test("payment cards pass themeFingerprint to inline QR renderers", () => {
  // Arrange
  setReactRuntime(createPreservingRuntime(StyledPaymentQr));

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

  setReactRuntime(reactRuntime);
});

test("payment QR panel stages keep visible panels entered and hidden panels exiting", () => {
  // Arrange
  const currentStages = {
    bitcoin: "entered",
    cashapp: "entered",
  } as const;
  const visibleRailIds = new Set(["bitcoin"]);

  // Act
  const nextStages = resolvePaymentQrPanelStages(currentStages, visibleRailIds, [
    "bitcoin",
    "cashapp",
  ]);

  // Assert
  assert.deepEqual(nextStages, {
    bitcoin: "entered",
    cashapp: "exiting",
  });
});

test("settling an entering payment QR panel marks it entered", () => {
  // Arrange
  const currentStages = {
    bitcoin: "entering",
  } as const;

  // Act
  const nextStages = settlePaymentQrPanelStage(currentStages, "bitcoin");

  // Assert
  assert.deepEqual(nextStages, {
    bitcoin: "entered",
  });
});

test("settling an exiting payment QR panel removes it", () => {
  // Arrange
  const currentStages = {
    bitcoin: "exiting",
  } as const;

  // Act
  const nextStages = settlePaymentQrPanelStage(currentStages, "bitcoin");

  // Assert
  assert.deepEqual(nextStages, {});
});
