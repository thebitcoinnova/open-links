import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { paymentCardEffectSampleFixtures } from "../src/lib/payments/card-effect-samples";
import {
  DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_BOMBASTICITY,
  DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_DIR,
  resolvePaymentCardEffectScreenshotOutputs,
} from "./generate-payment-card-effect-screenshots";

test("resolvePaymentCardEffectScreenshotOutputs maps fixtures to committed PNG paths", () => {
  // Arrange
  const rootDir = "/tmp/open-links";

  // Act
  const outputs = resolvePaymentCardEffectScreenshotOutputs(rootDir);

  // Assert
  assert.equal(outputs.length, paymentCardEffectSampleFixtures.length);
  assert.deepEqual(
    outputs.map((entry) => ({
      fixtureId: entry.fixtureId,
      publicPath: entry.publicPath,
    })),
    [
      {
        fixtureId: "particles",
        publicPath: "/generated/payment-card-effects/ambient-particles.png",
      },
      {
        fixtureId: "lightning-particles",
        publicPath: "/generated/payment-card-effects/lightning-particles.png",
      },
      {
        fixtureId: "glitter-particles",
        publicPath: "/generated/payment-card-effects/gold-glitter-particles.png",
      },
      {
        fixtureId: "lightning-default-combo",
        publicPath: "/generated/payment-card-effects/lightning-default-combo.png",
      },
    ],
  );

  for (const output of outputs) {
    assert.equal(
      path.dirname(output.outputPath),
      path.join(rootDir, DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_DIR),
    );
    assert.equal(path.extname(output.outputPath), ".png");
    assert.equal(output.bombasticity, DEFAULT_PAYMENT_CARD_EFFECT_SCREENSHOT_BOMBASTICITY);
  }
});
