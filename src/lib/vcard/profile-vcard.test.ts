import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, ProfileData, SiteSharingVCardConfig } from "../content/load-content";
import { buildProfileVCard, resolveProfileVCardDownload } from "./profile-vcard";

const utf8Encoder = new TextEncoder();

const profile = {
  avatar: "https://example.com/avatar.jpg",
  bio: "Builder",
  headline: "Founder",
  name: "Peter Ryszkiewicz",
} satisfies ProfileData;

test("profile vCard defaults to full name and profile URL when enabled", () => {
  // Arrange
  const config = { enabled: true } satisfies SiteSharingVCardConfig;

  // Act
  const result = resolveProfileVCardDownload({
    config,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.deepEqual(result, {
    filename: "peter-ryszkiewicz.vcf",
    contents: [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Peter Ryszkiewicz",
      "N:Ryszkiewicz;Peter;;;",
      "URL:https://openlinks.us/",
      "END:VCARD",
      "",
    ].join("\r\n"),
  });
});

test("profile vCard stays unavailable until explicitly enabled", () => {
  // Arrange
  const config = { enabled: false } satisfies SiteSharingVCardConfig;

  // Act
  const result = resolveProfileVCardDownload({
    config,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.equal(result, undefined);
});

test("profile vCard keeps the required formatted name when profile name is blank", () => {
  // Arrange
  const unnamedProfile = {
    ...profile,
    name: " ",
  } satisfies ProfileData;

  // Act
  const contents = buildProfileVCard({
    config: { enabled: true },
    profile: unnamedProfile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.match(contents, /\r\nFN:Profile\r\n/u);
  assert.match(contents, /\r\nN:;Profile;;;\r\n/u);
});

test("profile vCard includes embedded photos in vCard 3 base64 format", () => {
  // Arrange
  const photoUri = "data:image/jpeg;base64,AQID";

  // Act
  const contents = buildProfileVCard({
    config: { enabled: true },
    photoUri,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.match(contents, /\r\nPHOTO;ENCODING=b;TYPE=JPEG:AQID\r\n/u);
});

test("profile vCard omits invalid photo URIs", () => {
  // Act
  const contents = buildProfileVCard({
    config: { enabled: true },
    photoUri: "/cache/profile-avatar/profile-avatar.jpg",
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.doesNotMatch(contents, /\r\nPHOTO/u);
});

test("profile vCard omits data URI photos with unsupported Apple contact image types", () => {
  // Act
  const contents = buildProfileVCard({
    config: { enabled: true },
    photoUri: "data:image/webp;base64,AQID",
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.doesNotMatch(contents, /\r\nPHOTO/u);
});

test("profile vCard folds long content lines without splitting UTF-8 characters", () => {
  // Arrange
  const note = `${"a".repeat(70)}é`;
  const photoUri = `data:image/png;base64,${"A".repeat(120)}`;

  // Act
  const contents = buildProfileVCard({
    config: {
      enabled: true,
      fields: {
        note,
      },
    },
    photoUri,
    profile,
    profileUrl: "https://openlinks.us/",
  });
  const physicalLines = contents.split("\r\n").filter((line) => line.length > 0);
  const unfolded = contents.replaceAll(/\r\n[ \t]/gu, "");

  // Assert
  assert.ok(physicalLines.every((line) => utf8Encoder.encode(line).length <= 75));
  assert.match(contents, /\r\n /u);
  assert.ok(unfolded.includes(`NOTE:${note}`));
  assert.ok(unfolded.includes(`PHOTO;ENCODING=b;TYPE=PNG:${"A".repeat(120)}`));
});

test("profile vCard adds configured business contact fields", () => {
  // Arrange
  const config = {
    enabled: true,
    filename: "Peter",
    fields: {
      email: "hello@example.com",
      note: "Line one\nLine two, with semicolon; and slash \\",
      organization: "Example LLC",
      phone: "+15551234567",
      role: "Engineer",
      title: "Founder",
    },
  } satisfies SiteSharingVCardConfig;

  // Act
  const result = resolveProfileVCardDownload({
    config,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.equal(result?.filename, "Peter.vcf");
  assert.equal(
    result?.contents,
    [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Peter Ryszkiewicz",
      "N:Ryszkiewicz;Peter;;;",
      "ORG:Example LLC",
      "TITLE:Founder",
      "ROLE:Engineer",
      "NOTE:Line one\\nLine two\\, with semicolon\\; and slash \\\\",
      "EMAIL:hello@example.com",
      "TEL:+15551234567",
      "URL:https://openlinks.us/",
      "END:VCARD",
      "",
    ].join("\r\n"),
  );
});

test("profile vCard marks organization profiles with Apple company metadata", () => {
  // Arrange
  const organizationProfile = {
    ...profile,
    entityType: "organization",
    name: "Bright Builds LLC",
  } satisfies ProfileData;

  // Act
  const contents = buildProfileVCard({
    config: { enabled: true },
    profile: organizationProfile,
    profileUrl: "https://example.com/",
  });

  // Assert
  assert.match(contents, /\r\nX-ABShowAs:COMPANY\r\n/u);
  assert.match(contents, /\r\nN:Bright Builds LLC;;;;\r\n/u);
  assert.match(contents, /\r\nORG:Bright Builds LLC\r\n/u);
});

test("profile vCard keeps person name structured when organization is configured", () => {
  // Arrange
  const config = {
    enabled: true,
    fields: {
      organization: "Bright Builds LLC",
      title: "Founder",
    },
  } satisfies SiteSharingVCardConfig;

  // Act
  const contents = buildProfileVCard({
    config,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.match(
    contents,
    /\r\nFN:Peter Ryszkiewicz\r\nN:Ryszkiewicz;Peter;;;\r\nORG:Bright Builds LLC\r\n/u,
  );
});

test("profile vCard uses explicit link allowlists and custom URLs without duplicates", () => {
  // Arrange
  const links = [
    {
      id: "github",
      label: "GitHub",
      type: "rich",
      url: "https://github.com/pRizz",
    },
    {
      id: "hidden",
      enabled: false,
      label: "Hidden",
      type: "simple",
      url: "https://hidden.example.com",
    },
  ] satisfies OpenLink[];
  const config = {
    enabled: true,
    include: {
      customUrls: [
        {
          label: "Calendar",
          url: "https://cal.example.com/peter",
        },
        {
          label: "Duplicate",
          url: "https://github.com/pRizz",
        },
      ],
      linkIds: ["github", "hidden", "missing"],
      profileUrl: false,
    },
  } satisfies SiteSharingVCardConfig;

  // Act
  const contents = buildProfileVCard({
    config,
    links,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.equal(
    contents,
    [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Peter Ryszkiewicz",
      "N:Ryszkiewicz;Peter;;;",
      "item1.URL:https://github.com/pRizz",
      "item1.X-ABLabel:GitHub",
      "item2.URL:https://cal.example.com/peter",
      "item2.X-ABLabel:Calendar",
      "END:VCARD",
      "",
    ].join("\r\n"),
  );
});

test("profile vCard sanitizes configured filenames", () => {
  // Arrange
  const config = {
    enabled: true,
    filename: "../Peter Card",
  } satisfies SiteSharingVCardConfig;

  // Act
  const result = resolveProfileVCardDownload({
    config,
    profile,
    profileUrl: "https://openlinks.us/",
  });

  // Assert
  assert.equal(result?.filename, "..-Peter Card.vcf");
});
