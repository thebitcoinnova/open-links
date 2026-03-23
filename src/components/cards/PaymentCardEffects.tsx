import { For, type JSX, Show } from "solid-js";
import type { PaymentCardEffectTone } from "../../lib/payments/card-effects";
import type { PaymentCardEffect, PaymentCardGlitterPalette } from "../../lib/payments/types";

interface PaymentCardEffectsProps {
  effects: PaymentCardEffect[];
  glitterPalette: PaymentCardGlitterPalette;
  tone: PaymentCardEffectTone;
}

interface PaymentEffectParticle {
  x: string;
  y: string;
  size: string;
  duration: string;
  delay: string;
  opacity: number;
  driftX: string;
  driftY: string;
}

interface PaymentEffectSpark {
  x: string;
  y: string;
  width: string;
  height: string;
  rotate: string;
  duration: string;
  delay: string;
  opacity: number;
}

const AMBIENT_PARTICLES: readonly PaymentEffectParticle[] = [
  {
    x: "11%",
    y: "18%",
    size: "0.4rem",
    duration: "7.2s",
    delay: "0s",
    opacity: 0.24,
    driftX: "0.5rem",
    driftY: "-0.9rem",
  },
  {
    x: "23%",
    y: "72%",
    size: "0.3rem",
    duration: "8.6s",
    delay: "-1.2s",
    opacity: 0.2,
    driftX: "-0.35rem",
    driftY: "-0.75rem",
  },
  {
    x: "37%",
    y: "28%",
    size: "0.34rem",
    duration: "6.8s",
    delay: "-2.8s",
    opacity: 0.18,
    driftX: "0.45rem",
    driftY: "-0.65rem",
  },
  {
    x: "56%",
    y: "14%",
    size: "0.24rem",
    duration: "8.2s",
    delay: "-1.7s",
    opacity: 0.22,
    driftX: "-0.3rem",
    driftY: "-0.7rem",
  },
  {
    x: "71%",
    y: "64%",
    size: "0.36rem",
    duration: "7.7s",
    delay: "-3.6s",
    opacity: 0.2,
    driftX: "0.35rem",
    driftY: "-0.95rem",
  },
  {
    x: "84%",
    y: "26%",
    size: "0.28rem",
    duration: "6.4s",
    delay: "-0.9s",
    opacity: 0.24,
    driftX: "-0.28rem",
    driftY: "-0.55rem",
  },
  {
    x: "91%",
    y: "78%",
    size: "0.32rem",
    duration: "8.9s",
    delay: "-4.1s",
    opacity: 0.17,
    driftX: "0.22rem",
    driftY: "-0.82rem",
  },
];

const LIGHTNING_SPARKS: readonly PaymentEffectSpark[] = [
  {
    x: "18%",
    y: "20%",
    width: "1.15rem",
    height: "0.14rem",
    rotate: "-32deg",
    duration: "3.1s",
    delay: "0s",
    opacity: 0.38,
  },
  {
    x: "29%",
    y: "43%",
    width: "0.95rem",
    height: "0.12rem",
    rotate: "18deg",
    duration: "2.8s",
    delay: "-1s",
    opacity: 0.28,
  },
  {
    x: "48%",
    y: "16%",
    width: "1.35rem",
    height: "0.16rem",
    rotate: "-18deg",
    duration: "3.4s",
    delay: "-1.5s",
    opacity: 0.36,
  },
  {
    x: "64%",
    y: "32%",
    width: "1.05rem",
    height: "0.15rem",
    rotate: "34deg",
    duration: "2.9s",
    delay: "-0.8s",
    opacity: 0.32,
  },
  {
    x: "76%",
    y: "56%",
    width: "1.1rem",
    height: "0.14rem",
    rotate: "-24deg",
    duration: "3.2s",
    delay: "-2.2s",
    opacity: 0.29,
  },
  {
    x: "87%",
    y: "24%",
    width: "0.86rem",
    height: "0.11rem",
    rotate: "12deg",
    duration: "2.6s",
    delay: "-1.1s",
    opacity: 0.26,
  },
];

const GLITTER_PARTICLES: readonly PaymentEffectParticle[] = [
  {
    x: "14%",
    y: "58%",
    size: "0.38rem",
    duration: "4.6s",
    delay: "0s",
    opacity: 0.42,
    driftX: "0.2rem",
    driftY: "-0.35rem",
  },
  {
    x: "26%",
    y: "24%",
    size: "0.32rem",
    duration: "5.2s",
    delay: "-1.3s",
    opacity: 0.36,
    driftX: "-0.12rem",
    driftY: "-0.28rem",
  },
  {
    x: "43%",
    y: "72%",
    size: "0.42rem",
    duration: "4.9s",
    delay: "-0.9s",
    opacity: 0.38,
    driftX: "0.14rem",
    driftY: "-0.32rem",
  },
  {
    x: "58%",
    y: "18%",
    size: "0.35rem",
    duration: "5.7s",
    delay: "-2.1s",
    opacity: 0.33,
    driftX: "-0.18rem",
    driftY: "-0.22rem",
  },
  {
    x: "69%",
    y: "47%",
    size: "0.3rem",
    duration: "4.4s",
    delay: "-1.7s",
    opacity: 0.4,
    driftX: "0.16rem",
    driftY: "-0.25rem",
  },
  {
    x: "82%",
    y: "16%",
    size: "0.34rem",
    duration: "5.1s",
    delay: "-0.6s",
    opacity: 0.35,
    driftX: "-0.1rem",
    driftY: "-0.24rem",
  },
  {
    x: "89%",
    y: "68%",
    size: "0.4rem",
    duration: "4.8s",
    delay: "-2.6s",
    opacity: 0.39,
    driftX: "0.18rem",
    driftY: "-0.3rem",
  },
];

const particleStyle = (particle: PaymentEffectParticle): JSX.CSSProperties => ({
  "--payment-effect-x": particle.x,
  "--payment-effect-y": particle.y,
  "--payment-effect-size": particle.size,
  "--payment-effect-duration": particle.duration,
  "--payment-effect-delay": particle.delay,
  "--payment-effect-opacity": String(particle.opacity),
  "--payment-effect-drift-x": particle.driftX,
  "--payment-effect-drift-y": particle.driftY,
});

const sparkStyle = (spark: PaymentEffectSpark): JSX.CSSProperties => ({
  "--payment-effect-x": spark.x,
  "--payment-effect-y": spark.y,
  "--payment-effect-width": spark.width,
  "--payment-effect-height": spark.height,
  "--payment-effect-rotate": spark.rotate,
  "--payment-effect-duration": spark.duration,
  "--payment-effect-delay": spark.delay,
  "--payment-effect-opacity": String(spark.opacity),
});

export const PaymentCardEffects = (props: PaymentCardEffectsProps) => {
  const hasEffect = (effect: PaymentCardEffect): boolean => props.effects.includes(effect);

  return (
    <div
      class="payment-card-effects"
      aria-hidden="true"
      data-glitter-palette={props.glitterPalette}
      data-tone={props.tone}
      data-active-effects={props.effects.join(" ")}
    >
      <span class="payment-card-effects-wash" />

      <Show when={hasEffect("particles")}>
        <For each={AMBIENT_PARTICLES}>
          {(particle) => (
            <span
              class="payment-card-effects-particle payment-card-effects-particle--ambient"
              style={particleStyle(particle)}
            />
          )}
        </For>
      </Show>

      <Show when={hasEffect("lightning-particles")}>
        <For each={LIGHTNING_SPARKS}>
          {(spark) => (
            <span
              class="payment-card-effects-particle payment-card-effects-particle--lightning"
              style={sparkStyle(spark)}
            />
          )}
        </For>
      </Show>

      <Show when={hasEffect("glitter-particles")}>
        <For each={GLITTER_PARTICLES}>
          {(particle) => (
            <span
              class="payment-card-effects-particle payment-card-effects-particle--glitter"
              style={particleStyle(particle)}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

export default PaymentCardEffects;
