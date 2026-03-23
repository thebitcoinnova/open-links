import { For, type JSX, Show, createMemo } from "solid-js";
import {
  formatBombasticityValue,
  resolveVisibleEffectCount,
  resolveWashOpacity,
  scaleEffectDistanceRem,
  scaleEffectDurationSeconds,
  scaleEffectOpacity,
  scaleEffectSizeRem,
} from "../../lib/payments/card-effect-bombasticity";
import type { PaymentCardEffectTone } from "../../lib/payments/card-effects";
import type { PaymentCardEffect, PaymentCardGlitterPalette } from "../../lib/payments/types";

interface PaymentCardEffectsProps {
  effects: PaymentCardEffect[];
  glitterPalette: PaymentCardGlitterPalette;
  tone: PaymentCardEffectTone;
  bombasticity: number;
}

interface PaymentEffectParticle {
  x: number;
  y: number;
  sizeRem: number;
  durationSeconds: number;
  delaySeconds: number;
  opacity: number;
  driftXRem: number;
  driftYRem: number;
}

interface PaymentEffectSpark {
  x: number;
  y: number;
  widthRem: number;
  heightRem: number;
  rotateDegrees: number;
  durationSeconds: number;
  delaySeconds: number;
  opacity: number;
}

const AMBIENT_PARTICLES: readonly PaymentEffectParticle[] = [
  {
    x: 11,
    y: 18,
    sizeRem: 0.4,
    durationSeconds: 7.2,
    delaySeconds: 0,
    opacity: 0.24,
    driftXRem: 0.5,
    driftYRem: -0.9,
  },
  {
    x: 23,
    y: 72,
    sizeRem: 0.3,
    durationSeconds: 8.6,
    delaySeconds: -1.2,
    opacity: 0.2,
    driftXRem: -0.35,
    driftYRem: -0.75,
  },
  {
    x: 37,
    y: 28,
    sizeRem: 0.34,
    durationSeconds: 6.8,
    delaySeconds: -2.8,
    opacity: 0.18,
    driftXRem: 0.45,
    driftYRem: -0.65,
  },
  {
    x: 56,
    y: 14,
    sizeRem: 0.24,
    durationSeconds: 8.2,
    delaySeconds: -1.7,
    opacity: 0.22,
    driftXRem: -0.3,
    driftYRem: -0.7,
  },
  {
    x: 71,
    y: 64,
    sizeRem: 0.36,
    durationSeconds: 7.7,
    delaySeconds: -3.6,
    opacity: 0.2,
    driftXRem: 0.35,
    driftYRem: -0.95,
  },
  {
    x: 84,
    y: 26,
    sizeRem: 0.28,
    durationSeconds: 6.4,
    delaySeconds: -0.9,
    opacity: 0.24,
    driftXRem: -0.28,
    driftYRem: -0.55,
  },
  {
    x: 91,
    y: 78,
    sizeRem: 0.32,
    durationSeconds: 8.9,
    delaySeconds: -4.1,
    opacity: 0.17,
    driftXRem: 0.22,
    driftYRem: -0.82,
  },
];

const LIGHTNING_SPARKS: readonly PaymentEffectSpark[] = [
  {
    x: 18,
    y: 20,
    widthRem: 1.15,
    heightRem: 0.14,
    rotateDegrees: -32,
    durationSeconds: 3.1,
    delaySeconds: 0,
    opacity: 0.38,
  },
  {
    x: 29,
    y: 43,
    widthRem: 0.95,
    heightRem: 0.12,
    rotateDegrees: 18,
    durationSeconds: 2.8,
    delaySeconds: -1,
    opacity: 0.28,
  },
  {
    x: 48,
    y: 16,
    widthRem: 1.35,
    heightRem: 0.16,
    rotateDegrees: -18,
    durationSeconds: 3.4,
    delaySeconds: -1.5,
    opacity: 0.36,
  },
  {
    x: 64,
    y: 32,
    widthRem: 1.05,
    heightRem: 0.15,
    rotateDegrees: 34,
    durationSeconds: 2.9,
    delaySeconds: -0.8,
    opacity: 0.32,
  },
  {
    x: 76,
    y: 56,
    widthRem: 1.1,
    heightRem: 0.14,
    rotateDegrees: -24,
    durationSeconds: 3.2,
    delaySeconds: -2.2,
    opacity: 0.29,
  },
  {
    x: 87,
    y: 24,
    widthRem: 0.86,
    heightRem: 0.11,
    rotateDegrees: 12,
    durationSeconds: 2.6,
    delaySeconds: -1.1,
    opacity: 0.26,
  },
];

const GLITTER_PARTICLES: readonly PaymentEffectParticle[] = [
  {
    x: 14,
    y: 58,
    sizeRem: 0.38,
    durationSeconds: 4.6,
    delaySeconds: 0,
    opacity: 0.42,
    driftXRem: 0.2,
    driftYRem: -0.35,
  },
  {
    x: 26,
    y: 24,
    sizeRem: 0.32,
    durationSeconds: 5.2,
    delaySeconds: -1.3,
    opacity: 0.36,
    driftXRem: -0.12,
    driftYRem: -0.28,
  },
  {
    x: 43,
    y: 72,
    sizeRem: 0.42,
    durationSeconds: 4.9,
    delaySeconds: -0.9,
    opacity: 0.38,
    driftXRem: 0.14,
    driftYRem: -0.32,
  },
  {
    x: 58,
    y: 18,
    sizeRem: 0.35,
    durationSeconds: 5.7,
    delaySeconds: -2.1,
    opacity: 0.33,
    driftXRem: -0.18,
    driftYRem: -0.22,
  },
  {
    x: 69,
    y: 47,
    sizeRem: 0.3,
    durationSeconds: 4.4,
    delaySeconds: -1.7,
    opacity: 0.4,
    driftXRem: 0.16,
    driftYRem: -0.25,
  },
  {
    x: 82,
    y: 16,
    sizeRem: 0.34,
    durationSeconds: 5.1,
    delaySeconds: -0.6,
    opacity: 0.35,
    driftXRem: -0.1,
    driftYRem: -0.24,
  },
  {
    x: 89,
    y: 68,
    sizeRem: 0.4,
    durationSeconds: 4.8,
    delaySeconds: -2.6,
    opacity: 0.39,
    driftXRem: 0.18,
    driftYRem: -0.3,
  },
];

const formatPercent = (value: number): string => `${value}%`;
const formatRem = (value: number): string => `${value}rem`;
const formatSeconds = (value: number): string => `${value}s`;
const formatDegrees = (value: number): string => `${value}deg`;

const particleStyle = (
  particle: PaymentEffectParticle,
  bombasticity: number,
): JSX.CSSProperties => ({
  "--payment-effect-x": formatPercent(particle.x),
  "--payment-effect-y": formatPercent(particle.y),
  "--payment-effect-size": formatRem(
    scaleEffectSizeRem({
      rem: particle.sizeRem,
      bombasticity,
    }),
  ),
  "--payment-effect-duration": formatSeconds(
    scaleEffectDurationSeconds({
      seconds: particle.durationSeconds,
      bombasticity,
    }),
  ),
  "--payment-effect-delay": formatSeconds(particle.delaySeconds),
  "--payment-effect-opacity": String(
    scaleEffectOpacity({
      opacity: particle.opacity,
      bombasticity,
    }),
  ),
  "--payment-effect-drift-x": formatRem(
    scaleEffectDistanceRem({
      rem: particle.driftXRem,
      bombasticity,
    }),
  ),
  "--payment-effect-drift-y": formatRem(
    scaleEffectDistanceRem({
      rem: particle.driftYRem,
      bombasticity,
    }),
  ),
});

const sparkStyle = (spark: PaymentEffectSpark, bombasticity: number): JSX.CSSProperties => ({
  "--payment-effect-x": formatPercent(spark.x),
  "--payment-effect-y": formatPercent(spark.y),
  "--payment-effect-width": formatRem(
    scaleEffectSizeRem({
      rem: spark.widthRem,
      bombasticity,
    }),
  ),
  "--payment-effect-height": formatRem(
    scaleEffectSizeRem({
      rem: spark.heightRem,
      bombasticity,
    }),
  ),
  "--payment-effect-rotate": formatDegrees(spark.rotateDegrees),
  "--payment-effect-duration": formatSeconds(
    scaleEffectDurationSeconds({
      seconds: spark.durationSeconds,
      bombasticity,
    }),
  ),
  "--payment-effect-delay": formatSeconds(spark.delaySeconds),
  "--payment-effect-opacity": String(
    scaleEffectOpacity({
      opacity: spark.opacity,
      bombasticity,
    }),
  ),
});

export const PaymentCardEffects = (props: PaymentCardEffectsProps) => {
  const hasEffect = (effect: PaymentCardEffect): boolean => props.effects.includes(effect);
  const visibleAmbientParticles = createMemo(() =>
    AMBIENT_PARTICLES.slice(
      0,
      resolveVisibleEffectCount({
        bombasticity: props.bombasticity,
        baselineCount: AMBIENT_PARTICLES.length,
        maximumCount: AMBIENT_PARTICLES.length,
      }),
    ),
  );
  const visibleLightningSparks = createMemo(() =>
    LIGHTNING_SPARKS.slice(
      0,
      resolveVisibleEffectCount({
        bombasticity: props.bombasticity,
        baselineCount: LIGHTNING_SPARKS.length,
        maximumCount: LIGHTNING_SPARKS.length,
      }),
    ),
  );
  const visibleGlitterParticles = createMemo(() =>
    GLITTER_PARTICLES.slice(
      0,
      resolveVisibleEffectCount({
        bombasticity: props.bombasticity,
        baselineCount: GLITTER_PARTICLES.length,
        maximumCount: GLITTER_PARTICLES.length,
      }),
    ),
  );

  return (
    <div
      class="payment-card-effects"
      aria-hidden="true"
      data-glitter-palette={props.glitterPalette}
      data-tone={props.tone}
      data-active-effects={props.effects.join(" ")}
      data-bombasticity={formatBombasticityValue(props.bombasticity)}
      style={{
        "--payment-effect-wash-opacity": String(resolveWashOpacity(props.bombasticity)),
      }}
    >
      <span class="payment-card-effects-wash" />

      <Show when={hasEffect("particles")}>
        <For each={visibleAmbientParticles()}>
          {(particle) => (
            <span
              class="payment-card-effects-particle payment-card-effects-particle--ambient"
              style={particleStyle(particle, props.bombasticity)}
            />
          )}
        </For>
      </Show>

      <Show when={hasEffect("lightning-particles")}>
        <For each={visibleLightningSparks()}>
          {(spark) => (
            <span
              class="payment-card-effects-particle payment-card-effects-particle--lightning"
              style={sparkStyle(spark, props.bombasticity)}
            />
          )}
        </For>
      </Show>

      <Show when={hasEffect("glitter-particles")}>
        <For each={visibleGlitterParticles()}>
          {(particle) => (
            <span
              class="payment-card-effects-particle payment-card-effects-particle--glitter"
              style={particleStyle(particle, props.bombasticity)}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

export default PaymentCardEffects;
