import assert from "node:assert/strict";
import test from "node:test";
import { parseMetadata } from "./parse-metadata";

const documentWithMeta = (metaTags: string, titleText = "Fallback Title"): string =>
  `<!doctype html><html><head>${metaTags}<title>${titleText}</title></head><body></body></html>`;

test("decodes decimal and hex numeric entities in metadata text", () => {
  // Arrange
  const html = documentWithMeta(
    [
      '<meta property="og:title" content="Alice &#064;home &#x2022; test" />',
      '<meta property="og:description" content="Status &#35;1 &#x26; growing" />',
      '<meta property="og:image" content="/image.jpg" />',
    ].join(""),
  );

  // Act
  const parsed = parseMetadata(html, "https://example.com/profile");

  // Assert
  assert.equal(parsed.metadata.title, "Alice @home • test");
  assert.equal(parsed.metadata.description, "Status #1 & growing");
  assert.equal(parsed.metadata.ogImage, "https://example.com/image.jpg");
  assert.equal(parsed.metadata.twitterImage, undefined);
  assert.equal(parsed.metadata.image, "https://example.com/image.jpg");
});

test("preserves named entity decoding behavior and adds apos support", () => {
  // Arrange
  const html = documentWithMeta(
    [
      '<meta property="og:title" content="Tom &amp; Jerry &quot;hi&quot; &#39;ok&#39; &apos;yep&apos; &nbsp;done" />',
      '<meta property="og:description" content="Cats &amp; Dogs &apos;friends&apos;" />',
      '<meta property="og:image" content="/image.jpg" />',
    ].join(""),
  );

  // Act
  const parsed = parseMetadata(html, "https://example.com/profile");

  // Assert
  assert.equal(parsed.metadata.title, `Tom & Jerry "hi" 'ok' 'yep'  done`);
  assert.equal(parsed.metadata.description, "Cats & Dogs 'friends'");
});

test("leaves unknown and invalid entities unchanged", () => {
  // Arrange
  const html = documentWithMeta(
    [
      '<meta property="og:title" content="Unknown &notarealentity; keep &#x110000; and &#xD800; and &#xZZ;" />',
      '<meta property="og:description" content="Hold &#99999999; and &fake;" />',
      '<meta property="og:image" content="/image.jpg" />',
    ].join(""),
  );

  // Act
  const parsed = parseMetadata(html, "https://example.com/profile");

  // Assert
  assert.equal(
    parsed.metadata.title,
    "Unknown &notarealentity; keep &#x110000; and &#xD800; and &#xZZ;",
  );
  assert.equal(parsed.metadata.description, "Hold &#99999999; and &fake;");
});

test("decodes entity-encoded image query params and preserves absolute URL resolution", () => {
  // Arrange
  const html = documentWithMeta(
    [
      '<meta property="og:title" content="Title" />',
      '<meta property="og:description" content="Description" />',
      '<meta property="og:image" content="/image.jpg?size=100&amp;fit=crop" />',
    ].join(""),
  );

  // Act
  const parsed = parseMetadata(html, "https://example.com/profile");

  // Assert
  assert.equal(parsed.metadata.ogImage, "https://example.com/image.jpg?size=100&fit=crop");
  assert.equal(parsed.metadata.twitterImage, undefined);
  assert.equal(parsed.metadata.image, "https://example.com/image.jpg?size=100&fit=crop");
});

test("preserves distinct og and twitter image provenance while defaulting image to ogImage", () => {
  // Arrange
  const html = documentWithMeta(
    [
      '<meta property="og:title" content="Title" />',
      '<meta property="og:description" content="Description" />',
      '<meta property="og:image" content="/og-image.jpg" />',
      '<meta name="twitter:image" content="/twitter-image.jpg" />',
    ].join(""),
  );

  // Act
  const parsed = parseMetadata(html, "https://example.com/profile");

  // Assert
  assert.equal(parsed.metadata.ogImage, "https://example.com/og-image.jpg");
  assert.equal(parsed.metadata.twitterImage, "https://example.com/twitter-image.jpg");
  assert.equal(parsed.metadata.image, "https://example.com/og-image.jpg");
});

test("keeps completeness classification unchanged", () => {
  // Arrange
  const fullHtml = documentWithMeta(
    [
      '<meta property="og:title" content="Title" />',
      '<meta property="og:description" content="Description" />',
      '<meta property="og:image" content="/image.jpg" />',
    ].join(""),
  );
  const partialHtml = documentWithMeta('<meta property="og:title" content="Title" />');
  const noneHtml = "<html><head></head><body></body></html>";

  // Act
  const full = parseMetadata(fullHtml, "https://example.com/profile");
  const partial = parseMetadata(partialHtml, "https://example.com/profile");
  const none = parseMetadata(noneHtml, "https://example.com/profile");

  // Assert
  assert.equal(full.completeness, "full");
  assert.deepEqual(full.missing, []);
  assert.equal(partial.completeness, "partial");
  assert.deepEqual(partial.missing, ["description", "image"]);
  assert.equal(none.completeness, "none");
  assert.deepEqual(none.missing, ["title", "description", "image"]);
});
