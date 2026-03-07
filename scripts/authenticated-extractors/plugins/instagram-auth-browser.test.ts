import assert from "node:assert/strict";
import test from "node:test";
import { parseInstagramProfileMetadata } from "./instagram-auth-browser";

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
