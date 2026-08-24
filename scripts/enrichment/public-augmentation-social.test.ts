import assert from "node:assert/strict";
import test from "node:test";
import { mergeReferralWithManualOverrides } from "../../src/lib/content/referral-fields";
import {
  extractYoutubeProfileImageUrl,
  extractYoutubeSubscriberCountRaw,
  parseInstagramProfileMetadata,
  parseYoutubeProfileMetadata,
  resolvePublicAugmentationTarget,
  resolvePublicReferralAugmentation,
} from "./public-augmentation";

test("resolves a Primal public augmentation target that fetches the profile page directly", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://primal.net/peterryszkiewicz",
    icon: "primal",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "primal-public-profile");
  assert.equal(target.sourceUrl, "https://primal.net/peterryszkiewicz");
});

test("parses Primal public profile metadata into an avatar-first payload", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://primal.net/peterryszkiewicz",
    icon: "primal",
  });
  const html = `
    <html>
      <head>
        <title>Peter No Taxation Without Representation Ryszkiewicz</title>
        <meta property="og:title" content="Peter No Taxation Without Representation Ryszkiewicz" />
        <meta
          property="og:description"
          content="Agentic engineer, making things in the AI space, Bitcoin space, and many others."
        />
        <meta
          property="og:image"
          content="https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg"
        />
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Peter No Taxation Without Representation Ryszkiewicz");
  assert.equal(
    parsed?.metadata.description,
    "Agentic engineer, making things in the AI space, Bitcoin space, and many others.",
  );
  assert.equal(
    parsed?.metadata.image,
    "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
  );
  assert.equal(
    parsed?.metadata.profileImage,
    "https://primal.net/media-cache?u=https%3A%2F%2Fexample.com%2Favatar.jpg",
  );
  assert.equal(parsed?.metadata.handle, "peterryszkiewicz");
  assert.equal(parsed?.metadata.sourceLabel, "primal.net");
});

test("parses X oEmbed metadata into an avatar-first profile payload", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/pryszkie",
    icon: "x",
  });
  const payload = JSON.stringify({
    provider_name: "Twitter",
    title: "@pryszkie on X",
    html: "<blockquote>Tweets by pryszkie</blockquote>",
  });

  // Act
  const parsed = target?.parse(payload);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "@pryszkie on X");
  assert.equal(parsed?.metadata.description, "Posts and updates from @pryszkie on X.");
  assert.equal(parsed?.metadata.profileDescription, undefined);
  assert.equal(parsed?.metadata.image, "https://unavatar.io/x/pryszkie");
  assert.equal(parsed?.metadata.profileImage, "https://unavatar.io/x/pryszkie");
});

test("parses the current X oEmbed provider and Posts by wording", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/StacingSats",
    icon: "x",
  });
  const payload = JSON.stringify({
    provider_name: "x",
    title: "",
    html: '<blockquote><a href="https://twitter.com/StacingSats">Posts by @StacingSats</a></blockquote>',
  });

  // Act
  const parsed = target?.parse(payload);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "@StacingSats on X");
  assert.equal(parsed?.metadata.description, "Posts and updates from @StacingSats on X.");
  assert.equal(parsed?.metadata.image, "https://unavatar.io/x/StacingSats");
  assert.equal(parsed?.metadata.profileImage, "https://unavatar.io/x/StacingSats");
});

test("rejects unrelated X oEmbed providers", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/pryszkie",
    icon: "x",
  });
  const payload = JSON.stringify({
    provider_name: "Not Twitter",
    title: "@pryszkie on X",
    html: "<blockquote>Posts by pryszkie</blockquote>",
  });

  // Act / Assert
  assert.throws(() => target?.parse(payload), /expected oEmbed provider 'Twitter' or 'X'/u);
});

test("rejects placeholder payloads from the current X oEmbed provider", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/pryszkie",
    icon: "x",
  });
  const payload = JSON.stringify({
    provider_name: "X",
    title: "",
    html: "<blockquote>Nothing to see here. This account doesn't exist.</blockquote>",
  });

  // Act / Assert
  assert.throws(() => target?.parse(payload), /placeholder oEmbed payload/u);
});

test("parses X community crawler metadata into a banner-first payload", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/i/communities/1871996451812769951",
    icon: "x",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="PARANOID BITCOIN ANARCHISTS" />
        <meta
          property="og:description"
          content="Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns"
        />
        <meta
          property="og:image"
          content="https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig"
        />
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "PARANOID BITCOIN ANARCHISTS");
  assert.equal(
    parsed?.metadata.description,
    "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
  );
  assert.equal(
    parsed?.metadata.image,
    "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
  );
  assert.equal(
    parsed?.metadata.ogImage,
    "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
  );
  assert.equal(parsed?.metadata.profileImage, undefined);
  assert.equal(parsed?.metadata.sourceLabel, "x.com");
});

test("accepts X community metadata when the page also includes incidental sign-in copy", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/i/communities/1871996451812769951",
    icon: "x",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="PARANOID BITCOIN ANARCHISTS" />
        <meta
          property="og:description"
          content="Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns"
        />
        <meta
          property="og:image"
          content="https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig"
        />
      </head>
      <body>
        <nav>
          <a href="/i/flow/login">Sign in</a>
          <a href="/i/flow/signup">Log in</a>
        </nav>
      </body>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "PARANOID BITCOIN ANARCHISTS");
  assert.equal(
    parsed?.metadata.description,
    "Hold your keys | Run a Node Paranoid: Question everything Bitcoin: Don’t trust, verify. Anarchists: We build, laugh, and ignore conspiring fiat clowns",
  );
  assert.equal(
    parsed?.metadata.image,
    "https://pbs.twimg.com/community_banner_img/1997471355478892544/GydvYqIp?format=jpg&name=orig",
  );
});

test("resolves a Medium public augmentation target that uses the profile feed", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://medium.com/@peterryszkiewicz",
    icon: "medium",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "medium-public-feed");
  assert.equal(target.sourceUrl, "https://medium.com/feed/@peterryszkiewicz");
});

test("parses Medium feed metadata into a complete preview payload", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://medium.com/@peterryszkiewicz",
    icon: "medium",
  });
  const xml = `
    <rss>
      <channel>
        <title><![CDATA[Stories by Peter Ryszkiewicz on Medium]]></title>
        <description><![CDATA[Stories by Peter Ryszkiewicz on Medium]]></description>
        <link>https://medium.com/@peterryszkiewicz?source=rss-test</link>
        <image>
          <url>https://cdn-images-1.medium.com/fit/c/150/150/example.jpg</url>
        </image>
      </channel>
    </rss>
  `;

  // Act
  const parsed = target?.parse(xml);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.handle, "peterryszkiewicz");
  assert.equal(parsed?.metadata.sourceLabel, "medium.com");
  assert.equal(parsed?.metadata.image, "https://cdn-images-1.medium.com/fit/c/150/150/example.jpg");
  assert.equal(
    parsed?.metadata.profileImage,
    "https://cdn-images-1.medium.com/fit/c/150/150/example.jpg",
  );
});
