import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaymentCardEffects } from "./card-effects";
import type { LinkPaymentConfig, SitePaymentsConfig } from "./types";

const bitcoinPayment = (effects?: LinkPaymentConfig["effects"]): LinkPaymentConfig => ({
  primaryRailId: "bitcoin",
  effects,
  rails: [
    {
      id: "bitcoin",
      rail: "bitcoin",
      address: "bc1qexample123",
    },
  ],
});

const lightningPayment = (effects?: LinkPaymentConfig["effects"]): LinkPaymentConfig => ({
  primaryRailId: "lightning",
  effects,
  rails: [
    {
      id: "lightning",
      rail: "lightning",
      address: "lnurl1dp68gurn8ghj7mrww4example",
    },
  ],
});

test("resolvePaymentCardEffects uses the internal bombasticity default when none is configured", () => {
  // Arrange
  const payment = bitcoinPayment({
    enabled: true,
  });

  // Act
  const resolved = resolvePaymentCardEffects({
    payment,
    sitePayments: undefined,
  });

  // Assert
  assert.ok(resolved);
  assert.equal(resolved.bombasticity, 0.5);
  assert.deepEqual(resolved.effects, ["particles"]);
});

test("resolvePaymentCardEffects prefers the site bombasticity default when link config omits it", () => {
  // Arrange
  const payment = bitcoinPayment({
    enabled: true,
  });
  const sitePayments = {
    effects: {
      enabledDefault: true,
      bombasticityDefault: 0.75,
    },
  } satisfies SitePaymentsConfig;

  // Act
  const resolved = resolvePaymentCardEffects({
    payment,
    sitePayments,
  });

  // Assert
  assert.ok(resolved);
  assert.equal(resolved.bombasticity, 0.75);
});

test("resolvePaymentCardEffects lets link bombasticity override the site default", () => {
  // Arrange
  const payment = bitcoinPayment({
    enabled: true,
    bombasticity: 0.25,
  });
  const sitePayments = {
    effects: {
      enabledDefault: true,
      bombasticityDefault: 0.75,
    },
  } satisfies SitePaymentsConfig;

  // Act
  const resolved = resolvePaymentCardEffects({
    payment,
    sitePayments,
  });

  // Assert
  assert.ok(resolved);
  assert.equal(resolved.bombasticity, 0.25);
});

test("resolvePaymentCardEffects clamps out-of-range bombasticity and disables effects at zero", () => {
  // Arrange
  const disabledPayment = bitcoinPayment({
    enabled: true,
    bombasticity: -2,
  });
  const loudPayment = bitcoinPayment({
    enabled: true,
    bombasticity: 10,
  });

  // Act
  const maybeDisabled = resolvePaymentCardEffects({
    payment: disabledPayment,
    sitePayments: undefined,
  });
  const resolvedLoud = resolvePaymentCardEffects({
    payment: loudPayment,
    sitePayments: undefined,
  });

  // Assert
  assert.equal(maybeDisabled, undefined);
  assert.ok(resolvedLoud);
  assert.equal(resolvedLoud.bombasticity, 1);
});

test("resolvePaymentCardEffects preserves lightning defaults when bombasticity is omitted", () => {
  // Arrange
  const payment = lightningPayment({
    enabled: true,
  });

  // Act
  const resolved = resolvePaymentCardEffects({
    payment,
    sitePayments: undefined,
  });

  // Assert
  assert.ok(resolved);
  assert.equal(resolved.tone, "lightning");
  assert.deepEqual(resolved.effects, ["lightning-particles", "glitter-particles"]);
});
