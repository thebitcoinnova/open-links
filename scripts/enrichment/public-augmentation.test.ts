import assert from "node:assert/strict";
import test from "node:test";
import {
  extractYoutubeProfileImageUrl,
  extractYoutubeSubscriberCountRaw,
  parseInstagramProfileMetadata,
  parseYoutubeProfileMetadata,
  resolvePublicAugmentationTarget,
} from "./public-augmentation";

test("resolves an X public augmentation target that uses oEmbed instead of direct page fetch", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/pryszkie",
    icon: "x",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "x-public-oembed");
  assert.equal(target.acceptHeader, "application/json");
  assert.match(target.sourceUrl, /^https:\/\/publish\.twitter\.com\/oembed\?/);
});

test("resolves an X community augmentation target that fetches the community page directly", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/i/communities/1871996451812769951",
    icon: "x",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "x-public-community");
  assert.equal(target.sourceUrl, "https://x.com/i/communities/1871996451812769951");
  assert.equal(target.acceptHeader, undefined);
});

test("resolves a Club Orange referral-host augmentation target to the canonical signup page", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://signup.cluborange.org/co/PrySzkie-42",
    icon: "cluborange",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "cluborange-referral-signup");
  assert.equal(target.originalUrl, "https://signup.cluborange.org/co/PrySzkie-42");
  assert.equal(target.sourceUrl, "https://www.cluborange.org/signup?referral=PrySzkie-42");
});

test("resolves a canonical Club Orange signup referral URL through the same augmentation target", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://www.cluborange.org/signup?referral=PrySzkie-42",
    icon: "cluborange",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "cluborange-referral-signup");
  assert.equal(target.originalUrl, "https://www.cluborange.org/signup?referral=PrySzkie-42");
  assert.equal(target.sourceUrl, "https://www.cluborange.org/signup?referral=PrySzkie-42");
});

test("parses Club Orange referral signup metadata from the canonical public signup page", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://signup.cluborange.org/co/pryszkie",
    icon: "cluborange",
  });
  const html = `
    <html>
      <head>
        <title>Join Club Orange — Connect with 19K+ Bitcoiners</title>
        <meta
          name="description"
          content="Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats."
        />
        <meta property="og:title" content="Join Club Orange — Connect with 19K+ Bitcoiners" />
        <meta
          property="og:description"
          content="Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats."
        />
        <meta
          property="og:image"
          content="https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp"
        />
        <meta property="twitter:title" content="Join Club Orange — Connect with 19K+ Bitcoiners" />
        <meta
          property="twitter:description"
          content="Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats."
        />
        <meta
          property="twitter:image"
          content="https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp"
        />
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Join Club Orange — Connect with 19K+ Bitcoiners");
  assert.equal(
    parsed?.metadata.description,
    "Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.equal(
    parsed?.metadata.image,
    "https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp",
  );
  assert.equal(
    parsed?.metadata.ogImage,
    "https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp",
  );
  assert.equal(
    parsed?.metadata.twitterImage,
    "https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp",
  );
  assert.equal(parsed?.metadata.sourceLabel, "signup.cluborange.org");
  assert.equal(parsed?.metadata.profileImage, undefined);
});

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

test("resolves a Substack public augmentation target for a custom-domain profile homepage", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
    metadataHandle: "@peterryszkiewicz",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "substack-public-profile");
  assert.equal(target.sourceUrl, "https://substack.com/@peterryszkiewicz");
});

test("falls back to the original Substack URL when no canonical handle is available", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "substack-public-profile");
  assert.equal(target.sourceUrl, "https://peter.ryszkiewicz.us/");
});

test("parses Substack profile metadata from JSON-LD and ignores the subscribe-card preview image", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Peter Ryszkiewicz | Substack" />
        <meta property="og:description" content="Fallback subscribe-card description" />
        <meta property="og:image" content="https://substackcdn.com/image/fetch/subscribe-card.jpg" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Peter Ryszkiewicz",
            "url": "https://substack.com/@peterryszkiewicz",
            "jobTitle": "Software Engineer",
            "image": "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg"
          }
        </script>
        <script>
          window._preloads = JSON.parse("{\\"pub\\":{\\"name\\":\\"Wrong Name\\",\\"subdomain\\":\\"wrong-handle\\",\\"hero_text\\":\\"Wrong hero\\",\\"logo_url\\":\\"https://substackcdn.com/logo.png\\"}}")
        </script>
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Peter Ryszkiewicz");
  assert.equal(parsed?.metadata.description, "Software Engineer");
  assert.equal(parsed?.metadata.handle, "peterryszkiewicz");
  assert.equal(
    parsed?.metadata.image,
    "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
  );
  assert.equal(parsed?.metadata.ogImage, "https://substackcdn.com/image/fetch/subscribe-card.jpg");
  assert.equal(
    parsed?.metadata.profileImage,
    "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
  );
});

test("preserves a distinct Substack social image when it differs from the profile avatar", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Peter Ryszkiewicz | Substack" />
        <meta property="og:description" content="Software Engineer" />
        <meta
          property="og:image"
          content="https://substackcdn.com/image/fetch/$s_!DDCm!,f_auto,q_auto:best,fl_progressive:steep/https%3A%2F%2Fsubstack.com%2Fapi%2Fv1%2Fprofile%2Fassets%2F10297976%2Flight%3FaspectRatio%3Dlink%26version%3D1"
        />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Peter Ryszkiewicz",
            "url": "https://substack.com/@peterryszkiewicz",
            "jobTitle": "Software Engineer",
            "image": "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg"
          }
        </script>
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(
    parsed?.metadata.image,
    "https://substackcdn.com/image/fetch/$s_!DDCm!,f_auto,q_auto:best,fl_progressive:steep/https%3A%2F%2Fsubstack.com%2Fapi%2Fv1%2Fprofile%2Fassets%2F10297976%2Flight%3FaspectRatio%3Dlink%26version%3D1",
  );
  assert.equal(
    parsed?.metadata.ogImage,
    "https://substackcdn.com/image/fetch/$s_!DDCm!,f_auto,q_auto:best,fl_progressive:steep/https%3A%2F%2Fsubstack.com%2Fapi%2Fv1%2Fprofile%2Fassets%2F10297976%2Flight%3FaspectRatio%3Dlink%26version%3D1",
  );
  assert.equal(
    parsed?.metadata.profileImage,
    "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
  );
});

test("preserves a Substack custom-domain source label while reading subscriber counts from the canonical profile", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
    metadataHandle: "@peterryszkiewicz",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Peter Ryszkiewicz | Substack" />
        <meta property="og:description" content="Software Engineer" />
        <script>
          window._preloads = JSON.parse("{\\"profile\\":{\\"name\\":\\"Peter Ryszkiewicz\\",\\"handle\\":\\"peterryszkiewicz\\",\\"bio\\":\\"Software Engineer\\",\\"photo_url\\":\\"https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg\\",\\"subscriberCountString\\":\\"10 subscribers\\",\\"subscriberCountNumber\\":10}}")
        </script>
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(target?.sourceUrl, "https://substack.com/@peterryszkiewicz");
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.sourceLabel, "peter.ryszkiewicz.us");
  assert.equal(parsed?.metadata.handle, "peterryszkiewicz");
  assert.equal(parsed?.metadata.subscribersCount, 10);
  assert.equal(parsed?.metadata.subscribersCountRaw, "10 subscribers");
  assert.equal(
    parsed?.metadata.profileImage,
    "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
  );
});

test("falls back to Substack preloads data when JSON-LD person metadata is absent", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://peter.ryszkiewicz.us/",
    icon: "substack",
  });
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Peter Ryszkiewicz | Substack" />
        <meta property="og:description" content="Fallback subscribe-card description" />
        <meta property="og:image" content="https://substackcdn.com/image/fetch/subscribe-card.jpg" />
        <script>
          window._preloads = JSON.parse("{\\"pub\\":{\\"name\\":\\"Peter Ryszkiewicz\\",\\"subdomain\\":\\"peterryszkiewicz\\",\\"hero_text\\":\\"Software Engineer\\",\\"logo_url\\":\\"https://substack-post-media.s3.amazonaws.com/public/images/logo.png\\"},\\"posts\\":[{\\"publishedBylines\\":[{\\"name\\":\\"Peter Ryszkiewicz\\",\\"handle\\":\\"peterryszkiewicz\\",\\"bio\\":\\"Software Engineer\\",\\"photo_url\\":\\"https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg\\"}]}]}")
        </script>
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Peter Ryszkiewicz");
  assert.equal(parsed?.metadata.description, "Software Engineer");
  assert.equal(parsed?.metadata.handle, "peterryszkiewicz");
  assert.equal(
    parsed?.metadata.profileImage,
    "https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg",
  );
});

test("parses Instagram follower and following counts from the profile description", () => {
  // Arrange
  const description =
    "86 Followers, 169 Following, 36 Posts - See Instagram photos and videos from Example (@example)";

  // Act
  const parsed = parseInstagramProfileMetadata(description);

  // Assert
  assert.deepEqual(parsed, {
    followersCount: 86,
    followersCountRaw: "86 Followers",
    followingCount: 169,
    followingCountRaw: "169 Following",
  });
});

test("preserves raw Instagram count text when compact notation is used", () => {
  // Arrange
  const description =
    "1.2K Followers, 980 Following, 36 Posts - See Instagram photos and videos from Example (@example)";

  // Act
  const parsed = parseInstagramProfileMetadata(description);

  // Assert
  assert.equal(parsed.followersCount, 1200);
  assert.equal(parsed.followersCountRaw, "1.2K Followers");
  assert.equal(parsed.followingCount, 980);
  assert.equal(parsed.followingCountRaw, "980 Following");
});

test("extracts YouTube subscriber text from the page header metadata rows", () => {
  // Arrange
  const html =
    '"metadataRows":[{"metadataParts":[{"text":{"content":"@example"}}]},{"metadataParts":[{"text":{"content":"1.2K subscribers"},"accessibilityLabel":"1.2K subscribers"},{"text":{"content":"4 videos"}}]}],"delimiter":"•"';

  // Act
  const subscriberText = extractYoutubeSubscriberCountRaw(html);
  const parsed = parseYoutubeProfileMetadata(html);

  // Assert
  assert.equal(subscriberText, "1.2K subscribers");
  assert.deepEqual(parsed, {
    subscribersCount: 1200,
    subscribersCountRaw: "1.2K subscribers",
  });
});

test("extracts YouTube subscriber text from the current about-page channel view model", () => {
  // Arrange
  const html =
    '"aboutChannelViewModel":{"description":"Podcast clips","subscriberCountText":"131 subscribers","viewCountText":"24,399 views","canonicalChannelUrl":"http://www.youtube.com/@Livewiththehive","channelId":"UC9N1jIBZAC-20yYEpkeIbFA"}';

  // Act
  const subscriberText = extractYoutubeSubscriberCountRaw(html);
  const parsed = parseYoutubeProfileMetadata(html);

  // Assert
  assert.equal(subscriberText, "131 subscribers");
  assert.deepEqual(parsed, {
    subscribersCount: 131,
    subscribersCountRaw: "131 subscribers",
  });
});

test("parses YouTube about-page enrichment metadata with subscriber counts", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://youtube.com/@livewiththehive?si=tQizrqZ7AVqSBimH&sub_confirmation=1",
    icon: "youtube",
  });
  const html = `
    <html>
      <head>
        <title>Live with the Hive - YouTube</title>
        <meta property="og:title" content="Live with the Hive" />
        <meta property="og:description" content="Hive Minded podcast clips and updates." />
        <meta property="og:image" content="https://i.ytimg.com/vi/example/hqdefault.jpg" />
        <link itemprop="thumbnailUrl" href="https://yt3.googleusercontent.com/live-with-the-hive=s900-c-k-c0x00ffffff-no-rj" />
      </head>
      <body>
        "aboutChannelViewModel":{"description":"Podcast clips","subscriberCountText":"131 subscribers","viewCountText":"24,399 views","canonicalChannelUrl":"http://www.youtube.com/@Livewiththehive","channelId":"UC9N1jIBZAC-20yYEpkeIbFA"}
      </body>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(target?.id, "youtube-public-profile");
  assert.equal(target?.sourceUrl, "https://www.youtube.com/@livewiththehive/about");
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Live with the Hive");
  assert.equal(parsed?.metadata.description, "Hive Minded podcast clips and updates.");
  assert.equal(parsed?.metadata.image, "https://i.ytimg.com/vi/example/hqdefault.jpg");
  assert.equal(
    parsed?.metadata.profileImage,
    "https://yt3.googleusercontent.com/live-with-the-hive=s900-c-k-c0x00ffffff-no-rj",
  );
  assert.equal(parsed?.metadata.subscribersCount, 131);
  assert.equal(parsed?.metadata.subscribersCountRaw, "131 subscribers");
  assert.equal(parsed?.metadata.sourceLabel, "youtube.com");
});

test("prefers the explicit YouTube thumbnailUrl profile image surface", () => {
  // Arrange
  const html = [
    '<link itemprop="thumbnailUrl" href="https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj">',
    '"channelMetadataRenderer":{"avatar":{"thumbnails":[{"url":"https://yt3.googleusercontent.com/fallback=s900-c-k-c0x00ffffff-no-rj"}]}}',
  ].join("");

  // Act
  const profileImageUrl = extractYoutubeProfileImageUrl(html);

  // Assert
  assert.equal(
    profileImageUrl,
    "https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj",
  );
});
