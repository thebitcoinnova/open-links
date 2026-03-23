import assert from "node:assert/strict";
import test from "node:test";
import { resolveLinkKind, resolveLinkUrlScheme, resolveMailtoAddress } from "./link-kind";

test("parses mailto addresses without query params into contact-link values", () => {
  // Act
  const resolved = resolveLinkKind(undefined, "mailto:hello@example.com");

  // Assert
  assert.deepEqual(resolved, {
    kind: "contact",
    scheme: "mailto",
    contactKind: "email",
    value: "hello@example.com",
  });
});

test("parses mailto addresses with query params while preserving authored casing", () => {
  // Act
  const address = resolveMailtoAddress("mailto:Hello.Team@example.com?subject=Hi%20there");

  // Assert
  assert.equal(address, "Hello.Team@example.com");
});

test("resolves tel links as contact kinds for future contact-scheme handling", () => {
  // Act
  const resolved = resolveLinkKind(undefined, "tel:+13125551212");

  // Assert
  assert.deepEqual(resolved, {
    kind: "contact",
    scheme: "tel",
    contactKind: "telephone",
    value: "+13125551212",
  });
});

test("reports the normalized url scheme for supported contact links", () => {
  // Act
  const mailScheme = resolveLinkUrlScheme("mailto:hello@example.com");
  const telScheme = resolveLinkUrlScheme("tel:+13125551212");

  // Assert
  assert.equal(mailScheme, "mailto");
  assert.equal(telScheme, "tel");
});
