import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink } from "../content/load-content";
import {
  PROFILE_QUICK_LINK_PRIORITY,
  resolveProfileQuickLinks,
  resolveProfileQuickLinksState,
} from "./profile-quick-links";

const createLink = (
  overrides: Partial<OpenLink> & Pick<OpenLink, "id" | "label" | "type">,
): OpenLink => ({
  id: overrides.id,
  label: overrides.label,
  type: overrides.type,
  url: overrides.url,
  icon: overrides.icon,
  description: overrides.description,
  group: overrides.group,
  order: overrides.order,
  enabled: overrides.enabled,
  metadata: overrides.metadata,
  enrichment: overrides.enrichment,
  payment: overrides.payment,
  custom: overrides.custom,
});

test("priority platforms sort ahead of raw content order", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "substack",
      label: "Substack",
      type: "rich",
      url: "https://example.substack.com/",
      icon: "substack",
    }),
    createLink({
      id: "github",
      label: "GitHub",
      type: "rich",
      url: "https://github.com/pRizz",
      icon: "github",
    }),
    createLink({
      id: "x",
      label: "X",
      type: "rich",
      url: "https://x.com/pryszkie",
      icon: "x",
    }),
  ];

  // Act
  const quickLinks = resolveProfileQuickLinks(links);

  // Assert
  assert.deepEqual(
    quickLinks.map((link) => link.platform),
    ["x", "github", "substack"],
  );
});

test("remaining supported profile platforms follow content order after the locked priority list", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "rumble",
      label: "Rumble",
      type: "rich",
      url: "https://rumble.com/c/InTheLitterBox",
      icon: "rumble",
    }),
    createLink({
      id: "medium",
      label: "Medium",
      type: "rich",
      url: "https://medium.com/@peterryszkiewicz",
      icon: "medium",
    }),
    createLink({
      id: "rumble-two",
      label: "Rumble Backup",
      type: "rich",
      url: "https://rumble.com/c/InTheLitterBox2",
      icon: "rumble",
    }),
  ];

  // Act
  const quickLinks = resolveProfileQuickLinks(links);

  // Assert
  assert.deepEqual(
    quickLinks.map((link) => link.id),
    ["medium", "rumble"],
  );
});

test("canonical quick-links marker only breaks ties within the same platform", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "facebook-primary",
      label: "Facebook",
      type: "rich",
      url: "https://www.facebook.com/first.profile",
      icon: "facebook",
    }),
    createLink({
      id: "facebook-canonical",
      label: "Facebook Page",
      type: "rich",
      url: "https://www.facebook.com/people/second-profile/61588043858384/",
      icon: "facebook",
      custom: {
        quickLinks: {
          canonical: true,
        },
      },
    }),
    createLink({
      id: "github",
      label: "GitHub",
      type: "rich",
      url: "https://github.com/pRizz",
      icon: "github",
      custom: {
        quickLinks: {
          canonical: true,
        },
      },
    }),
  ];

  // Act
  const quickLinks = resolveProfileQuickLinks(links);

  // Assert
  assert.deepEqual(
    quickLinks.map((link) => ({ id: link.id, platform: link.platform })),
    [
      { id: "github", platform: "github" },
      { id: "facebook-canonical", platform: "facebook" },
    ],
  );
});

test("same-platform duplicates fall back to content order when no canonical marker is present", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "instagram-primary",
      label: "Instagram",
      type: "rich",
      url: "https://www.instagram.com/peterryszkiewicz/",
      icon: "instagram",
    }),
    createLink({
      id: "instagram-secondary",
      label: "Instagram Backup",
      type: "rich",
      url: "https://www.instagram.com/peterryszkiewicz.backup/",
      icon: "instagram",
    }),
    createLink({
      id: "linkedin",
      label: "LinkedIn",
      type: "rich",
      url: "https://www.linkedin.com/in/peter-ryszkiewicz/",
      icon: "linkedin",
    }),
  ];

  // Act
  const quickLinks = resolveProfileQuickLinks(links);

  // Assert
  assert.deepEqual(
    quickLinks.map((link) => ({ id: link.id, platform: link.platform })),
    [
      { id: "instagram-primary", platform: "instagram" },
      { id: "linkedin", platform: "linkedin" },
    ],
  );
});

test("non-profile, disabled, payment, and unsupported links are excluded", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "cluborange-profile",
      label: "Club Orange",
      type: "rich",
      url: "https://app.cluborange.org/pryszkie",
      icon: "cluborange",
    }),
    createLink({
      id: "cluborange-referral",
      label: "Join Club Orange",
      type: "rich",
      url: "https://signup.cluborange.org/co/pryszkie",
      icon: "cluborange",
      enrichment: {
        profileSemantics: "non_profile",
      },
    }),
    createLink({
      id: "payment",
      label: "Tips",
      type: "payment",
    }),
    createLink({
      id: "disabled-instagram",
      label: "Instagram",
      type: "rich",
      url: "https://www.instagram.com/peterryszkiewicz/",
      icon: "instagram",
      enabled: false,
    }),
    createLink({
      id: "website",
      label: "Website",
      type: "simple",
      url: "https://openlinks.us",
    }),
  ];

  // Act
  const quickLinks = resolveProfileQuickLinks(links);

  // Assert
  assert.deepEqual(
    quickLinks.map((link) => link.id),
    ["cluborange-profile"],
  );
});

test("empty results stay empty when nothing qualifies", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "home",
      label: "Website",
      type: "simple",
      url: "https://openlinks.us",
    }),
    createLink({
      id: "email",
      label: "Email",
      type: "simple",
      url: "mailto:hello@example.com",
    }),
  ];

  // Act
  const quickLinks = resolveProfileQuickLinks(links);

  // Assert
  assert.deepEqual(quickLinks, []);
});

test("quick-link state exposes hasAny and preserves the ordered winners", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "substack",
      label: "Substack",
      type: "rich",
      url: "https://example.substack.com/",
      icon: "substack",
    }),
    createLink({
      id: "github",
      label: "GitHub",
      type: "rich",
      url: "https://github.com/pRizz",
      icon: "github",
    }),
  ];

  // Act
  const quickLinksState = resolveProfileQuickLinksState(links);

  // Assert
  assert.equal(quickLinksState.hasAny, true);
  assert.deepEqual(
    quickLinksState.items.map((link) => link.id),
    ["github", "substack"],
  );
});

test("quick-link state stays empty when no supported profile destinations qualify", () => {
  // Arrange
  const links: OpenLink[] = [
    createLink({
      id: "home",
      label: "Website",
      type: "simple",
      url: "https://openlinks.us",
    }),
  ];

  // Act
  const quickLinksState = resolveProfileQuickLinksState(links);

  // Assert
  assert.equal(quickLinksState.hasAny, false);
  assert.deepEqual(quickLinksState.items, []);
});

test("priority list stays locked to the approved major-platform order", () => {
  // Arrange
  const approvedOrder = [
    "x",
    "youtube",
    "instagram",
    "linkedin",
    "github",
    "facebook",
    "medium",
    "substack",
    "primal",
    "cluborange",
  ];

  // Assert
  assert.deepEqual(PROFILE_QUICK_LINK_PRIORITY, approvedOrder);
});
