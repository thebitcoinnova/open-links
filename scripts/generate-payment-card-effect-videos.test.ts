import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createPaymentCardEffectVideoScenarios } from "../src/lib/payments/card-effect-samples";
import {
  DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_DIR,
  resolvePaymentCardEffectVideoOutputs,
} from "./generate-payment-card-effect-videos";

test("resolvePaymentCardEffectVideoOutputs maps scenarios to committed WEBM paths", () => {
  // Arrange
  const rootDir = "/tmp/open-links";
  const scenarios = createPaymentCardEffectVideoScenarios();

  // Act
  const outputs = resolvePaymentCardEffectVideoOutputs(rootDir);

  // Assert
  assert.equal(outputs.length, scenarios.length);
  assert.deepEqual(
    outputs.slice(0, 4).map((entry) => ({
      fixtureId: entry.fixtureId,
      bombasticity: entry.bombasticity,
      publicPath: entry.publicPath,
    })),
    [
      {
        fixtureId: "particles",
        bombasticity: 0.25,
        publicPath:
          "/generated/payment-card-effects/videos/ambient-particles-bombasticity-0.25.webm",
      },
      {
        fixtureId: "particles",
        bombasticity: 0.5,
        publicPath:
          "/generated/payment-card-effects/videos/ambient-particles-bombasticity-0.5.webm",
      },
      {
        fixtureId: "particles",
        bombasticity: 0.75,
        publicPath:
          "/generated/payment-card-effects/videos/ambient-particles-bombasticity-0.75.webm",
      },
      {
        fixtureId: "particles",
        bombasticity: 1,
        publicPath: "/generated/payment-card-effects/videos/ambient-particles-bombasticity-1.webm",
      },
    ],
  );

  for (const output of outputs) {
    assert.equal(
      path.dirname(output.outputPath),
      path.join(rootDir, DEFAULT_PAYMENT_CARD_EFFECT_VIDEO_DIR),
    );
    assert.equal(path.extname(output.outputPath), ".webm");
  }
});
