import assert from "node:assert/strict";
import test from "node:test";
import { resetPaymentCardEffectDebugTuningGroup } from "./card-effect-debug-tuning";
import {
  PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
  PAYMENT_CARD_EFFECT_ROUTE_PATHS,
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  PAYMENT_CARD_EFFECT_VIDEO_BOMBASTICITY_LEVELS,
  applyPaymentCardEffectRouteStateSearchParams,
  buildPaymentCardEffectCaptureSearchParams,
  buildPaymentCardEffectRouteSearchParams,
  isPaymentCardEffectRoutePath,
  parsePaymentCardEffectRouteState,
  paymentCardEffectDefaultDebugTuning,
  paymentCardEffectDemoSections,
  paymentCardEffectPreviewBombasticityByPhase,
  resolvePaymentCardEffectPreviewBombasticity,
  resolvePaymentCardEffectPreviewPhase,
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
    bombasticity: 0.08,
  });

  // Assert
  assert.deepEqual(PAYMENT_CARD_EFFECT_VIDEO_BOMBASTICITY_LEVELS, [0.03, 0.05, 0.08, 0.1]);
  assert.equal(searchParams.get("capture"), "1");
  assert.equal(searchParams.get("fixture"), fixtureId);
  assert.equal(searchParams.get("bombasticity"), "0.08");
  assert.equal(searchParams.has("ambient-opacity-low"), false);
});

test("payment card effect preview helpers map low mid and max phases onto the capture ladder", () => {
  // Arrange
  const lowBombasticity = paymentCardEffectPreviewBombasticityByPhase.low;
  const midBombasticity = paymentCardEffectPreviewBombasticityByPhase.mid;
  const maxBombasticity = paymentCardEffectPreviewBombasticityByPhase.max;

  // Act
  const resolvedLowBombasticity = resolvePaymentCardEffectPreviewBombasticity("low");
  const resolvedMidBombasticity = resolvePaymentCardEffectPreviewBombasticity("mid");
  const resolvedMaxBombasticity = resolvePaymentCardEffectPreviewBombasticity("max");
  const lowPhase = resolvePaymentCardEffectPreviewPhase(lowBombasticity);
  const midPhase = resolvePaymentCardEffectPreviewPhase(midBombasticity);
  const maxPhase = resolvePaymentCardEffectPreviewPhase(maxBombasticity);
  const nearMidPhase = resolvePaymentCardEffectPreviewPhase(0.06);

  // Assert
  assert.deepEqual(paymentCardEffectPreviewBombasticityByPhase, {
    low: 0.03,
    mid: 0.05,
    max: 0.1,
  });
  assert.equal(resolvedLowBombasticity, lowBombasticity);
  assert.equal(resolvedMidBombasticity, midBombasticity);
  assert.equal(resolvedMaxBombasticity, maxBombasticity);
  assert.equal(lowPhase, "low");
  assert.equal(midPhase, "mid");
  assert.equal(maxPhase, "max");
  assert.equal(nearMidPhase, "mid");
});

test("payment card effect route helpers round-trip advanced tuning overrides while omitting defaults", () => {
  // Arrange
  const searchParams = new URLSearchParams();
  searchParams.set("capture", "1");
  searchParams.set("fixture", "particles");
  searchParams.set("bombasticity", "0.08");
  searchParams.set("ambient-opacity-low", "0.27");
  searchParams.set("glitter-duration-max", "1.91");
  searchParams.set("wash-low", "0.05");

  // Act
  const routeState = parsePaymentCardEffectRouteState(searchParams);
  const serializedSearchParams = buildPaymentCardEffectRouteSearchParams(routeState);

  // Assert
  assert.equal(routeState.capture, true);
  assert.equal(routeState.fixtureId, "particles");
  assert.equal(routeState.bombasticity, 0.08);
  assert.equal(routeState.debugTuning.ambient.opacity.low, 0.27);
  assert.equal(routeState.debugTuning.glitter.duration.max, 1.91);
  assert.equal(routeState.debugTuning.wash.low, 0.05);
  assert.equal(serializedSearchParams.get("ambient-opacity-low"), "0.27");
  assert.equal(serializedSearchParams.get("glitter-duration-max"), "1.91");
  assert.equal(serializedSearchParams.get("wash-low"), "0.05");
  assert.equal(serializedSearchParams.has("ambient-opacity-mid"), false);
});

test("payment card effect route parsing clamps advanced tuning ranges and enforces count ordering", () => {
  // Arrange
  const searchParams = new URLSearchParams();
  searchParams.set("ambient-count-low", "6");
  searchParams.set("ambient-count-mid", "2");
  searchParams.set("ambient-count-max", "1");
  searchParams.set("lightning-size-low", "99");
  searchParams.set("wash-low", "-1");

  // Act
  const routeState = parsePaymentCardEffectRouteState(searchParams);

  // Assert
  assert.deepEqual(routeState.debugTuning.ambient.count, {
    low: 6,
    mid: 6,
    max: 6,
  });
  assert.equal(routeState.debugTuning.lightning.size.low, 2);
  assert.equal(routeState.debugTuning.wash.low, 0);
});

test("resetting advanced tuning groups and all overrides preserves the core route params", () => {
  // Arrange
  const routeState = parsePaymentCardEffectRouteState(
    new URLSearchParams(
      "capture=1&fixture=particles&bombasticity=0.08&ambient-opacity-low=0.27&glitter-size-max=1.50",
    ),
  );

  const groupResetSearchParams = new URLSearchParams("unrelated=1");
  const allResetSearchParams = new URLSearchParams("unrelated=1");

  // Act
  applyPaymentCardEffectRouteStateSearchParams({
    searchParams: groupResetSearchParams,
    routeState: {
      ...routeState,
      debugTuning: resetPaymentCardEffectDebugTuningGroup({
        tuning: routeState.debugTuning,
        groupId: "ambient",
      }),
    },
  });
  applyPaymentCardEffectRouteStateSearchParams({
    searchParams: allResetSearchParams,
    routeState: {
      ...routeState,
      debugTuning: paymentCardEffectDefaultDebugTuning,
    },
  });

  // Assert
  assert.equal(groupResetSearchParams.get("capture"), "1");
  assert.equal(groupResetSearchParams.get("fixture"), "particles");
  assert.equal(groupResetSearchParams.get("bombasticity"), "0.08");
  assert.equal(groupResetSearchParams.get("glitter-size-max"), "1.50");
  assert.equal(groupResetSearchParams.has("ambient-opacity-low"), false);
  assert.equal(groupResetSearchParams.get("unrelated"), "1");
  assert.equal(allResetSearchParams.get("capture"), "1");
  assert.equal(allResetSearchParams.get("fixture"), "particles");
  assert.equal(allResetSearchParams.get("bombasticity"), "0.08");
  assert.equal(allResetSearchParams.has("ambient-opacity-low"), false);
  assert.equal(allResetSearchParams.has("glitter-size-max"), false);
  assert.equal(allResetSearchParams.get("unrelated"), "1");
});
