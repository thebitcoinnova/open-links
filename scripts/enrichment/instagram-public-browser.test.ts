import assert from "node:assert/strict";
import test from "node:test";
import { parseInstagramPublicProfileMetrics } from "./instagram-public-browser";

test("parses Instagram public browser follower and following counts", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://www.instagram.com/peterryszkiewicz/",
    title: "Peter Justice For The Victims Ryszkiewicz (@peterryszkiewicz)",
    bodyText:
      "Log In Sign Up peterryszkiewicz Peter Justice For The Victims Ryszkiewicz 10 posts 100 followers 206 following No Taxation Without Representation",
    metricTexts: ["100 followers", "206 following"],
  };

  // Act
  const parsed = parseInstagramPublicProfileMetrics(snapshot);

  // Assert
  assert.equal(parsed.followersCount, 100);
  assert.equal(parsed.followersCountRaw, "100 followers");
  assert.equal(parsed.followingCount, 206);
  assert.equal(parsed.followingCountRaw, "206 following");
  assert.deepEqual(parsed.placeholderSignals, []);
});

test("detects terminal Instagram browser placeholder pages", () => {
  // Arrange
  const snapshot = {
    currentUrl: "https://www.instagram.com/accounts/login/",
    title: "Login • Instagram",
    bodyText: "Log in to continue.",
  };

  // Act
  const parsed = parseInstagramPublicProfileMetrics(snapshot);

  // Assert
  assert.deepEqual(parsed.placeholderSignals, ["login_redirect"]);
  assert.equal(parsed.followersCountRaw, undefined);
  assert.equal(parsed.followingCountRaw, undefined);
});
