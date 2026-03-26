import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaymentQrLogoUrl } from "./qr-badges";
import { resolvePaymentRailLogoUrl } from "./rail-logos";

const decodeSvgDataUrl = (value: string): string => {
  const prefix = "data:image/svg+xml;charset=utf-8,";

  assert.ok(value.startsWith(prefix));
  return decodeURIComponent(value.slice(prefix.length));
};

test("auto QR badges compose Club Orange and Lightning when both resolve", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    linkIcon: "cluborange",
    railType: "lightning",
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#E86B10/u);
  assert.match(svg, /#F2A900/u);
});

test("auto QR badges fall back to the legacy rail logo when no platform resolves", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    railType: "lightning",
  });

  // Assert
  assert.equal(
    resolved,
    resolvePaymentRailLogoUrl({
      railType: "lightning",
    }),
  );
});

test("legacy single-logo configuration still works without a badge override", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    customLogoUrl: "/payment-logos/paypal.svg",
    logoMode: "custom",
    railType: "lightning",
  });

  // Assert
  assert.equal(
    resolved,
    resolvePaymentRailLogoUrl({
      customLogoUrl: "/payment-logos/paypal.svg",
      logoMode: "custom",
      railType: "lightning",
    }),
  );
});
