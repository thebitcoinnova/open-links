import assert from "node:assert/strict";
import test from "node:test";
import { copyToClipboard } from "./copy-to-clipboard";

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

const setNavigator = (value: Navigator) => {
  Object.defineProperty(globalThis, "navigator", {
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
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
  }
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
  }
};

test("copyToClipboard uses navigator.clipboard when available", async () => {
  let copiedValue = "";

  setNavigator({
    clipboard: {
      writeText: async (value: string) => {
        copiedValue = value;
      },
    } as Clipboard,
  } as Navigator);

  const copied = await copyToClipboard("https://openlinks.dev");

  assert.equal(copied, true);
  assert.equal(copiedValue, "https://openlinks.dev");

  restoreGlobals();
});

test("copyToClipboard falls back to document.execCommand when navigator.clipboard fails", async () => {
  const appendedNodes: HTMLElement[] = [];
  const removedNodes: HTMLElement[] = [];
  let selected = false;

  setNavigator({
    clipboard: {
      writeText: async () => {
        throw new Error("clipboard unavailable");
      },
    } as unknown as Clipboard,
  } as Navigator);

  setDocument({
    body: {
      appendChild: (node: HTMLElement) => {
        appendedNodes.push(node);
        return node;
      },
      removeChild: (node: HTMLElement) => {
        removedNodes.push(node);
        return node;
      },
    },
    createElement: () =>
      ({
        focus: () => undefined,
        select: () => {
          selected = true;
        },
        setAttribute: () => undefined,
        style: {} as CSSStyleDeclaration,
      }) as unknown as HTMLTextAreaElement,
    execCommand: (command: string) => command === "copy",
  } as unknown as Document);

  const copied = await copyToClipboard("hello");

  assert.equal(copied, true);
  assert.equal(appendedNodes.length, 1);
  assert.equal(removedNodes.length, 1);
  assert.equal(selected, true);

  restoreGlobals();
});

test("copyToClipboard returns false when no clipboard path succeeds", async () => {
  setNavigator({
    clipboard: {
      writeText: async () => {
        throw new Error("clipboard unavailable");
      },
    } as unknown as Clipboard,
  } as Navigator);

  setDocument({
    body: {
      appendChild: (node: HTMLElement) => node,
      removeChild: (node: HTMLElement) => node,
    },
    createElement: () =>
      ({
        focus: () => undefined,
        select: () => undefined,
        setAttribute: () => undefined,
        style: {} as CSSStyleDeclaration,
      }) as unknown as HTMLTextAreaElement,
    execCommand: () => false,
  } as unknown as Document);

  const copied = await copyToClipboard("hello");

  assert.equal(copied, false);

  restoreGlobals();
});
