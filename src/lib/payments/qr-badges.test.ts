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

const assertSvgRenderOrder = (svg: string, firstColor: string, secondColor: string): void => {
  const firstIndex = svg.indexOf(firstColor);
  const secondIndex = svg.indexOf(secondColor);

  assert.notEqual(firstIndex, -1, `${firstColor} should appear in the composed badge SVG.`);
  assert.notEqual(secondIndex, -1, `${secondColor} should appear in the composed badge SVG.`);
  assert.ok(
    firstIndex < secondIndex,
    `${firstColor} should render before ${secondColor} in the composed badge SVG.`,
  );
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
  assertSvgRenderOrder(svg, "#F2A900", "#E86B10");
});

test("auto QR badges compose Strike and Lightning when provider is explicit", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    link: lightningOnlyLink,
    rail: {
      ...lightningOnlyRail,
      provider: "strike",
    },
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#111111/u);
  assert.match(svg, /#F2A900/u);
  assertSvgRenderOrder(svg, "#F2A900", "#111111");
});

test("auto QR badges compose Strike and Lightning when provider is inferred from rail URL", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    link: lightningOnlyLink,
    rail: {
      ...lightningOnlyRail,
      url: "https://strike.me/$openlinks",
    },
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#111111/u);
  assert.match(svg, /#F2A900/u);
});

test("auto QR badges compose Strike and Lightning when provider is inferred from icon alias", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    link: lightningOnlyLink,
    rail: {
      ...lightningOnlyRail,
      icon: "strike",
    },
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#111111/u);
  assert.match(svg, /#F2A900/u);
});

test("auto QR badges fall back to the single rail logo when provider matches the rail brand", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
    link: {
      id: "cashapp-support",
      label: "Cash App Support",
      type: "payment",
    },
    rail: {
      id: "cashapp",
      rail: "cashapp",
      provider: "cashapp",
      url: "https://cash.app/$openlinks",
    },
  });

  // Assert
  assert.equal(
    resolved,
    resolvePaymentRailLogoUrl({
      railType: "cashapp",
    }),
  );
});

test("payment QR logos fall back to the rail logo when no provider identity resolves", () => {
  // Act
  const resolved = resolvePaymentQrLogoUrl({
    badge: {
      mode: "auto",
    },
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

test("custom QR badge mode overrides inferred provider composition", () => {
  // Act
  const logoUrl = resolvePaymentQrLogoUrl({
    badge: {
      mode: "custom",
      items: [{ type: "site", value: "paypal" }, { type: "rail" }],
    },
    link: lightningOnlyLink,
    rail: {
      ...lightningOnlyRail,
      provider: "strike",
    },
  });

  // Assert
  assert.ok(logoUrl);
  const svg = decodeSvgDataUrl(logoUrl);
  assert.match(svg, /#003087/u);
  assert.match(svg, /#F2A900/u);
  assert.doesNotMatch(svg, /#111111/u);
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
