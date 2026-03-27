import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink } from "../content/load-content";
import { resolvePaymentQrLogoUrl } from "./qr-badges";
import { resolvePaymentRailLogoUrl } from "./rail-logos";

const decodeSvgDataUrl = (value: string): string => {
  const prefix = "data:image/svg+xml;charset=utf-8,";

  assert.ok(value.startsWith(prefix));
  return decodeURIComponent(value.slice(prefix.length));
};

const clubOrangeLightningLink = {
  id: "cluborange-lightning-tips",
  label: "Club Orange Tips",
  type: "payment",
  icon: "cluborange",
} satisfies OpenLink;

const clubOrangeLightningRail = {
  id: "lightning",
  rail: "lightning",
  address: "peterryszkiewicz@cluborange.org",
} as const;

const strikeLightningLink = {
  id: "strike-lightning-tips",
  label: "Strike Tips",
  type: "payment",
  icon: "strike",
} satisfies OpenLink;

const strikeLightningRail = {
  id: "lightning",
  rail: "lightning",
  address: "pryszkie@strike.me",
} as const;

const lightningOnlyLink = {
  id: "lightning-tips",
  label: "Lightning Tips",
  type: "payment",
} satisfies OpenLink;

const lightningOnlyRail = {
  id: "lightning",
  rail: "lightning",
  address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
} as const;

test("default payment QR logos compose site and rail identities when both resolve", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    link: clubOrangeLightningLink,
    rail: clubOrangeLightningRail,
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#E86B10/u);
  assert.match(svg, /#F2A900/u);
});

test("auto QR badges compose Strike and Lightning when both resolve", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    link: strikeLightningLink,
    rail: strikeLightningRail,
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#111111/u);
  assert.match(svg, /#F2A900/u);
});

test("payment QR logos fall back to the rail logo when no site identity resolves", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    link: lightningOnlyLink,
    rail: lightningOnlyRail,
  });

  // Assert
  assert.equal(
    resolved,
    resolvePaymentRailLogoUrl({
      railType: "lightning",
    }),
  );
});

test("explicit rail logo mode still overrides the implicit composite default", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    link: clubOrangeLightningLink,
    logoMode: "rail-default",
    rail: clubOrangeLightningRail,
  });

  // Assert
  assert.equal(
    resolved,
    resolvePaymentRailLogoUrl({
      logoMode: "rail-default",
      railType: "lightning",
    }),
  );
});

test("legacy single-logo configuration still works without a badge override", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    link: lightningOnlyLink,
    customLogoUrl: "/payment-logos/paypal.svg",
    logoMode: "custom",
    rail: lightningOnlyRail,
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
