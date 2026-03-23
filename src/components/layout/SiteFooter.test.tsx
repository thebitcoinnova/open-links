import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenClawBootstrapPrompt } from "../../lib/openclaw-prompts";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
import type { ResolvedFooterPreferences } from "../../lib/ui/footer-preferences";
import { SiteFooter } from "./SiteFooter";

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

const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

const createPreferences = (
  overrides: Partial<ResolvedFooterPreferences> = {},
  promptOverrides: Partial<ResolvedFooterPreferences["prompt"]> = {},
): ResolvedFooterPreferences => ({
  description: "OpenLinks footer copy",
  ctaLabel: "Create Your OpenLinks",
  ctaUrl: "https://github.com/openlinks/example",
  prompt: {
    enabled: true,
    explanation:
      "Paste this bootstrap prompt into OpenClaw, Claude, or Codex to create a new OpenLinks site from this repository.",
    text: buildOpenClawBootstrapPrompt(),
    title: "Create your own OpenLinks site",
    ...promptOverrides,
  },
  showLastUpdated: true,
  ...overrides,
});

test("site footer renders a compact single-line bootstrap prompt row by default", () => {
  // Arrange
  const preferences = createPreferences();
  const tree = SiteFooter({
    preferences,
  }) as RenderedNode;

  // Act
  const title = firstElementWithClass(tree, "site-footer-prompt-title");
  const explanation = firstElementWithClass(tree, "site-footer-prompt-explanation");
  const promptRow = firstElementWithClass(tree, "site-footer-prompt-copy-row");
  const promptInput = collectElements(tree).find(
    (element) => element.type === "input" && element.props["aria-label"] === "Bootstrap prompt",
  );
  const copyButton = collectElements(tree).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy bootstrap prompt",
  );

  // Assert
  assert.equal(title?.props.children, preferences.prompt.title);
  assert.equal(explanation?.props.children, preferences.prompt.explanation);
  assert.ok(promptRow);
  assert.ok(promptInput);
  assert.equal(promptInput?.props.readOnly, true);
  assert.equal(promptInput?.props.value, preferences.prompt.text);
  assert.equal(typeof promptInput?.props.onClick, "function");
  assert.equal(typeof promptInput?.props.onFocus, "function");
  assert.equal(copyButton?.props.children, "Copy");
});

test("site footer copy action emits a toast when bootstrap prompt copy succeeds", async (t) => {
  // Arrange
  let copiedValue = "";
  const calls: Array<{ message: string; variant: "default" | "error" }> = [];

  t.after(() => {
    clearActionToastClient();
    restoreNavigator();
  });

  setNavigator({
    clipboard: {
      writeText: async (value: string) => {
        copiedValue = value;
      },
    } as Clipboard,
  } as Navigator);

  registerActionToastClient({
    default: (message: string) => {
      calls.push({ message, variant: "default" });
    },
    error: (message: string) => {
      calls.push({ message, variant: "error" });
    },
  });

  const preferences = createPreferences();
  const tree = SiteFooter({
    preferences,
  }) as RenderedNode;

  // Act
  const copyButton = collectElements(tree).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy bootstrap prompt",
  );

  assert.ok(copyButton);

  await (copyButton.props.onClick as () => Promise<void>)();

  // Assert
  assert.equal(copiedValue, preferences.prompt.text);
  assert.deepEqual(calls, [{ message: "Bootstrap prompt copied", variant: "default" }]);
});

test("site footer falls back to the multiline prompt block when prompt text contains line breaks", () => {
  // Arrange
  const preferences = createPreferences({}, { text: "Line one\nLine two" });
  const tree = SiteFooter({
    preferences,
  }) as RenderedNode;

  // Act
  const promptText = firstElementWithClass(tree, "site-footer-prompt-text");
  const promptInput = collectElements(tree).find(
    (element) => element.type === "input" && element.props["aria-label"] === "Bootstrap prompt",
  );
  const promptCode = collectElements(promptText?.props.children as RenderedNode).find(
    (element) => element.type === "code",
  );

  // Assert
  assert.ok(promptText);
  assert.equal(promptInput, undefined);
  assert.equal(promptCode?.props.children, preferences.prompt.text);
});
