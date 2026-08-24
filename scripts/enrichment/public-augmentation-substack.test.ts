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

test("reads Substack custom-domain subscriber counts from publication preloads", () => {
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
          window._preloads = JSON.parse("{\\"pub\\":{\\"author_name\\":\\"Peter Ryszkiewicz\\",\\"author_handle\\":\\"peterryszkiewicz\\",\\"author_bio\\":\\"Software Engineer\\",\\"author_photo_url\\":\\"https://substack-post-media.s3.amazonaws.com/public/images/avatar.jpeg\\",\\"freeSubscriberCount\\":null,\\"freeSubscriberCountOrderOfMagnitude\\":\\"15\\"}}")
        </script>
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.handle, "peterryszkiewicz");
  assert.equal(parsed?.metadata.subscribersCount, 15);
  assert.equal(parsed?.metadata.subscribersCountRaw, "15 subscribers");
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
