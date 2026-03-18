import assert from "node:assert/strict";
import test from "node:test";
import { parseLinktreeBootstrapHtml } from "./linktree";

const buildStructuredFixture = (input: { includeRenderedAvatar?: boolean }): string => {
  const nextData = {
    props: {
      pageProps: {
        account: {
          username: "XSTACI",
          pageTitle: "Staci",
          description: "Host of Bitcoin Nova Podcast | X Community Leader",
          profilePictureUrl:
            "https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg",
          socialLinks: [
            { type: "WEBSITE", url: "https://bitcoinnova.store/", position: 0 },
            {
              type: "YOUTUBE",
              url: "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
              position: 1,
            },
            { type: "X", url: "https://x.com/XSTAC1", position: 2 },
          ],
        },
        links: [
          {
            id: "1",
            title: "The Bitcoin Nova",
            thumbnail:
              "https://ugc.production.linktr.ee/291378fc-ef03-42f3-a47f-87231960a96d_67yYwmRQAKQmaL2g.jpeg",
            url: "https://bitcoinnova.store/",
            type: "CLASSIC",
            position: 0,
            locked: null,
            metaData: {},
          },
          {
            id: "2",
            title: "bookings.thebitcoinnova@gmail.com",
            thumbnail: null,
            url: "mailto:TheBitcoinNova@gmail.com",
            type: "EMAIL",
            position: 1,
            locked: null,
            metaData: {},
          },
          {
            id: "3",
            title: "Internal Link",
            url: "https://linktr.ee/XSTACI",
            type: "CLASSIC",
            position: 2,
            locked: null,
            metaData: {},
          },
          {
            id: "4",
            title: "Locked Link",
            url: "https://example.com/locked",
            type: "CLASSIC",
            position: 3,
            locked: { reason: "gated" },
            metaData: {},
          },
        ],
      },
    },
  };

  return `
    <html>
      <head>
        <title>Staci | Linktree</title>
        <meta name="description" content="Host of Bitcoin Nova Podcast | X Community Leader" />
        <meta property="og:image" content="https://linktr.ee/og/image/XSTACI.jpg" />
      </head>
      <body>
        ${
          input.includeRenderedAvatar === false
            ? ""
            : '<img data-testid="ProfileImage" src="https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg?io=true&amp;size=avatar-v3_0" alt="" />'
        }
        <h1>Staci</h1>
        <a href="https://should-not-be-imported.example.com">Rendered Anchor Only</a>
        <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
      </body>
    </html>
  `;
};

test("extracts the rendered Linktree avatar and structured social/content links", () => {
  // Arrange
  const html = buildStructuredFixture({ includeRenderedAvatar: true });

  // Act
  const parsed = parseLinktreeBootstrapHtml({
    sourceUrl: "https://linktr.ee/XSTACI",
    fetchedUrl: "https://linktr.ee/XSTACI",
    html,
  });

  // Assert
  assert.equal(
    parsed.profile.avatar,
    "https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg?io=true&size=avatar-v3_0",
  );
  assert.equal(parsed.profile.name, "Staci");
  assert.equal(parsed.profile.bio, "Host of Bitcoin Nova Podcast | X Community Leader");
  assert.deepEqual(
    parsed.profile.socialLinks.map((link) => ({
      label: link.label,
      url: link.url,
      sourceOrder: link.sourceOrder,
    })),
    [
      {
        label: "Website",
        url: "https://bitcoinnova.store/",
        sourceOrder: 0,
      },
      {
        label: "YouTube",
        url: "https://youtube.com/@thebitcoinnovapodcast?si=bJDvNhG8zklJMv8Q",
        sourceOrder: 1,
      },
      {
        label: "X",
        url: "https://x.com/XSTAC1",
        sourceOrder: 2,
      },
    ],
  );
  assert.deepEqual(
    parsed.links.map((link) => ({
      label: link.label,
      url: link.url,
      sourceOrder: link.sourceOrder,
      thumbnailUrl: link.thumbnailUrl,
    })),
    [
      {
        label: "The Bitcoin Nova",
        url: "https://bitcoinnova.store/",
        sourceOrder: 0,
        thumbnailUrl:
          "https://ugc.production.linktr.ee/291378fc-ef03-42f3-a47f-87231960a96d_67yYwmRQAKQmaL2g.jpeg",
      },
      {
        label: "bookings.thebitcoinnova@gmail.com",
        url: "mailto:TheBitcoinNova@gmail.com",
        sourceOrder: 1,
        thumbnailUrl: undefined,
      },
    ],
  );
});

test("falls back to account.profilePictureUrl when the rendered avatar is missing", () => {
  // Arrange
  const html = buildStructuredFixture({ includeRenderedAvatar: false });

  // Act
  const parsed = parseLinktreeBootstrapHtml({
    sourceUrl: "https://linktr.ee/XSTACI",
    fetchedUrl: "https://linktr.ee/XSTACI",
    html,
  });

  // Assert
  assert.equal(
    parsed.profile.avatar,
    "https://ugc.production.linktr.ee/cb51ef8a-75f5-45d0-b5ee-84930a9a6116_IMG-0031.jpeg",
  );
  assert.ok(
    parsed.warnings.some((warning) => warning.includes("used account.profilePictureUrl fallback")),
  );
});

test("falls back to generic HTML parsing when structured Linktree data is missing", () => {
  // Arrange
  const html = `
    <html>
      <head>
        <title>Charlie Example | Linktree</title>
        <meta name="description" content="Builder, operator, and writer." />
        <meta property="og:image" content="https://cdn.example.com/charlie.jpg" />
      </head>
      <body>
        <h1>Charlie Example</h1>
        <a href="https://github.com/charlie-example">GitHub</a>
        <a href="https://charlie.example.com">Website</a>
        <a href="https://github.com/charlie-example/">GitHub Duplicate</a>
        <a href="https://linktr.ee/charlie-example">Internal Linktree Link</a>
      </body>
    </html>
  `;

  // Act
  const parsed = parseLinktreeBootstrapHtml({
    sourceUrl: "https://linktr.ee/charlie-example",
    fetchedUrl: "https://linktr.ee/charlie-example",
    html,
  });

  // Assert
  assert.equal(parsed.profile.name, "Charlie Example");
  assert.equal(parsed.profile.bio, "Builder, operator, and writer.");
  assert.equal(parsed.profile.avatar, "https://cdn.example.com/charlie.jpg");
  assert.deepEqual(
    parsed.links.map((link) => ({
      label: link.label,
      url: link.url,
    })),
    [
      {
        label: "GitHub",
        url: "https://github.com/charlie-example",
      },
      {
        label: "Website",
        url: "https://charlie.example.com/",
      },
    ],
  );
  assert.deepEqual(
    parsed.profile.socialLinks.map((link) => ({
      label: link.label,
      url: link.url,
    })),
    [
      {
        label: "GitHub",
        url: "https://github.com/charlie-example",
      },
    ],
  );
  assert.ok(
    parsed.warnings.some((warning) =>
      warning.includes("Structured Linktree payload was not found"),
    ),
  );
});
