import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedProfileQuickLinksState } from "../../lib/ui/profile-quick-links";
import { ProfileHeader, resolveMobileProfileActionLayout } from "./ProfileHeader";

import {
  MockedDownloadEnvironmentResult,
  RenderedElement,
  type RenderedNode,
  collectElements,
  createQuickLinksState,
  firstElementOfType,
  firstElementWithClass,
  isRenderedElement,
  reactRuntime,
  withMockedDownloadEnvironment,
} from "./ProfileHeader.test-helpers";

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
