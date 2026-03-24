import assert from "node:assert/strict";
import test from "node:test";
import { createRoot } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import PaymentCardEffectSamplesRoute from "./payment-card-effect-samples";

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

(
  globalThis as typeof globalThis & {
    React?: typeof reactRuntime;
  }
).React = createPreservingRuntime(PaymentLinkCard);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

const setWindow = (value: Window) => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value,
  });
};

const setDocument = (value: Document) => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value,
  });
};

const restoreGlobals = () => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }

  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "document");
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

const renderRouteTree = (url: string): RenderedNode => {
  const mockDocument = {
    title: "",
    documentElement: {
      dataset: {},
      style: {
        colorScheme: "",
        removeProperty() {},
        setProperty() {},
      },
    },
  } as unknown as Document;
  const mockWindow = {
    location: new URL(url),
    history: {
      replaceState() {},
    },
  } as unknown as Window;

  setDocument(mockDocument);
  setWindow(mockWindow);

  return createRoot((dispose) => {
    const tree = PaymentCardEffectSamplesRoute();
    dispose();
    return tree as RenderedNode;
  });
};

test("payment card effect samples route renders grouped advanced controls and hides the bombasticity slider", () => {
  // Arrange
  const tree = renderRouteTree("https://example.com/spark/tip-cards?ambient-opacity-low=0.27");

  // Act
  const controlGroups = collectElements(tree).filter(
    (element) => typeof element.props["data-payment-card-effect-control-group"] === "string",
  );
  const inputs = collectElements(tree).filter((element) => element.type === "input");
  const resetAllButton = collectElements(tree).find(
    (element) => element.type === "button" && element.props.children === "Reset all",
  );
  const resetAmbientButton = collectElements(tree).find(
    (element) => element.type === "button" && element.props.children === "Reset ambient",
  );

  // Assert
  assert.equal(controlGroups.length, 4);
  assert.ok(resetAllButton);
  assert.ok(resetAmbientButton);
  assert.ok(inputs.some((element) => element.props.id === "ambient-opacity-low"));
  assert.equal(
    inputs.some((element) => element.props.id === "payment-card-bombasticity-slider"),
    false,
  );
});

test("payment card effect samples route shows the active live preview phase badge", () => {
  // Arrange
  const tree = renderRouteTree("https://example.com/spark/tip-cards?bombasticity=0.08");

  // Act
  const previewBadge = collectElements(tree).find(
    (element) => element.props["data-payment-card-effect-preview-phase"] === "max",
  );
  const previewBadgeChildren = Array.isArray(previewBadge?.props.children)
    ? previewBadge.props.children
    : [];
  const previewLabel = previewBadgeChildren[0];

  // Assert
  assert.ok(previewBadge);
  assert.equal(
    isRenderedElement(previewLabel) ? previewLabel.props.children : undefined,
    "Previewing",
  );
});

test("payment card effect samples route hides advanced controls in capture mode", () => {
  // Arrange
  const tree = renderRouteTree(
    "https://example.com/__samples/payment-card-effects?capture=1&fixture=particles",
  );

  // Act
  const controlGroups = collectElements(tree).filter(
    (element) => typeof element.props["data-payment-card-effect-control-group"] === "string",
  );
  const resetAllButton = collectElements(tree).find(
    (element) => element.type === "button" && element.props.children === "Reset all",
  );

  // Assert
  assert.equal(controlGroups.length, 0);
  assert.equal(resetAllButton, undefined);
});

test.afterEach(() => {
  restoreGlobals();
});
