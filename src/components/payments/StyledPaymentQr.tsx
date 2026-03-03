import { createEffect } from "solid-js";
import { mountStyledQrCode } from "../../lib/payments/qr-engine";
import type { PaymentQrStyle } from "../../lib/payments/types";

export interface StyledPaymentQrProps {
  payload: string;
  size: number;
  style?: PaymentQrStyle;
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  logoSize?: number;
  class?: string;
  ariaLabel?: string;
}

export const StyledPaymentQr = (props: StyledPaymentQrProps) => {
  let container: HTMLDivElement | undefined;

  createEffect(() => {
    const host = container;
    const payload = props.payload;

    if (!host) {
      return;
    }

    if (!payload) {
      host.textContent = "";
      return;
    }

    const cleanup = mountStyledQrCode(host, {
      payload,
      size: props.size,
      style: props.style,
      foregroundColor: props.foregroundColor,
      backgroundColor: props.backgroundColor,
      logoUrl: props.logoUrl,
      logoSize: props.logoSize,
    });

    return cleanup;
  });

  return (
    <div
      ref={container}
      class={props.class}
      role="img"
      aria-label={props.ariaLabel ?? "Payment QR code"}
    />
  );
};

export default StyledPaymentQr;
