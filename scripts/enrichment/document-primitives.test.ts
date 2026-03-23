import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeEntities,
  detectPlaceholderSignals,
  extractDocumentMetadata,
} from "./document-primitives";

const documentWithHead = (head: string, titleText = "Fallback Title"): string =>
  `<!doctype html><html><head>${head}<title>${titleText}</title></head><body></body></html>`;

test("extractDocumentMetadata prefers og metadata and resolves relative image urls", () => {
  // Arrange
  const html = documentWithHead(
    [
      '<meta property="og:title" content="Alice &amp; Bob" />',
      '<meta property="og:description" content="Profile &#35;1" />',
      '<meta property="og:image" content="/image.jpg?size=100&amp;fit=crop" />',
      '<meta name="twitter:image" content="/twitter-image.jpg" />',
    ].join(""),
  );

  // Act
  const parsed = extractDocumentMetadata(html, "https://example.com/profile");

  // Assert
  assert.equal(parsed.metadata.title, "Alice & Bob");
  assert.equal(parsed.metadata.description, "Profile #1");
  assert.equal(parsed.metadata.ogImage, "https://example.com/image.jpg?size=100&fit=crop");
  assert.equal(parsed.metadata.twitterImage, "https://example.com/twitter-image.jpg");
  assert.equal(parsed.metadata.image, "https://example.com/image.jpg?size=100&fit=crop");
  assert.equal(parsed.completeness, "full");
});

test("extractDocumentMetadata falls back to json-ld organization logo when social image tags are missing", () => {
  // Arrange
  const html = documentWithHead(
    [
      '<meta property="og:title" content="Bitcoin Black Sheep" />',
      '<meta property="og:description" content="Public metadata is present." />',
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: "Bitcoin Black Sheep",
            logo: {
              "@type": "ImageObject",
              url: "/wp-content/uploads/logo.png",
            },
          },
        ],
      })}</script>`,
    ].join(""),
  );

  // Act
  const parsed = extractDocumentMetadata(html, "https://bitcoinblacksheep.com/");

  // Assert
  assert.equal(parsed.metadata.image, "https://bitcoinblacksheep.com/wp-content/uploads/logo.png");
  assert.equal(parsed.metadata.ogImage, undefined);
  assert.equal(parsed.metadata.twitterImage, undefined);
  assert.equal(parsed.completeness, "full");
});

test("generic helpers preserve entity decoding, completeness classification, and placeholder matching", () => {
  // Arrange
  const html = documentWithHead('<meta property="og:title" content="Tom &amp; Jerry" />');

  // Act
  const parsed = extractDocumentMetadata(html, "https://example.com/profile");
  const decoded = decodeEntities("Cats &amp; Dogs &apos;friends&apos;");
  const placeholderSignals = detectPlaceholderSignals("Just a moment\nSign in", [
    { label: "challenge", pattern: /just a moment/i },
    { label: "signin", pattern: /sign in/i },
  ]);

  // Assert
  assert.equal(parsed.completeness, "partial");
  assert.deepEqual(parsed.missing, ["description", "image"]);
  assert.equal(decoded, "Cats & Dogs 'friends'");
  assert.deepEqual(placeholderSignals, ["challenge", "signin"]);
});
