import assert from "node:assert/strict";
import test from "node:test";
import { parseRumblePublicProfile, resolveRumbleAboutUrl } from "./rumble-public-profile";

test("rewrites supported Rumble profile urls to their public about pages", () => {
  // Arrange
  const userUrl = "https://rumble.com/user/Vaxxchoice";
  const channelUrl = "https://rumble.com/c/InTheLitterBox/videos";
  const bareChannelUrl = "https://rumble.com/Shmah";

  // Act
  const resolvedUser = resolveRumbleAboutUrl(userUrl);
  const resolvedChannel = resolveRumbleAboutUrl(channelUrl);
  const resolvedBareChannel = resolveRumbleAboutUrl(bareChannelUrl);

  // Assert
  assert.equal(resolvedUser, "https://rumble.com/user/Vaxxchoice/about");
  assert.equal(resolvedChannel, "https://rumble.com/c/InTheLitterBox/about");
  assert.equal(resolvedBareChannel, "https://rumble.com/Shmah/about");
});

test("parses a Rumble user about page into a full public-profile payload", () => {
  // Arrange
  const html = `
    <html>
      <head>
        <title>Vaxxchoice</title>
        <meta property="og:title" content="Vaxxchoice" />
        <meta property="og:image" content="https://1a-1791.com/video/avatar.jpeg" />
      </head>
      <body>
        <div class="channel-header--title">
          <h1>Vaxxchoice</h1>
          <span class="text-fjord"><span>13.5K Followers</span></span>
        </div>
        <div class="channel-header--thumb">
          <img class="channel-header--img" src="https://1a-1791.com/video/avatar.jpeg" alt="Vaxxchoice" />
        </div>
        <div class="channel-about--description">
          <h1 class="channel-about--title">Description</h1>
          <p>At VaxxChoice &amp; Co. we bring truth.</p>
        </div>
      </body>
    </html>
  `;

  // Act
  const parsed = parseRumblePublicProfile("https://rumble.com/user/Vaxxchoice/about", html);

  // Assert
  assert.equal(parsed.completeness, "full");
  assert.equal(parsed.metadata.title, "Vaxxchoice");
  assert.equal(parsed.metadata.description, "At VaxxChoice & Co. we bring truth.");
  assert.equal(parsed.metadata.profileDescription, "At VaxxChoice & Co. we bring truth.");
  assert.equal(parsed.metadata.image, "https://1a-1791.com/video/avatar.jpeg");
  assert.equal(parsed.metadata.profileImage, "https://1a-1791.com/video/avatar.jpeg");
  assert.equal(parsed.metadata.handle, "vaxxchoice");
  assert.equal(parsed.metadata.followersCount, 13500);
  assert.equal(parsed.metadata.followersCountRaw, "13.5K Followers");
  assert.equal(parsed.metadata.sourceLabel, "rumble.com");
});

test("parses a Rumble channel about page while preserving banner and avatar separately", () => {
  // Arrange
  const html = `
    <html>
      <head>
        <title>In The Litter Box w/ Jewels &amp; Catturd</title>
        <meta
          property="og:description"
          content='Browse the most recent videos from channel "In The Litter Box w/ Jewels &amp; Catturd" uploaded to Rumble.com'
        />
        <meta property="og:image" content="https://1a-1791.com/video/banner.jpeg" />
      </head>
      <body>
        <div class="channel-header--title">
          <h1>In The Litter Box w/ Jewels &amp; Catturd</h1>
          <span class="text-fjord"><span>112K Followers</span></span>
        </div>
        <div class="channel-header--thumb">
          <img class="channel-header--img" src="https://1a-1791.com/video/avatar.jpeg" alt="In The Litter Box w/ Jewels &amp; Catturd" />
        </div>
        <div class="channel-about--description">
          <h1 class="channel-about--title">Description</h1>
          <p>In the Litter Box with Jewels &amp; Catturd .. A Talk Show.</p>
        </div>
      </body>
    </html>
  `;

  // Act
  const parsed = parseRumblePublicProfile("https://rumble.com/c/InTheLitterBox/about", html);

  // Assert
  assert.equal(parsed.completeness, "full");
  assert.equal(parsed.metadata.title, "In The Litter Box w/ Jewels & Catturd");
  assert.equal(
    parsed.metadata.description,
    'Browse the most recent videos from channel "In The Litter Box w/ Jewels & Catturd" uploaded to Rumble.com',
  );
  assert.equal(
    parsed.metadata.profileDescription,
    "In the Litter Box with Jewels & Catturd .. A Talk Show.",
  );
  assert.equal(parsed.metadata.image, "https://1a-1791.com/video/banner.jpeg");
  assert.equal(parsed.metadata.ogImage, "https://1a-1791.com/video/banner.jpeg");
  assert.equal(parsed.metadata.profileImage, "https://1a-1791.com/video/avatar.jpeg");
  assert.equal(parsed.metadata.handle, "inthelitterbox");
  assert.equal(parsed.metadata.followersCount, 112000);
  assert.equal(parsed.metadata.followersCountRaw, "112K Followers");
});

test("rejects Rumble placeholder pages instead of caching error html", () => {
  // Arrange
  const html = "<html><head><title>410 Gone</title></head><body>410 Gone</body></html>";

  // Act / Assert
  assert.throws(
    () => parseRumblePublicProfile("https://rumble.com/BarbarianBullet/about", html),
    /placeholder content/,
  );
});
