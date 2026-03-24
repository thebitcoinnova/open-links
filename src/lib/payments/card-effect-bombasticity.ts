import {
  PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS,
  type PaymentCardEffectDebugCurve,
} from "./card-effect-debug-tuning";
import { DEFAULT_PAYMENT_CARD_BOMBASTICITY, clampPaymentCardBombasticity } from "./types";

const LIVE_PAYMENT_CARD_BOMBASTICITY_MAX = 0.1;

export const resolveEffectivePaymentCardBombasticity = (bombasticity: number): number =>
  clampPaymentCardBombasticity(bombasticity / LIVE_PAYMENT_CARD_BOMBASTICITY_MAX);

const scaleAcrossBombasticity = ({
  bombasticity,
  atZero,
  atMidpoint,
  atOne,
}: {
  bombasticity: number;
  atZero: number;
  atMidpoint: number;
  atOne: number;
}): number => {
  const effectiveBombasticity = resolveEffectivePaymentCardBombasticity(bombasticity);

  if (effectiveBombasticity <= 0.5) {
    const progress = effectiveBombasticity / 0.5;
    return atZero + (atMidpoint - atZero) * progress;
  }

  const progress = (effectiveBombasticity - 0.5) / 0.5;
  return atMidpoint + (atOne - atMidpoint) * progress;
};

export const resolvePaymentCardBombasticity = ({
  linkBombasticity,
  siteBombasticityDefault,
}: {
  linkBombasticity?: number;
  siteBombasticityDefault?: number;
}): number => clampPaymentCardBombasticity(linkBombasticity ?? siteBombasticityDefault);

export const scaleEffectOpacity = ({
  opacity,
  bombasticity,
  curve = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.ambient.opacity,
}: {
  opacity: number;
  bombasticity: number;
  curve?: PaymentCardEffectDebugCurve;
}): number =>
  Number(
    (
      opacity *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: curve.low,
        atMidpoint: curve.mid,
        atOne: curve.max,
      })
    ).toFixed(3),
  );

export const scaleEffectDurationSeconds = ({
  seconds,
  bombasticity,
  curve = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.ambient.duration,
}: {
  seconds: number;
  bombasticity: number;
  curve?: PaymentCardEffectDebugCurve;
}): number =>
  Number(
    (
      seconds *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: curve.low,
        atMidpoint: curve.mid,
        atOne: curve.max,
      })
    ).toFixed(3),
  );

export const scaleEffectDistanceRem = ({
  rem,
  bombasticity,
  curve = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.ambient.drift,
}: {
  rem: number;
  bombasticity: number;
  curve?: PaymentCardEffectDebugCurve;
}): number =>
  Number(
    (
      rem *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: curve.low,
        atMidpoint: curve.mid,
        atOne: curve.max,
      })
    ).toFixed(3),
  );

export const scaleEffectSizeRem = ({
  rem,
  bombasticity,
  curve = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.ambient.size,
}: {
  rem: number;
  bombasticity: number;
  curve?: PaymentCardEffectDebugCurve;
}): number =>
  Number(
    (
      rem *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: curve.low,
        atMidpoint: curve.mid,
        atOne: curve.max,
      })
    ).toFixed(3),
  );

export const resolveVisibleEffectCount = ({
  bombasticity,
  curve = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.ambient.count,
}: {
  bombasticity: number;
  curve?: PaymentCardEffectDebugCurve;
}): number => {
  if (bombasticity <= 0) {
    return 0;
  }

  const scaledCount = scaleAcrossBombasticity({
    bombasticity,
    atZero: curve.low,
    atMidpoint: curve.mid,
    atOne: curve.max,
  });

  return Math.max(curve.low, Math.min(curve.max, Math.round(scaledCount)));
};

export const resolveWashOpacity = ({
  bombasticity,
  curve = PAYMENT_CARD_EFFECT_DEBUG_TUNING_DEFAULTS.wash,
}: {
  bombasticity: number;
  curve?: PaymentCardEffectDebugCurve;
}): number =>
  Number(
    scaleAcrossBombasticity({
      bombasticity,
      atZero: curve.low,
      atMidpoint: curve.mid,
      atOne: curve.max,
    }).toFixed(3),
  );

export const formatBombasticityValue = (bombasticity: number): string => bombasticity.toFixed(2);

export const isDefaultBombasticity = (bombasticity: number): boolean =>
  Math.abs(bombasticity - DEFAULT_PAYMENT_CARD_BOMBASTICITY) < 0.001;
