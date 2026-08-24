import assert from "node:assert/strict";
import test from "node:test";
import * as Collapsible from "@kobalte/core/collapsible";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { setPaymentCardEffectDebugTuningValue } from "../../lib/payments/card-effect-debug-tuning";
import { paymentCardEffectDefaultDebugTuning } from "../../lib/payments/card-effect-samples";
import { clearActionToastClient, registerActionToastClient } from "../../lib/ui/action-toast";
import MobileOverflowMenu from "../actions/MobileOverflowMenu";
import StyledPaymentQr from "../payments/StyledPaymentQr";
import { PaymentLinkCard, resolveMobilePaymentRailActionLayout } from "./PaymentLinkCard";

import {
  RenderedElement,
  type RenderedNode,
  assertSvgRenderOrder,
  clubOrangeLightningPaymentLink,
  collectElements,
  countElementsWithClass,
  createPreservingRuntime,
  decodeSvgDataUrl,
  explicitRailLogoPaymentLink,
  firstElementWithClass,
  firstElementWithProp,
  isRenderedElement,
  lightningPaymentLink,
  mixedProviderMultiRailPaymentLink,
  multiRailPaymentLink,
  originalNavigatorDescriptor,
  paymentLink,
  reactRuntime,
  restoreNavigator,
  setNavigator,
  setReactRuntime,
  site,
  strikeLightningPaymentLink,
} from "./PaymentLinkCard.test-helpers";

test("payment rail copy actions emit a toast when clipboard copy succeeds", async () => {
  // Arrange
  const calls: Array<{ message: string; variant: "default" | "error" }> = [];

  registerActionToastClient({
    default: (message: string) => {
      calls.push({ message, variant: "default" });
    },
    error: (message) => {
      calls.push({ message, variant: "error" });
    },
  });

  setNavigator({
    clipboard: {
      writeText: async () => undefined,
    } as unknown as Clipboard,
  } as Navigator);

  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const desktopActionBar = firstElementWithClass(tree, "payment-rail-actions-desktop");
  const copyButton = collectElements(desktopActionBar?.props.children as RenderedNode).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === "Copy Bitcoin payment value",
  );

  assert.ok(copyButton);

  await (copyButton.props.onClick as () => Promise<void>)();

  // Assert
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.message, "Bitcoin copied");
  assert.equal(calls[0]?.variant, "default");

  clearActionToastClient();
  restoreNavigator();
});

test("payment cards pass themeFingerprint to inline QR renderers", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );

  // Act
  const tree = PaymentLinkCard({
    link: paymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "sleek:dark",
  }) as RenderedNode;
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(qr);
  assert.equal(qr.props.themeFingerprint, "sleek:dark");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("payment cards pass site payment QR color defaults to inline QR renderers", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );
  const siteWithPaymentQrDefaults = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        qr: {
          foregroundColorDefault: "#f8fafc",
          backgroundColorDefault: "#101625",
        },
      },
    },
  } satisfies SiteData;

  // Act
  const tree = PaymentLinkCard({
    link: paymentLink,
    site: siteWithPaymentQrDefaults,
    brandIconOptions: resolveBrandIconOptions(siteWithPaymentQrDefaults as SiteData),
    themeFingerprint: "sleek:light",
  }) as RenderedNode;
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(qr);
  assert.equal(qr.props.foregroundColor, "#f8fafc");
  assert.equal(qr.props.backgroundColor, "#101625");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("payment rail QR colors override site payment QR defaults", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );
  const siteWithPaymentQrDefaults = {
    ...site,
    ui: {
      ...site.ui,
      payments: {
        qr: {
          foregroundColorDefault: "#f8fafc",
          backgroundColorDefault: "#101625",
        },
      },
    },
  } satisfies SiteData;
  const paymentLinkWithExplicitQrColors = {
    ...paymentLink,
    payment: {
      ...paymentLink.payment,
      rails: [
        {
          ...paymentLink.payment.rails[0],
          qr: {
            foregroundColor: "#047857",
            backgroundColor: "#ecfdf5",
          },
        },
      ],
    },
  } satisfies OpenLink;

  // Act
  const tree = PaymentLinkCard({
    link: paymentLinkWithExplicitQrColors,
    site: siteWithPaymentQrDefaults,
    brandIconOptions: resolveBrandIconOptions(siteWithPaymentQrDefaults as SiteData),
    themeFingerprint: "sleek:light",
  }) as RenderedNode;
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(qr);
  assert.equal(qr.props.foregroundColor, "#047857");
  assert.equal(qr.props.backgroundColor, "#ecfdf5");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("club orange lightning tip cards resolve a composite QR badge by default", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );

  // Act
  const tree = PaymentLinkCard({
    link: clubOrangeLightningPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;
  const article = collectElements(tree).find((element) => element.type === "article");
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-layout"], "single");
  assert.ok(qr);
  assert.equal(qr.props.logoSize, 0.24);
  assert.match(String(qr.props.logoUrl), /^data:image\/svg\+xml/u);

  const svg = decodeSvgDataUrl(String(qr.props.logoUrl));
  assert.match(svg, /#E86B10/u);
  assert.match(svg, /#F2A900/u);
  assertSvgRenderOrder(svg, "#F2A900", "#E86B10");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("explicit payment QR logo modes still override the default composite badge", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );

  // Act
  const tree = PaymentLinkCard({
    link: explicitRailLogoPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(qr);
  assert.equal(qr.props.logoUrl, "/payment-logos/lightning.svg");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("strike lightning tip cards resolve an auto composite QR badge", () => {
  // Arrange
  setReactRuntime(
    createPreservingRuntime(
      StyledPaymentQr,
      MobileOverflowMenu,
      Collapsible.Root,
      Collapsible.Content,
    ),
  );

  // Act
  const tree = PaymentLinkCard({
    link: strikeLightningPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;
  const article = collectElements(tree).find((element) => element.type === "article");
  const cardIcon = firstElementWithClass(tree, "card-icon");
  const qr = collectElements(tree).find((element) => element.type === StyledPaymentQr);

  // Assert
  assert.ok(article);
  assert.equal(article.props["data-layout"], "single");
  assert.ok(cardIcon);
  assert.equal(cardIcon.props["data-known-site"], "strike");
  assert.ok(qr);
  assert.equal(qr.props.logoSize, 0.24);
  assert.match(String(qr.props.logoUrl), /^data:image\/svg\+xml/u);

  const svg = decodeSvgDataUrl(String(qr.props.logoUrl));
  assert.match(svg, /#111111/u);
  assert.match(svg, /#F2A900/u);
  assertSvgRenderOrder(svg, "#F2A900", "#111111");

  setReactRuntime(
    createPreservingRuntime(MobileOverflowMenu, Collapsible.Root, Collapsible.Content),
  );
});

test("mixed-brand multi-rail payment cards keep the generic wallet header icon", () => {
  // Arrange
  const tree = PaymentLinkCard({
    link: mixedProviderMultiRailPaymentLink,
    site,
    brandIconOptions: resolveBrandIconOptions(site as SiteData),
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const headerIcon = firstElementWithClass(tree, "card-icon");
  const walletIcon = firstElementWithProp(tree, "data-known-site", "wallet");

  // Assert
  assert.ok(headerIcon);
  assert.equal(headerIcon.props["data-known-site"], "wallet");
  assert.ok(walletIcon);
});

test("mobile payment rail action layout keeps open and QR inline before copy", () => {
  // Act
  const layout = resolveMobilePaymentRailActionLayout(["copy", "open", "qr"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["open", "qr"],
    overflowKinds: ["copy"],
  });
});

test("mobile payment rail action layout keeps two actions inline when copy is already primary", () => {
  // Act
  const layout = resolveMobilePaymentRailActionLayout(["copy", "qr"]);

  // Assert
  assert.deepEqual(layout, {
    inlineKinds: ["qr", "copy"],
    overflowKinds: [],
  });
});
