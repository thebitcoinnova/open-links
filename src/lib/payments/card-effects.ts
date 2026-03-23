import { resolvePaymentCardBombasticity } from "./card-effect-bombasticity";
import { resolveEnabledPaymentRails } from "./rails";
import type {
  LinkPaymentConfig,
  PaymentCardEffect,
  PaymentCardEffectsConfig,
  PaymentCardGlitterPalette,
  SitePaymentEffectsDefaults,
  SitePaymentsConfig,
} from "./types";

export type PaymentCardEffectTone = "default" | "lightning";

export interface ResolvedPaymentCardEffects {
  effects: PaymentCardEffect[];
  glitterPalette: PaymentCardGlitterPalette;
  tone: PaymentCardEffectTone;
  bombasticity: number;
}

const DEFAULT_PAYMENT_CARD_EFFECTS: readonly PaymentCardEffect[] = ["particles"];
const DEFAULT_LIGHTNING_PAYMENT_CARD_EFFECTS: readonly PaymentCardEffect[] = [
  "lightning-particles",
  "glitter-particles",
];

const resolvePrimaryRail = (payment: LinkPaymentConfig | undefined) => {
  const rails = resolveEnabledPaymentRails(payment);

  if (rails.length === 0) {
    return undefined;
  }

  const preferredRailId = payment?.primaryRailId;

  if (preferredRailId) {
    const maybePreferredRail = rails.find((rail) => rail.id === preferredRailId);

    if (maybePreferredRail) {
      return maybePreferredRail;
    }
  }

  return rails[0];
};

const uniqueEffects = (effects: readonly PaymentCardEffect[]): PaymentCardEffect[] =>
  Array.from(new Set(effects));

const resolveConfiguredEffects = (
  linkEffects: PaymentCardEffectsConfig | undefined,
  siteDefaults: SitePaymentEffectsDefaults | undefined,
  isLightningCard: boolean,
): PaymentCardEffect[] => {
  if (linkEffects?.effects?.length) {
    return uniqueEffects(linkEffects.effects);
  }

  if (siteDefaults?.defaultEffects?.length) {
    return uniqueEffects(siteDefaults.defaultEffects);
  }

  return uniqueEffects(
    isLightningCard ? DEFAULT_LIGHTNING_PAYMENT_CARD_EFFECTS : DEFAULT_PAYMENT_CARD_EFFECTS,
  );
};

export const isLightningPaymentCard = (payment: LinkPaymentConfig | undefined): boolean =>
  resolvePrimaryRail(payment)?.rail === "lightning";

export const resolvePaymentCardEffects = ({
  payment,
  sitePayments,
}: {
  payment: LinkPaymentConfig | undefined;
  sitePayments: SitePaymentsConfig | undefined;
}): ResolvedPaymentCardEffects | undefined => {
  const linkEffects = payment?.effects;
  const siteDefaults = sitePayments?.effects;
  const enabled = linkEffects?.enabled ?? siteDefaults?.enabledDefault ?? false;

  if (!enabled) {
    return undefined;
  }

  const bombasticity = resolvePaymentCardBombasticity({
    linkBombasticity: linkEffects?.bombasticity,
    siteBombasticityDefault: siteDefaults?.bombasticityDefault,
  });

  if (bombasticity <= 0) {
    return undefined;
  }

  const lightningCard = isLightningPaymentCard(payment);

  return {
    effects: resolveConfiguredEffects(linkEffects, siteDefaults, lightningCard),
    glitterPalette: linkEffects?.glitterPalette ?? siteDefaults?.glitterPaletteDefault ?? "gold",
    tone: lightningCard ? "lightning" : "default",
    bombasticity,
  };
};
