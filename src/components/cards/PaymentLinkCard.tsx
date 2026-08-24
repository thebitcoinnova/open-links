import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import PaymentLinkCardView from "./PaymentLinkCardView";
import { createPaymentLinkCardModel } from "./payment-link-card-model";
import type { PaymentLinkCardProps } from "./payment-link-card-types";

export type { PaymentLinkCardProps } from "./payment-link-card-types";
export type { MobilePaymentRailActionLayout } from "./payment-link-card-actions";
export { resolveMobilePaymentRailActionLayout } from "./payment-link-card-actions";

export const PaymentLinkCard = (props: PaymentLinkCardProps) => {
  const [toggledQrRailIds, setToggledQrRailIds] = createSignal<Set<string>>(new Set());
  const [fullscreenRailId, setFullscreenRailId] = createSignal<string | undefined>();
  const [fullscreenCtaLabel, setFullscreenCtaLabel] = createSignal("Open Full Screen");
  const model = createPaymentLinkCardModel(props, {
    fullscreenCtaLabel,
    fullscreenRailId,
    setFullscreenRailId,
    setToggledQrRailIds,
    toggledQrRailIds,
  });

  createEffect(() => {
    model.rails();
    model.effectiveQrDisplay();
    setToggledQrRailIds(new Set<string>());
  });

  onMount(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const updateLabel = () => {
      const isTouch = media.matches || "ontouchstart" in window;
      setFullscreenCtaLabel(isTouch ? "Tap for Full Screen" : "Open Full Screen");
    };
    updateLabel();
    media.addEventListener("change", updateLabel);
    onCleanup(() => media.removeEventListener("change", updateLabel));
  });

  return <PaymentLinkCardView card={props} model={model} />;
};

export default PaymentLinkCard;
