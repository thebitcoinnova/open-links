import assert from "node:assert/strict";
import test from "node:test";
import { setPaymentCardEffectDebugTuningValue } from "../../lib/payments/card-effect-debug-tuning";
import { paymentCardEffectDefaultDebugTuning } from "../../lib/payments/card-effect-samples";
import { PaymentCardEffects } from "./PaymentCardEffects";

type RenderedNode = string | number | boolean | null | undefined | RenderedElement | RenderedNode[];

interface RenderedElement {
  type: unknown;
  props: Record<string, unknown>;
}

const reactRuntime = {
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: RenderedNode[]) {
    const normalizedChildren =
      children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
    const normalizedProps =
      normalizedChildren === undefined
        ? { ...(props ?? {}) }
        : { ...(props ?? {}), children: normalizedChildren };

    if (typeof type === "function") {
      return type(normalizedProps);
    }

    return {
      type,
      props: normalizedProps,
    } satisfies RenderedElement;
  },
  Fragment(props: { children?: RenderedNode }) {
    return props.children ?? null;
  },
};

(
  globalThis as typeof globalThis & {
    React?: typeof reactRuntime;
  }
).React = reactRuntime;

const isRenderedElement = (value: RenderedNode): value is RenderedElement =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "type" in value &&
  "props" in value;

const collectElements = (node: RenderedNode): RenderedElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectElements(entry));
  }

  if (!isRenderedElement(node)) {
    return [];
  }

  return [node, ...collectElements(node.props.children as RenderedNode)];
};

const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

const renderEffectsTree = (overrides?: Parameters<typeof PaymentCardEffects>[0]["debugTuning"]) =>
  PaymentCardEffects({
    effects: ["particles", "lightning-particles", "glitter-particles"],
    glitterPalette: "gold",
    tone: "default",
    bombasticity: 0.1,
    debugTuning: overrides,
  }) as RenderedNode;

test("payment card effects keep their default output when passed the explicit default tuning", () => {
  // Arrange
  const baselineTree = renderEffectsTree();
  const explicitDefaultsTree = renderEffectsTree(paymentCardEffectDefaultDebugTuning);

  // Act
  const baselineLayer = firstElementWithClass(baselineTree, "payment-card-effects");
  const explicitDefaultsLayer = firstElementWithClass(explicitDefaultsTree, "payment-card-effects");
  const baselineAmbient = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--ambient",
  );
  const explicitDefaultsAmbient = firstElementWithClass(
    explicitDefaultsTree,
    "payment-card-effects-particle--ambient",
  );
  const baselineLightning = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--lightning",
  );
  const explicitDefaultsLightning = firstElementWithClass(
    explicitDefaultsTree,
    "payment-card-effects-particle--lightning",
  );
  const baselineGlitter = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--glitter",
  );
  const explicitDefaultsGlitter = firstElementWithClass(
    explicitDefaultsTree,
    "payment-card-effects-particle--glitter",
  );

  // Assert
  assert.ok(baselineLayer);
  assert.ok(explicitDefaultsLayer);
  assert.ok(baselineAmbient);
  assert.ok(explicitDefaultsAmbient);
  assert.ok(baselineLightning);
  assert.ok(explicitDefaultsLightning);
  assert.ok(baselineGlitter);
  assert.ok(explicitDefaultsGlitter);
  assert.deepEqual(baselineLayer.props.style, explicitDefaultsLayer.props.style);
  assert.deepEqual(baselineAmbient.props.style, explicitDefaultsAmbient.props.style);
  assert.deepEqual(baselineLightning.props.style, explicitDefaultsLightning.props.style);
  assert.deepEqual(baselineGlitter.props.style, explicitDefaultsGlitter.props.style);
});

test("ambient tuning overrides only affect ambient particles", () => {
  // Arrange
  const ambientOverride = setPaymentCardEffectDebugTuningValue({
    tuning: paymentCardEffectDefaultDebugTuning,
    groupId: "ambient",
    metricId: "opacity",
    phase: "max",
    value: 0.6,
  });
  const baselineTree = renderEffectsTree();
  const ambientTree = renderEffectsTree(ambientOverride);

  // Act
  const baselineLayer = firstElementWithClass(baselineTree, "payment-card-effects");
  const ambientLayer = firstElementWithClass(ambientTree, "payment-card-effects");
  const baselineAmbient = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--ambient",
  );
  const ambientParticle = firstElementWithClass(
    ambientTree,
    "payment-card-effects-particle--ambient",
  );
  const baselineLightning = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--lightning",
  );
  const ambientLightning = firstElementWithClass(
    ambientTree,
    "payment-card-effects-particle--lightning",
  );
  const baselineGlitter = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--glitter",
  );
  const ambientGlitter = firstElementWithClass(
    ambientTree,
    "payment-card-effects-particle--glitter",
  );

  // Assert
  assert.ok(baselineLayer);
  assert.ok(ambientLayer);
  assert.ok(baselineAmbient);
  assert.ok(ambientParticle);
  assert.ok(baselineLightning);
  assert.ok(ambientLightning);
  assert.ok(baselineGlitter);
  assert.ok(ambientGlitter);
  assert.notDeepEqual(baselineAmbient.props.style, ambientParticle.props.style);
  assert.deepEqual(baselineLightning.props.style, ambientLightning.props.style);
  assert.deepEqual(baselineGlitter.props.style, ambientGlitter.props.style);
  assert.deepEqual(baselineLayer.props.style, ambientLayer.props.style);
});

test("lightning tuning overrides only affect lightning sparks", () => {
  // Arrange
  const lightningOverride = setPaymentCardEffectDebugTuningValue({
    tuning: paymentCardEffectDefaultDebugTuning,
    groupId: "lightning",
    metricId: "size",
    phase: "max",
    value: 1.75,
  });
  const baselineTree = renderEffectsTree();
  const lightningTree = renderEffectsTree(lightningOverride);

  // Act
  const baselineLayer = firstElementWithClass(baselineTree, "payment-card-effects");
  const lightningLayer = firstElementWithClass(lightningTree, "payment-card-effects");
  const baselineAmbient = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--ambient",
  );
  const lightningAmbient = firstElementWithClass(
    lightningTree,
    "payment-card-effects-particle--ambient",
  );
  const baselineLightning = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--lightning",
  );
  const lightningSpark = firstElementWithClass(
    lightningTree,
    "payment-card-effects-particle--lightning",
  );
  const baselineGlitter = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--glitter",
  );
  const lightningGlitter = firstElementWithClass(
    lightningTree,
    "payment-card-effects-particle--glitter",
  );

  // Assert
  assert.ok(baselineLayer);
  assert.ok(lightningLayer);
  assert.ok(baselineAmbient);
  assert.ok(lightningAmbient);
  assert.ok(baselineLightning);
  assert.ok(lightningSpark);
  assert.ok(baselineGlitter);
  assert.ok(lightningGlitter);
  assert.deepEqual(baselineAmbient.props.style, lightningAmbient.props.style);
  assert.notDeepEqual(baselineLightning.props.style, lightningSpark.props.style);
  assert.deepEqual(baselineGlitter.props.style, lightningGlitter.props.style);
  assert.deepEqual(baselineLayer.props.style, lightningLayer.props.style);
});

test("glitter tuning overrides only affect glitter particles", () => {
  // Arrange
  const glitterOverride = setPaymentCardEffectDebugTuningValue({
    tuning: paymentCardEffectDefaultDebugTuning,
    groupId: "glitter",
    metricId: "duration",
    phase: "max",
    value: 0.35,
  });
  const baselineTree = renderEffectsTree();
  const glitterTree = renderEffectsTree(glitterOverride);

  // Act
  const baselineLayer = firstElementWithClass(baselineTree, "payment-card-effects");
  const glitterLayer = firstElementWithClass(glitterTree, "payment-card-effects");
  const baselineAmbient = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--ambient",
  );
  const glitterAmbient = firstElementWithClass(
    glitterTree,
    "payment-card-effects-particle--ambient",
  );
  const baselineLightning = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--lightning",
  );
  const glitterLightning = firstElementWithClass(
    glitterTree,
    "payment-card-effects-particle--lightning",
  );
  const baselineGlitter = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--glitter",
  );
  const glitterParticle = firstElementWithClass(
    glitterTree,
    "payment-card-effects-particle--glitter",
  );

  // Assert
  assert.ok(baselineLayer);
  assert.ok(glitterLayer);
  assert.ok(baselineAmbient);
  assert.ok(glitterAmbient);
  assert.ok(baselineLightning);
  assert.ok(glitterLightning);
  assert.ok(baselineGlitter);
  assert.ok(glitterParticle);
  assert.deepEqual(baselineAmbient.props.style, glitterAmbient.props.style);
  assert.deepEqual(baselineLightning.props.style, glitterLightning.props.style);
  assert.notDeepEqual(baselineGlitter.props.style, glitterParticle.props.style);
  assert.deepEqual(baselineLayer.props.style, glitterLayer.props.style);
});

test("wash tuning overrides only affect the shared wash layer", () => {
  // Arrange
  const washOverride = setPaymentCardEffectDebugTuningValue({
    tuning: paymentCardEffectDefaultDebugTuning,
    groupId: "wash",
    metricId: "wash",
    phase: "max",
    value: 0.45,
  });
  const baselineTree = renderEffectsTree();
  const washTree = renderEffectsTree(washOverride);

  // Act
  const baselineLayer = firstElementWithClass(baselineTree, "payment-card-effects");
  const washLayer = firstElementWithClass(washTree, "payment-card-effects");
  const baselineAmbient = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--ambient",
  );
  const washAmbient = firstElementWithClass(washTree, "payment-card-effects-particle--ambient");
  const baselineLightning = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--lightning",
  );
  const washLightning = firstElementWithClass(washTree, "payment-card-effects-particle--lightning");
  const baselineGlitter = firstElementWithClass(
    baselineTree,
    "payment-card-effects-particle--glitter",
  );
  const washGlitter = firstElementWithClass(washTree, "payment-card-effects-particle--glitter");

  // Assert
  assert.ok(baselineLayer);
  assert.ok(washLayer);
  assert.ok(baselineAmbient);
  assert.ok(washAmbient);
  assert.ok(baselineLightning);
  assert.ok(washLightning);
  assert.ok(baselineGlitter);
  assert.ok(washGlitter);
  assert.notDeepEqual(baselineLayer.props.style, washLayer.props.style);
  assert.deepEqual(baselineAmbient.props.style, washAmbient.props.style);
  assert.deepEqual(baselineLightning.props.style, washLightning.props.style);
  assert.deepEqual(baselineGlitter.props.style, washGlitter.props.style);
});
