import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
  PAYMENT_CARD_EFFECT_ROUTE_PATHS,
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  PAYMENT_CARD_EFFECT_VIDEO_BOMBASTICITY_LEVELS,
  buildPaymentCardEffectCaptureSearchParams,
  isPaymentCardEffectRoutePath,
  paymentCardEffectDemoSections,
} from "./card-effect-samples";

test("payment card effect routes include both the internal capture path and the hidden demo alias", () => {
  // Arrange
  const routePaths = PAYMENT_CARD_EFFECT_ROUTE_PATHS;

  // Act
  const matchesInternal = isPaymentCardEffectRoutePath(PAYMENT_CARD_EFFECT_SAMPLES_PATH);
  const matchesHiddenAlias = isPaymentCardEffectRoutePath(PAYMENT_CARD_EFFECT_EASTER_EGG_PATH);
  const matchesBasePrefixedAlias = isPaymentCardEffectRoutePath(
    `/open-links${PAYMENT_CARD_EFFECT_EASTER_EGG_PATH}`,
  );

  // Assert
  assert.deepEqual(routePaths, [
    PAYMENT_CARD_EFFECT_SAMPLES_PATH,
    PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
  ]);
  assert.equal(matchesInternal, true);
  assert.equal(matchesHiddenAlias, true);
  assert.equal(matchesBasePrefixedAlias, true);
  assert.equal(isPaymentCardEffectRoutePath("/"), false);
});

test("payment card effect demo sections include both showcase and practical example cards", () => {
  // Arrange
  const sections = paymentCardEffectDemoSections;

  // Act
  const showcase = sections.find((section) => section.id === "effect-showcase");
  const examples = sections.find((section) => section.id === "example-cards");
  const multiRailExample = examples?.cards.find(
    (card) => card.link.payment?.rails && card.link.payment.rails.length > 1,
  );
  const baselineExample = examples?.cards.find(
    (card) => card.id === "classic-tip-jar" && !card.link.payment?.effects,
  );

  // Assert
  assert.ok(showcase);
  assert.ok(examples);
  assert.equal(showcase.cards.length >= 4, true);
  assert.equal(examples.cards.length >= 4, true);
  assert.ok(multiRailExample);
  assert.ok(baselineExample);
});

test("payment card effect capture helpers keep the committed bombasticity ladder stable", () => {
  // Arrange
  const fixtureId = "lightning-default-combo";

  // Act
  const searchParams = buildPaymentCardEffectCaptureSearchParams({
    fixtureId,
    bombasticity: 0.75,
  });

  // Assert
  assert.deepEqual(PAYMENT_CARD_EFFECT_VIDEO_BOMBASTICITY_LEVELS, [0.25, 0.5, 0.75, 1]);
  assert.equal(searchParams.get("capture"), "1");
  assert.equal(searchParams.get("fixture"), fixtureId);
  assert.equal(searchParams.get("bombasticity"), "0.75");
});
