import assert from "node:assert/strict";
import type { ResolvedProfileQuickLinksState } from "../../lib/ui/profile-quick-links";
import { ProfileHeader, resolveMobileProfileActionLayout } from "./ProfileHeader";

export type RenderedNode =
  | string
  | number
  | boolean
  | null
  | undefined
  | RenderedElement
  | RenderedNode[];

export interface RenderedElement {
  type: unknown;
  props: Record<string, unknown>;
}

export const reactRuntime = {
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

export const isRenderedElement = (value: RenderedNode): value is RenderedElement =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "type" in value &&
  "props" in value;

export const collectElements = (node: RenderedNode): RenderedElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectElements(entry));
  }

  if (!isRenderedElement(node)) {
    return [];
  }

  return [node, ...collectElements(node.props.children as RenderedNode)];
};

export const firstElementOfType = (node: RenderedNode, type: string): RenderedElement | undefined =>
  collectElements(node).find((element) => element.type === type);

export const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

export interface MockedDownloadEnvironmentResult {
  clickedAnchors: Array<{ download?: string; href?: string; rel?: string }>;
  createdBlobs: Blob[];
  fetchedUrls: string[];
}

export const withMockedDownloadEnvironment = async (
  fetchImplementation: (sourceUrl: string) => Promise<{ ok?: boolean; blob: () => Promise<Blob> }>,
  callback: (result: MockedDownloadEnvironmentResult) => Promise<void>,
) => {
  const globalScope = globalThis as unknown as {
    document?: Document;
    fetch?: (sourceUrl: string) => Promise<{ ok?: boolean; blob: () => Promise<Blob> }>;
  };
  const originalDocument = globalScope.document;
  const originalFetch = globalScope.fetch;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const result: MockedDownloadEnvironmentResult = {
    clickedAnchors: [],
    createdBlobs: [],
    fetchedUrls: [],
  };

  globalScope.fetch = async (sourceUrl: string) => {
    result.fetchedUrls.push(sourceUrl);
    return fetchImplementation(sourceUrl);
  };
  globalScope.document = {
    createElement: () =>
      ({
        click() {
          result.clickedAnchors.push({
            download: this.download,
            href: this.href,
            rel: this.rel,
          });
        },
      }) as HTMLAnchorElement,
  } as unknown as Document;
  URL.createObjectURL = ((blob: Blob) => {
    result.createdBlobs.push(blob);
    return "blob:openlinks-vcard";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;

  try {
    await callback(result);
  } finally {
    globalScope.document = originalDocument;
    globalScope.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
};

export const createQuickLinksState = (hasAny: boolean): ResolvedProfileQuickLinksState => ({
  hasAny,
  items: hasAny
    ? [
        {
          contentOrder: 0,
          icon: "github",
          id: "github",
          label: "GitHub",
          platform: "github",
          url: "https://github.com/pRizz",
        },
      ]
    : [],
});
