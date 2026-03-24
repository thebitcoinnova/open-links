import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveEffectivePaymentCardBombasticity,
  resolveVisibleEffectCount,
  resolveWashOpacity,
  scaleEffectDistanceRem,
  scaleEffectDurationSeconds,
  scaleEffectOpacity,
  scaleEffectSizeRem,
} from "./card-effect-bombasticity";

test("effective payment bombasticity compresses the public range into the first tenth", () => {
  // Arrange
  const publicBombasticityValues = [0, 0.05, 0.1, 0.5, 1];

  // Act
  const effectiveBombasticityValues = publicBombasticityValues.map((bombasticity) =>
    resolveEffectivePaymentCardBombasticity(bombasticity),
  );

  // Assert
  assert.deepEqual(effectiveBombasticityValues, [0, 0.5, 1, 1, 1]);
});

test("scaled payment effects plateau once bombasticity reaches the first tenth", () => {
  // Arrange
  const bombasticityAtFirstMax = 0.1;
  const bombasticityAtFullRange = 1;

  // Act
  const atFirstMax = {
    opacity: scaleEffectOpacity({
      opacity: 0.24,
      bombasticity: bombasticityAtFirstMax,
    }),
    duration: scaleEffectDurationSeconds({
      seconds: 7.2,
      bombasticity: bombasticityAtFirstMax,
    }),
    distance: scaleEffectDistanceRem({
      rem: 0.5,
      bombasticity: bombasticityAtFirstMax,
    }),
    size: scaleEffectSizeRem({
      rem: 0.4,
      bombasticity: bombasticityAtFirstMax,
    }),
    wash: resolveWashOpacity(bombasticityAtFirstMax),
    visibleCount: resolveVisibleEffectCount({
      bombasticity: bombasticityAtFirstMax,
      baselineCount: 7,
      maximumCount: 7,
    }),
  };
  const atFullRange = {
    opacity: scaleEffectOpacity({
      opacity: 0.24,
      bombasticity: bombasticityAtFullRange,
    }),
    duration: scaleEffectDurationSeconds({
      seconds: 7.2,
      bombasticity: bombasticityAtFullRange,
    }),
    distance: scaleEffectDistanceRem({
      rem: 0.5,
      bombasticity: bombasticityAtFullRange,
    }),
    size: scaleEffectSizeRem({
      rem: 0.4,
      bombasticity: bombasticityAtFullRange,
    }),
    wash: resolveWashOpacity(bombasticityAtFullRange),
    visibleCount: resolveVisibleEffectCount({
      bombasticity: bombasticityAtFullRange,
      baselineCount: 7,
      maximumCount: 7,
    }),
  };

  // Assert
  assert.deepEqual(atFirstMax, atFullRange);
});
