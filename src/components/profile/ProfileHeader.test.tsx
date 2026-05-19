import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedProfileQuickLinksState } from "../../lib/ui/profile-quick-links";
import { ProfileHeader, resolveMobileProfileActionLayout } from "./ProfileHeader";

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

const firstElementOfType = (node: RenderedNode, type: string): RenderedElement | undefined =>
  collectElements(node).find((element) => element.type === type);

const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

interface MockedDownloadEnvironmentResult {
  clickedAnchors: Array<{ download?: string; href?: string; rel?: string }>;
  createdBlobs: Blob[];
  fetchedUrls: string[];
}

const withMockedDownloadEnvironment = async (
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

const createQuickLinksState = (hasAny: boolean): ResolvedProfileQuickLinksState => ({
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

test("profile header renders QR, share, and copy desktop actions when QR is available", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
  const buttons = collectElements(desktopBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(buttons[0]?.props["aria-label"], "Show profile QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share profile");
  assert.equal(buttons[2]?.props["aria-label"], "Copy profile link");
});

test("profile header renders enabled vCard download between share and copy", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    vcard: {
      enabled: true,
    },
  }) as RenderedNode;

  // Act
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
  const buttons = collectElements(desktopBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(buttons[0]?.props["aria-label"], "Show profile QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share profile");
  assert.equal(buttons[2]?.props["aria-label"], "Download profile vCard");
  assert.equal(buttons[2]?.props["data-kind"], "download");
  assert.equal(buttons[3]?.props["aria-label"], "Copy profile link");
});

test("profile header embeds configured vCard photo before downloading", async () => {
  await withMockedDownloadEnvironment(
    async () => ({
      ok: true,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    }),
    async (result) => {
      // Arrange
      const tree = ProfileHeader({
        profile: {
          avatar: "/cache/profile-avatar/profile-avatar.jpg",
          bio: "Engineer",
          headline: "Justice-driven builder",
          name: "Peter Ryszkiewicz",
        },
        vcard: {
          enabled: true,
          include: {
            photo: true,
          },
        },
      }) as RenderedNode;
      const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
      const downloadButton = collectElements(desktopBar?.props.children as RenderedNode).find(
        (element) => element.type === "button" && element.props["data-kind"] === "download",
      );

      // Act
      await (downloadButton?.props.onClick as () => Promise<void>)();
      const contents = await result.createdBlobs[0]?.text();

      // Assert
      assert.deepEqual(result.fetchedUrls, ["/cache/profile-avatar/profile-avatar.jpg"]);
      assert.equal(result.clickedAnchors[0]?.download, "peter-ryszkiewicz.vcf");
      assert.match(contents ?? "", /PHOTO;ENCODING=b;TYPE=JPEG:AQID/u);
    },
  );
});

test("profile header still downloads vCard when configured photo embedding fails", async () => {
  await withMockedDownloadEnvironment(
    async () => {
      throw new Error("avatar fetch failed");
    },
    async (result) => {
      // Arrange
      const tree = ProfileHeader({
        profile: {
          avatar: "/cache/profile-avatar/profile-avatar.jpg",
          bio: "Engineer",
          headline: "Justice-driven builder",
          name: "Peter Ryszkiewicz",
        },
        vcard: {
          enabled: true,
          include: {
            photo: true,
          },
        },
      }) as RenderedNode;
      const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
      const downloadButton = collectElements(desktopBar?.props.children as RenderedNode).find(
        (element) => element.type === "button" && element.props["data-kind"] === "download",
      );

      // Act
      await (downloadButton?.props.onClick as () => Promise<void>)();
      const contents = await result.createdBlobs[0]?.text();

      // Assert
      assert.deepEqual(result.fetchedUrls, ["/cache/profile-avatar/profile-avatar.jpg"]);
      assert.equal(result.clickedAnchors[0]?.download, "peter-ryszkiewicz.vcf");
      assert.doesNotMatch(contents ?? "", /PHOTO/u);
    },
  );
});

test("profile header keeps QR, share, and copy inline on mobile when QR is available", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const mobileBar = firstElementWithClass(tree, "profile-action-bar-mobile");
  const inlineButtons = collectElements(mobileBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(inlineButtons[0]?.props["aria-label"], "Show profile QR code");
  assert.equal(inlineButtons[1]?.props["aria-label"], "Share profile");
  assert.equal(inlineButtons[2]?.props["aria-label"], "Copy profile link");
});

test("profile header mobile layout moves multiple trailing actions into overflow", () => {
  // Arrange
  const layout = resolveMobileProfileActionLayout(["share", "copy", "open", "qr"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["qr", "share"],
    overflowKinds: ["copy", "open"],
  });
});

test("profile header mobile layout overflows download and copy when vCard is enabled", () => {
  // Arrange
  const layout = resolveMobileProfileActionLayout(["qr", "share", "download", "copy"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["qr", "share"],
    overflowKinds: ["download", "copy"],
  });
});

test("profile header mobile layout keeps a single trailing action inline", () => {
  // Arrange
  const layout = resolveMobileProfileActionLayout(["share", "copy", "qr"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["qr", "share", "copy"],
    overflowKinds: [],
  });
});

test("profile header mobile actions reuse the shared icon action content", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const mobileBar = firstElementWithClass(tree, "profile-action-bar-mobile");
  const inlineButtons = collectElements(mobileBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );
  const firstInlineButton = inlineButtons[0];
  const firstInlineButtonChildren = collectElements(
    (firstInlineButton?.props.children ?? null) as RenderedNode,
  );

  // Assert
  assert.ok(firstInlineButton);
  assert.ok(
    firstInlineButtonChildren.some((element) => {
      const classValue = element.props.class;
      return (
        element.type === "svg" &&
        typeof classValue === "string" &&
        classValue.split(/\s+/u).includes("bottom-action-bar-action-icon")
      );
    }),
  );
  assert.ok(
    firstInlineButtonChildren.some((element) => {
      const classValue = element.props.class;
      return (
        element.type === "span" &&
        typeof classValue === "string" &&
        classValue.split(/\s+/u).includes("bottom-action-bar-action-label")
      );
    }),
  );
  assert.equal(firstElementWithClass(tree, "profile-mobile-action-label"), undefined);
});

test("profile header still renders share and copy when QR is unavailable", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
  const buttons = collectElements(desktopBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );
  const mobileBar = firstElementWithClass(tree, "profile-action-bar-mobile");
  const mobileButtons = collectElements(mobileBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0]?.props["aria-label"], "Share profile");
  assert.equal(buttons[1]?.props["aria-label"], "Copy profile link");
  assert.equal(mobileButtons.length, 2);
  assert.equal(mobileButtons[0]?.props["aria-label"], "Share profile");
  assert.equal(mobileButtons[1]?.props["aria-label"], "Copy profile link");
});

test("profile header no longer renders an inline share status output", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Assert
  assert.equal(firstElementOfType(tree, "output"), undefined);
});

test("profile header keeps the title row free of action buttons", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const titleRow = firstElementWithClass(tree, "profile-title-row");
  const titleRowButtons = collectElements(titleRow?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.ok(titleRow);
  assert.equal(titleRowButtons.length, 0);
});

test("profile header marks empty quick-link state without rendering placeholder chrome", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    quickLinks: createQuickLinksState(false),
  }) as RenderedNode;

  // Act
  const section = firstElementWithClass(tree, "profile-header");
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");

  // Assert
  assert.ok(section);
  assert.ok(desktopBar);
  assert.equal(section.props["data-has-quick-links"], "false");
  assert.equal(firstElementWithClass(tree, "profile-quick-links"), undefined);
});

test("profile header exposes mobile-centered alignment attributes by default", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const section = firstElementWithClass(tree, "profile-header");

  // Assert
  assert.ok(section);
  assert.equal(section.props["data-alignment-default"], "leading");
  assert.equal(section.props["data-alignment-small"], "center");
});

test("profile header exposes responsive alignment attributes", () => {
  // Arrange
  const tree = ProfileHeader({
    alignment: {
      default: "leading",
      small: "center",
    },
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const section = firstElementWithClass(tree, "profile-header");

  // Assert
  assert.ok(section);
  assert.equal(section.props["data-alignment-default"], "leading");
  assert.equal(section.props["data-alignment-small"], "center");
});

test("profile header exposes populated quick-link readiness through the future-facing seam", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    quickLinks: createQuickLinksState(true),
  }) as RenderedNode;

  // Act
  const section = firstElementWithClass(tree, "profile-header");
  const quickLinks = firstElementWithClass(tree, "profile-quick-links");

  // Assert
  assert.ok(section);
  assert.equal(section.props["data-has-quick-links"], "true");
  assert.ok(quickLinks);
});

test("profile header keeps share and copy actions stable when quick-link state is populated", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    quickLinks: createQuickLinksState(true),
  }) as RenderedNode;

  // Act
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
  const buttons = collectElements(desktopBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0]?.props["aria-label"], "Share profile");
  assert.equal(buttons[1]?.props["aria-label"], "Copy profile link");
});

test("profile header keeps mobile actions stable when quick-link state is populated", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    quickLinks: createQuickLinksState(true),
  }) as RenderedNode;

  // Act
  const mobileBar = firstElementWithClass(tree, "profile-action-bar-mobile");
  const buttons = collectElements(mobileBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0]?.props["aria-label"], "Share profile");
  assert.equal(buttons[1]?.props["aria-label"], "Copy profile link");
});

test("profile header keeps long profile copy and contact values in wrap-safe elements", () => {
  // Arrange
  const longName = "Peter Ryszkiewicz With A Long Display Name That Needs To Wrap On Mobile";
  const longHeadline =
    "Building unusually long-form open source experiments for constrained mobile layouts";
  const longBio =
    "A bio with extraordinarilylongtokensandphrasesthatshouldstillwrapcleanlyinsideitscontainer without forcing the page wider than the viewport.";
  const longContactValue =
    "peter.ryszkiewicz+extremely-long-alias-for-mobile-overflow-checks@example.openlinks.dev";
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: longBio,
      contact: {
        Email: longContactValue,
      },
      headline: longHeadline,
      name: longName,
    },
    richness: "rich",
  }) as RenderedNode;

  // Act
  const title = firstElementOfType(tree, "h1");
  const headline = firstElementWithClass(tree, "profile-headline");
  const bio = firstElementWithClass(tree, "profile-bio");
  const contactItem = firstElementWithClass(tree, "profile-contact-item");
  const contactKey = firstElementWithClass(tree, "profile-contact-key");
  const contactValue = firstElementWithClass(tree, "profile-contact-value");

  // Assert
  assert.ok(title);
  assert.equal(title.props.children, longName);
  assert.ok(headline);
  assert.equal(headline.props.children, longHeadline);
  assert.ok(bio);
  assert.equal(bio.props.children, longBio);
  assert.ok(contactItem);
  assert.ok(contactKey);
  assert.equal(contactKey.props.children, "Email");
  assert.ok(contactValue);
  assert.equal(contactValue.props.children, longContactValue);
});

test("profile header uses page-oriented copy for organization entities", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Independent software studio",
      entityType: "organization",
      headline: "Building durable tools",
      name: "Bright Builds LLC",
    },
  }) as RenderedNode;

  // Act
  const section = firstElementWithClass(tree, "profile-header");
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
  const buttons = collectElements(desktopBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.equal(section?.props["aria-label"], "Page");
  assert.equal(buttons[0]?.props["aria-label"], "Show page QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share page");
  assert.equal(buttons[2]?.props["aria-label"], "Copy page link");
});

test("profile header hides pronouns for organization entities", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Independent software studio",
      entityType: "organization",
      headline: "Building durable tools",
      name: "Bright Builds LLC",
      pronouns: "they/them",
    },
    richness: "rich",
  }) as RenderedNode;

  // Act
  const metaList = firstElementWithClass(tree, "profile-meta");
  const renderedText = JSON.stringify(metaList?.props.children ?? null);

  // Assert
  assert.ok(metaList);
  assert.doesNotMatch(renderedText, /Pronouns:/u);
});
