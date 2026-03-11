import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
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

(
  globalThis as typeof globalThis & {
    React?: typeof reactRuntime;
  }
).React = reactRuntime;

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
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  const copyButtons = collectElements(tree).filter(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );

  assert.equal(copyButtons.length, 1);
  assert.equal(copyButtons[0]?.props.children, "Copy");
});

test("payment rail copy actions emit a toast when clipboard copy succeeds", async () => {
  const calls: Array<{ message: string; variant: "error" | "info" | "success" }> = [];

  registerActionToastClient({
    error: (message) => {
      calls.push({ message, variant: "error" });
    },
    info: (message) => {
      calls.push({ message, variant: "info" });
    },
    success: (message) => {
      calls.push({ message, variant: "success" });
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

  const copyButton = collectElements(tree).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );

  assert.ok(copyButton);

  await (copyButton.props.onClick as () => Promise<void>)();

  assert.deepEqual(calls, [{ message: "Bitcoin copied", variant: "success" }]);

  clearActionToastClient();
  restoreNavigator();
});
