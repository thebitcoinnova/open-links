import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../content/load-content";
import {
  buildRichCardViewModel,
  buildSimpleCardViewModel,
  resolveFooterSourceLabel,
  resolveLinkSourcePresentation,
} from "./rich-card-policy";

const site = {
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
    },
  },
} as const satisfies SiteData;

const instagramLink = {
  id: "instagram",
  label: "Instagram",
  url: "https://www.instagram.com/peterryszkiewicz/",
  type: "rich",
  icon: "instagram",
  description: "Photos and stories",
  metadata: {
    title: "Instagram profile",
    description: "Photos and stories",
    sourceLabel: "instagram.com",
    handle: "peterryszkiewicz",
    image: "/cache/content-images/avatar.jpg",
    profileImage: "/cache/content-images/avatar.jpg",
  },
} as const satisfies OpenLink;

const substackRichLink = {
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
    image: "/cache/content-images/substack-avatar.jpg",
    profileImage: "/cache/content-images/substack-avatar.jpg",
  },
} as const satisfies OpenLink;

const substackSimpleLink = {
  ...substackRichLink,
  id: "substack-simple",
  type: "simple",
} as const satisfies OpenLink;

const clubOrangeLink = {
  id: "cluborange",
  label: "Club Orange",
  url: "https://app.cluborange.org/pryszkie",
  type: "rich",
  icon: "cluborange",
  description: "Club Orange profile and Bitcoin-space projects",
  metadata: {
    title: "Peter Ryszkiewicz",
    description: "Building apps/websites/products in the Bitcoin space",
    sourceLabel: "app.cluborange.org",
    handle: "pryszkie",
    image: "/cache/content-images/cluborange-avatar.jpg",
    profileImage: "/cache/content-images/cluborange-avatar.jpg",
  },
} as const satisfies OpenLink;

test("keeps canonical known-site footer labels unchanged", () => {
  // Arrange
  const sourcePresentation = resolveLinkSourcePresentation(site, instagramLink);

  // Act
  const footerSourceLabel = resolveFooterSourceLabel(instagramLink, sourcePresentation.sourceLabel);

  // Assert
  assert.equal(sourcePresentation.sourceLabel, "instagram.com");
  assert.equal(footerSourceLabel, "instagram.com");
});

test("formats known-platform custom domains as platform plus domain in the footer", () => {
  // Arrange
  const sourcePresentation = resolveLinkSourcePresentation(site, substackRichLink);

  // Act
  const footerSourceLabel = resolveFooterSourceLabel(
    substackRichLink,
    sourcePresentation.sourceLabel,
  );
  const richViewModel = buildRichCardViewModel(site, substackRichLink);

  // Assert
  assert.equal(sourcePresentation.sourceLabel, "peter.ryszkiewicz.us");
  assert.equal(footerSourceLabel, "Substack · peter.ryszkiewicz.us");
  assert.equal(richViewModel.footerSourceLabel, "Substack · peter.ryszkiewicz.us");
});

test("keeps canonical known-platform subdomain labels unchanged in the footer", () => {
  // Arrange
  const sourcePresentation = resolveLinkSourcePresentation(site, clubOrangeLink);

  // Act
  const footerSourceLabel = resolveFooterSourceLabel(
    clubOrangeLink,
    sourcePresentation.sourceLabel,
  );
  const richViewModel = buildRichCardViewModel(site, clubOrangeLink);

  // Assert
  assert.equal(sourcePresentation.sourceLabel, "app.cluborange.org");
  assert.equal(footerSourceLabel, "app.cluborange.org");
  assert.equal(richViewModel.footerSourceLabel, "app.cluborange.org");
});

test("leaves non-host manual source labels unchanged", () => {
  // Arrange
  const customLabelLink = {
    ...substackRichLink,
    id: "substack-manual-label",
    metadata: {
      ...substackRichLink.metadata,
      sourceLabel: "Peter's writing home",
    },
  } as const satisfies OpenLink;

  // Act
  const sourcePresentation = resolveLinkSourcePresentation(site, customLabelLink);
  const footerSourceLabel = resolveFooterSourceLabel(
    customLabelLink,
    sourcePresentation.sourceLabel,
  );

  // Assert
  assert.equal(sourcePresentation.sourceLabel, "Peter's writing home");
  assert.equal(footerSourceLabel, "Peter's writing home");
});

test("omits footer labels entirely when source labels are hidden", () => {
  // Arrange
  const hiddenSourceLink = {
    ...substackRichLink,
    id: "substack-hidden-source",
    metadata: {
      ...substackRichLink.metadata,
      sourceLabelVisible: false,
    },
  } as const satisfies OpenLink;

  // Act
  const sourcePresentation = resolveLinkSourcePresentation(site, hiddenSourceLink);
  const richViewModel = buildRichCardViewModel(site, hiddenSourceLink);

  // Assert
  assert.equal(sourcePresentation.showSourceLabel, false);
  assert.equal(richViewModel.footerSourceLabel, undefined);
});

test("simple cards reuse the clarified custom-domain footer label", () => {
  // Arrange
  const simpleViewModel = buildSimpleCardViewModel(site, substackSimpleLink);

  // Assert
  assert.equal(simpleViewModel.footerSourceLabel, "Substack · peter.ryszkiewicz.us");
});
