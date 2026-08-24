import type { ResolvedPaymentRailAction } from "../../lib/payments/rails";
import type { PaymentRail } from "../../lib/payments/types";

export type PaymentRailEntry = {
  rail: PaymentRail;
  action: ResolvedPaymentRailAction;
};

export type PaymentRailActionKind = "copy" | "open" | "qr";

export interface PaymentRailActionDescriptor {
  ariaLabel: string;
  kind: PaymentRailActionKind;
  label: string;
  onSelect?: () => void | Promise<void>;
  href?: string;
  rel?: string;
  target?: "_blank" | "_self";
}

export interface MobilePaymentRailActionLayout {
  inlineKinds: PaymentRailActionKind[];
  overflowKinds: PaymentRailActionKind[];
}

export const safePaymentLinkId = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

export const maybePaymentRailById = (
  rails: PaymentRail[],
  maybeRailId: string | undefined,
): PaymentRail | undefined => {
  if (!maybeRailId) {
    return undefined;
  }

  return rails.find((rail) => rail.id === maybeRailId);
};

export const resolveMobilePaymentRailActionLayout = (
  kinds: PaymentRailActionKind[],
): MobilePaymentRailActionLayout => {
  const orderedKinds: PaymentRailActionKind[] = ["open", "qr", "copy"];
  const prioritizedKinds = orderedKinds.filter((kind) => kinds.includes(kind));

  return {
    inlineKinds: prioritizedKinds.slice(0, 2),
    overflowKinds: prioritizedKinds.slice(2),
  };
};
