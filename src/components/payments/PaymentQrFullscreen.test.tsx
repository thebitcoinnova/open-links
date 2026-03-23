import assert from "node:assert/strict";
import test from "node:test";
import QrCodeDialog from "../qr/QrCodeDialog";
import { PaymentQrFullscreen } from "./PaymentQrFullscreen";

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

test("PaymentQrFullscreen forwards themeFingerprint to QrCodeDialog", () => {
  // Arrange
  setReactRuntime(createPreservingRuntime(QrCodeDialog));

  // Act
  const tree = PaymentQrFullscreen({
    open: true,
    railLabel: "Bitcoin",
    payload: "bitcoin:bc1qexample123",
    themeFingerprint: "sleek:light",
    onClose: () => undefined,
  }) as unknown as RenderedElement;

  // Assert
  assert.equal(tree.type, QrCodeDialog);
  assert.equal(tree.props.themeFingerprint, "sleek:light");

  setReactRuntime(reactRuntime);
});
