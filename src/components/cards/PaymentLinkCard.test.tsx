import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import { PaymentLinkCard } from "./PaymentLinkCard";

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
  assert.equal(copyButtons[0]?.props.children, "Copy");
});

test("payment cards expose a primary QR opener when a primary href exists", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    onPrimaryQrOpen: () => undefined,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const qrButtons = collectElements(tree).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Show Tip Jar QR code",
  );
  const actionBar = firstElementWithClass(tree, "payment-card-action-bar");
  const openLinks = collectElements(tree).filter(
    (element) => element.type === "a" && element.props["aria-label"] === "Open Tip Jar",
  );

  // Assert
  assert.ok(actionBar);
  assert.equal(qrButtons.length, 1);
  assert.equal(openLinks.length, 1);
});

test("payment cards still expose the fullscreen QR button when QR fullscreen is enabled", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const fullscreenButtons = collectElements(tree).filter(
    (element) => element.type === "button" && element.props.children === "Open Full Screen",
  );

  // Assert
  assert.equal(fullscreenButtons.length, 1);
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
