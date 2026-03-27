import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL,
  resolveLinkQrDialogTarget,
  resolvePaymentCardEffectGalleryMenuHref,
  resolveProfileQrDialogTarget,
} from "./index.helpers";

const decodeSvgDataUrl = (value: string): string => {
  const prefix = "data:image/svg+xml;charset=utf-8,";

  assert.ok(value.startsWith(prefix));
  return decodeURIComponent(value.slice(prefix.length));
};

const originalFetch = globalThis.fetch;

const withMockBadgeAssetFetch = async (callback: () => Promise<void>) => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.endsWith(".jpg")) {
      return new Response("avatar-bytes", {
        headers: {
          "content-type": "image/jpeg",
        },
        status: 200,
      });
    }

    if (url.endsWith(".svg")) {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        headers: {
          "content-type": "image/svg+xml",
        },
        status: 200,
      });
    }

    return new Response("not found", {
      status: 404,
    });
  };

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("payment card effect gallery menu label stays concise in the utility menu", () => {
  // Assert
  assert.equal(PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL, "Tip card sparks");
});

test("payment card effect gallery menu href respects the app base path", () => {
  // Assert
  assert.equal(resolvePaymentCardEffectGalleryMenuHref("/"), "/spark/tip-cards");
  assert.equal(
    resolvePaymentCardEffectGalleryMenuHref("/open-links/"),
    "/open-links/spark/tip-cards",
  );
});

test("profile QR dialog targets embed photo assets inside composed badges", async () => {
  await withMockBadgeAssetFetch(async () => {
    // Act
    const target = await resolveProfileQrDialogTarget({
      baseUrl: "https://openlinks.local/",
      payload: "https://openlinks.us",
      profile: {
        avatar: "/cache/profile-avatar/profile-avatar.jpg",
        bio: "Engineer",
        headline: "Builder",
        name: "Peter Ryszkiewicz",
      },
      siteLogoUrl: "/branding/openlinks-logo/openlinks-logo.svg",
    });

    // Assert
    assert.ok(target.logoUrl);
    assert.match(String(target.logoUrl), /^data:image\/svg\+xml/u);
    const svg = decodeSvgDataUrl(String(target.logoUrl));
    assert.match(svg, /data:image\/jpeg;base64,/u);
    assert.match(svg, /data:image\/svg\+xml;base64,/u);
    assert.doesNotMatch(svg, /\/cache\/profile-avatar\/profile-avatar\.jpg/u);
  });
});

test("link QR dialog targets embed profile photos inside composed badges", async () => {
  await withMockBadgeAssetFetch(async () => {
    // Act
    const target = await resolveLinkQrDialogTarget({
      baseUrl: "https://openlinks.local/",
      link: {
        id: "facebook",
        label: "Facebook",
        type: "rich",
        icon: "facebook",
        url: "https://www.facebook.com/peter.ryszkiewicz",
        metadata: {
          image: "/cache/content-images/facebook-preview.jpg",
          profileImage: "/cache/content-images/facebook-avatar.jpg",
        },
      },
      payload: "https://www.facebook.com/peter.ryszkiewicz",
    });

    // Assert
    assert.ok(target.logoUrl);
    assert.match(String(target.logoUrl), /^data:image\/svg\+xml/u);
    const svg = decodeSvgDataUrl(String(target.logoUrl));
    assert.match(svg, /data:image\/jpeg;base64,/u);
    assert.match(svg, /#1877F2/u);
    assert.doesNotMatch(svg, /\/cache\/content-images\/facebook-avatar\.jpg/u);
  });
});

test("link QR dialog targets keep plain asset URLs when only one identity resolves", async () => {
  // Act
  const target = await resolveLinkQrDialogTarget({
    link: {
      id: "article",
      label: "Article",
      type: "rich",
      url: "https://example.com/articles/1",
      metadata: {
        image: "/cache/content-images/article-preview.jpg",
      },
    },
    payload: "https://example.com/articles/1",
  });

  // Assert
  assert.equal(target.logoUrl, "/cache/content-images/article-preview.jpg");
});
