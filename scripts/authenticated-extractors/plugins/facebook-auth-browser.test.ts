import assert from "node:assert/strict";
import test from "node:test";
import { isGenericFacebookHeading, resolveFacebookProfileTarget } from "./facebook-auth-browser";

test("normalizes Facebook people-page URLs for authenticated extraction", () => {
  // Arrange
  const sourceUrl = "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/";

  // Act
  const resolved = resolveFacebookProfileTarget(sourceUrl);

  // Assert
  assert.deepEqual(resolved, {
    identifier: "Bright-Builds-LLC",
    canonicalUrl: "https://www.facebook.com/people/Bright-Builds-LLC/61588043858384/",
  });
});

test("normalizes Facebook profile.php id URLs for authenticated extraction", () => {
  // Arrange
  const sourceUrl = "https://www.facebook.com/profile.php?id=123456789";

  // Act
  const resolved = resolveFacebookProfileTarget(sourceUrl);

  // Assert
  assert.deepEqual(resolved, {
    identifier: "123456789",
    canonicalUrl: "https://www.facebook.com/123456789",
  });
});

test("treats Facebook chrome headings as generic during profile metadata extraction", () => {
  // Arrange
  const chromeHeadings = ["Chats", "Messages", "Notifications"];

  // Act
  const results = chromeHeadings.map((heading) => isGenericFacebookHeading(heading));

  // Assert
  assert.deepEqual(results, [true, true, true]);
  assert.equal(isGenericFacebookHeading("Peter Ryszkiewicz"), false);
});
