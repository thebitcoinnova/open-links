import assert from "node:assert/strict";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { buildRichCardViewModel, buildSimpleCardViewModel } from "../../lib/ui/rich-card-policy";
import { RichLinkCard } from "./RichLinkCard";
import { SimpleLinkCard } from "./SimpleLinkCard";

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

export const mockImageDimensionsByUrl = new Map<
  string,
  { naturalWidth: number; naturalHeight: number }
>([
  ["/cache/content-images/substack-preview.jpg", { naturalWidth: 2400, naturalHeight: 900 }],
  [
    "/cache/content-images/substack-square-preview.jpg",
    { naturalWidth: 1200, naturalHeight: 1200 },
  ],
]);

class MockImage {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;

  set src(value: string) {
    const maybeDimensions = mockImageDimensionsByUrl.get(value);
    this.complete = true;
    this.naturalWidth = maybeDimensions?.naturalWidth ?? 0;
    this.naturalHeight = maybeDimensions?.naturalHeight ?? 0;
  }

  addEventListener() {}

  removeEventListener() {}
}

(
  globalThis as typeof globalThis & {
    Image?: typeof Image;
  }
).Image = MockImage as unknown as typeof Image;

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

export const renderedTextContent = (node: RenderedNode): string => {
  if (Array.isArray(node)) {
    return node.map((entry) => renderedTextContent(entry)).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!isRenderedElement(node)) {
    return "";
  }

  return renderedTextContent(node.props.children as RenderedNode);
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

export const elementIndex = (
  node: RenderedNode,
  matcher: (element: RenderedElement) => boolean,
): number => collectElements(node).findIndex(matcher);

export const assertSharedCardTree = (
  tree: RenderedNode,
  expected: {
    ariaLabel: string;
    describedBy: string;
    descriptionId: string;
    metaId: string;
    sourceId: string;
  },
) => {
  const anchor = firstElementOfType(tree, "a");
  assert.ok(anchor);
  assert.equal(anchor.props["aria-label"], expected.ariaLabel);
  assert.equal(anchor.props["aria-describedby"], expected.describedBy);
  assert.ok(!("aria-labelledby" in anchor.props));

  const renderedIds = new Set(
    collectElements(tree)
      .map((element) => element.props.id)
      .filter((value): value is string => typeof value === "string"),
  );

  assert.ok(renderedIds.has(expected.descriptionId));
  assert.ok(renderedIds.has(expected.metaId));
  assert.ok(renderedIds.has(expected.sourceId));
};

export const site = {
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

export const richGithubLink = {
  id: "github",
  label: "GitHub",
  url: "https://github.com/pRizz",
  type: "rich",
  icon: "github",
  description: "Code, experiments, and open-source projects",
  metadata: {
    title: "pRizz - Overview",
    description:
      "An agentic engineer, making things in the AI space, Bitcoin space, and many others.",
    sourceLabel: "github.com",
    handle: "prizz",
    image: "/cache/content-images/github-avatar.jpg",
    profileImage: "/cache/content-images/github-avatar.jpg",
    followersCount: 90,
    followersCountRaw: "90 followers",
    followingCount: 87,
    followingCountRaw: "87 following",
  },
} as const satisfies OpenLink;

export const richSubstackLink = {
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  description: "Newsletter and long-form writing",
  metadata: {
    title: "Peter Ryszkiewicz | Substack",
    description: "Software Engineer",
    sourceLabel: "peter.ryszkiewicz.us",
    handle: "peterryszkiewicz",
    image: "/cache/content-images/substack-preview.jpg",
    profileImage: "/cache/content-images/substack-avatar.jpg",
  },
} as const satisfies OpenLink;

export const richSubstackSquarePreviewLink = {
  ...richSubstackLink,
  id: "substack-square",
  metadata: {
    ...richSubstackLink.metadata,
    image: "/cache/content-images/substack-square-preview.jpg",
  },
} as const satisfies OpenLink;

export const simpleGithubLink = {
  ...richGithubLink,
  id: "github-simple",
  type: "simple",
} as const satisfies OpenLink;

export const plainSimpleLink = {
  id: "openlinks",
  label: "OpenLinks",
  url: "https://openlinks.us",
  type: "simple",
  icon: "github",
  description: "Project homepage preview card with fallback defaults",
  metadata: {
    title: "OpenLinks",
    description: "Project homepage preview card with fallback defaults",
    sourceLabel: "openlinks.us",
  },
} as const satisfies OpenLink;

export const emailSimpleLink = {
  id: "email",
  label: "Email",
  url: "mailto:hello.team@example.com?subject=Hi%20there",
  type: "simple",
} as const satisfies OpenLink;

export const articleRichLink = {
  id: "article",
  label: "Engineering Notes",
  url: "https://notes.openlinks.dev/launch-notes",
  type: "rich",
  icon: "notion",
  description: "Shipping notes and technical writeups",
  metadata: {
    title: "Engineering Notes",
    description: "Shipping notes and technical writeups",
    image: "/cache/content-images/article-preview.jpg",
    sourceLabel: "notes.openlinks.dev",
  },
} as const satisfies OpenLink;

export const referralSimpleLink = {
  id: "coffee-referral",
  label: "Get Coffee",
  url: "https://example.com/coffee?ref=openlinks",
  type: "simple",
  icon: "globe",
  description: "Ordinary fallback copy",
  metadata: {
    title: "Coffee",
    description: "Ordinary fallback copy",
    sourceLabel: "example.com",
  },
  referral: {
    kind: "promo",
    visitorBenefit: "Get 20% off your first order",
    ownerBenefit: "Supports the project",
    offerSummary: "Save on your first bag of coffee.",
    termsSummary: "New customers only. Cannot be combined with other offers.",
    termsUrl: "https://example.com/referral-terms",
  },
} as const satisfies OpenLink;

export const longSimpleLink = {
  id: "openlinks-long",
  label: "OpenLinks With A Remarkably Long Label Built To Stress Narrow Mobile Card Width",
  url: "https://openlinks.us",
  type: "simple",
  icon: "globe",
  description:
    "A description with exceedinglylongsegmentsandaverylongcustomdomainreference.example.openlinks.dev that should remain inside the card.",
  metadata: {
    title: "OpenLinks With A Remarkably Long Label Built To Stress Narrow Mobile Card Width",
    description:
      "A description with exceedinglylongsegmentsandaverylongcustomdomainreference.example.openlinks.dev that should remain inside the card.",
    sourceLabel:
      "very-long-custom-domain-for-openlinks-mobile-overflow-checks.example.openlinks.dev",
  },
} as const satisfies OpenLink;

export const longHandleRichLink = {
  ...richGithubLink,
  id: "github-long-handle",
  metadata: {
    ...richGithubLink.metadata,
    description:
      "An agentic engineer with a deliberatelylongprofiledescriptionthatneedstowrapcleanlyinsideitscardcontainer.",
    handle: "averyveryverylonghandlewithoutnaturalbreakpointsforwrappingchecks",
    sourceLabel:
      "custom-github-mirror-subdomain-used-for-mobile-overflow-regression-checks.example.dev",
    title: "averyveryverylonghandlewithoutnaturalbreakpointsforwrappingchecks - Overview",
  },
  url: "https://github.com/averyveryverylonghandlewithoutnaturalbreakpointsforwrappingchecks",
} as const satisfies OpenLink;

export const longArticleRichLink = {
  ...articleRichLink,
  id: "article-long",
  description:
    "Shipping notes with an intentionallylongslugsegmentthatneedstobreakinsidearichcardwithoutwideningthelayout.",
  label: "Engineering Notes With A Long Rich Card Title For Mobile Layout Safety",
  metadata: {
    ...articleRichLink.metadata,
    description:
      "Shipping notes with an intentionallylongslugsegmentthatneedstobreakinsidearichcardwithoutwideningthelayout.",
    sourceLabel:
      "notes-with-a-very-long-subdomain-for-mobile-overflow-regression-checks.openlinks.dev",
    title: "Engineering Notes With A Long Rich Card Title For Mobile Layout Safety",
  },
  url: "https://notes-with-a-very-long-subdomain-for-mobile-overflow-regression-checks.openlinks.dev/launch-notes",
} as const satisfies OpenLink;

export const brandIconOptions = resolveBrandIconOptions(site as SiteData);
