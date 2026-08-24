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
