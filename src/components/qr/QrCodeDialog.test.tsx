import assert from "node:assert/strict";
import test from "node:test";
import AppDialog from "../dialog/AppDialog";
import { resolveQrCodeDialogAriaLabel } from "./QrCodeDialog";
import { QrCodeDialog } from "./QrCodeDialog";
import StyledQrCode from "./StyledQrCode";

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

const collectElements = (node: RenderedNode): RenderedElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectElements(entry));
  }

  if (typeof node !== "object" || node === null || !("type" in node) || !("props" in node)) {
    return [];
  }

  return [
    node as RenderedElement,
    ...collectElements((node as RenderedElement).props.children as RenderedNode),
  ];
};

setReactRuntime(reactRuntime);

test("resolveQrCodeDialogAriaLabel uses the provided title", () => {
  // Arrange
  const title = "GitHub";

  // Act
  const label = resolveQrCodeDialogAriaLabel(title);

  // Assert
  assert.equal(label, "GitHub QR code");
});

test("resolveQrCodeDialogAriaLabel falls back when the title is blank", () => {
  // Arrange
  const title = "   ";

  // Act
  const label = resolveQrCodeDialogAriaLabel(title);

  // Assert
  assert.equal(label, "QR code");
});

test("QrCodeDialog forwards themeFingerprint to the QR renderer", () => {
  // Arrange
  setReactRuntime(createPreservingRuntime(AppDialog, StyledQrCode));

  // Act
  const tree = QrCodeDialog({
    open: true,
    title: "GitHub",
    payload: "https://github.com/openlinks",
    onClose: () => undefined,
    themeFingerprint: "sleek:dark",
  }) as RenderedNode;
  const qrCode = collectElements(tree).find((element) => element.type === StyledQrCode);

  // Assert
  assert.ok(qrCode);
  assert.equal(qrCode.props.themeFingerprint, "sleek:dark");

  setReactRuntime(reactRuntime);
});

test("QrCodeDialog wraps the QR renderer in a centered body container", () => {
  // Arrange
  setReactRuntime(createPreservingRuntime(AppDialog, StyledQrCode));

  // Act
  const tree = QrCodeDialog({
    open: true,
    title: "GitHub",
    payload: "https://github.com/openlinks",
    onClose: () => undefined,
  }) as RenderedNode;
  const body = collectElements(tree).find(
    (element) => element.props.class === "qr-code-dialog-body",
  );

  // Assert
  assert.ok(body);
  assert.ok(
    collectElements(body.props.children as RenderedNode).some(
      (element) => element.type === StyledQrCode,
    ),
  );

  setReactRuntime(reactRuntime);
});
