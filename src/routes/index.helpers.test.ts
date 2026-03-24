import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL,
  resolvePaymentCardEffectGalleryMenuHref,
} from "./index.helpers";

test("payment card effect gallery menu label stays explicit about its temporary testing role", () => {
  // Assert
  assert.equal(PAYMENT_CARD_EFFECT_GALLERY_MENU_LABEL, "Testing: tip card sparks");
});

test("payment card effect gallery menu href respects the app base path", () => {
  // Assert
  assert.equal(resolvePaymentCardEffectGalleryMenuHref("/"), "/spark/tip-cards");
  assert.equal(
    resolvePaymentCardEffectGalleryMenuHref("/open-links/"),
    "/open-links/spark/tip-cards",
  );
});
