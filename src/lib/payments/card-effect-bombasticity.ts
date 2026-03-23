import { DEFAULT_PAYMENT_CARD_BOMBASTICITY, clampPaymentCardBombasticity } from "./types";

export const PAYMENT_CARD_EFFECT_VIDEO_BOMBASTICITY_LEVELS = [0.25, 0.5, 0.75, 1] as const;

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
  if (bombasticity <= 0.5) {
    const progress = bombasticity / 0.5;
    return atZero + (atMidpoint - atZero) * progress;
  }

  const progress = (bombasticity - 0.5) / 0.5;
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
}: {
  opacity: number;
  bombasticity: number;
}): number =>
  Number(
    (
      opacity *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: 0.18,
        atMidpoint: 1,
        atOne: 1.4,
      })
    ).toFixed(3),
  );

export const scaleEffectDurationSeconds = ({
  seconds,
  bombasticity,
}: {
  seconds: number;
  bombasticity: number;
}): number =>
  Number(
    (
      seconds *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: 1.55,
        atMidpoint: 1,
        atOne: 0.62,
      })
    ).toFixed(3),
  );

export const scaleEffectDistanceRem = ({
  rem,
  bombasticity,
}: {
  rem: number;
  bombasticity: number;
}): number =>
  Number(
    (
      rem *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: 0.2,
        atMidpoint: 1,
        atOne: 1.6,
      })
    ).toFixed(3),
  );

export const scaleEffectSizeRem = ({
  rem,
  bombasticity,
}: {
  rem: number;
  bombasticity: number;
}): number =>
  Number(
    (
      rem *
      scaleAcrossBombasticity({
        bombasticity,
        atZero: 0.78,
        atMidpoint: 1,
        atOne: 1.18,
      })
    ).toFixed(3),
  );

export const resolveVisibleEffectCount = ({
  bombasticity,
  baselineCount,
  maximumCount,
  minimumVisibleCount = 1,
}: {
  bombasticity: number;
  baselineCount: number;
  maximumCount: number;
  minimumVisibleCount?: number;
}): number => {
  if (bombasticity <= 0) {
    return 0;
  }

  const safeMinimumVisibleCount = Math.min(minimumVisibleCount, baselineCount);
  const scaledCount = scaleAcrossBombasticity({
    bombasticity,
    atZero: safeMinimumVisibleCount,
    atMidpoint: baselineCount,
    atOne: maximumCount,
  });

  return Math.max(safeMinimumVisibleCount, Math.min(maximumCount, Math.round(scaledCount)));
};

export const resolveWashOpacity = (bombasticity: number): number =>
  Number(
    scaleAcrossBombasticity({
      bombasticity,
      atZero: 0.12,
      atMidpoint: 0.8,
      atOne: 1.45,
    }).toFixed(3),
  );

export const formatBombasticityValue = (bombasticity: number): string => bombasticity.toFixed(2);

export const isDefaultBombasticity = (bombasticity: number): boolean =>
  Math.abs(bombasticity - DEFAULT_PAYMENT_CARD_BOMBASTICITY) < 0.001;
