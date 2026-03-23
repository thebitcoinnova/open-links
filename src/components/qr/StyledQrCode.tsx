import { createEffect } from "solid-js";
import { mountStyledQrCode } from "../../lib/payments/qr-engine";
import type { PaymentQrStyle } from "../../lib/payments/types";
import { resolveQrThemeColors } from "../../lib/qr/theme-colors";

export interface StyledQrCodeProps {
  payload: string;
  size: number;
  style?: PaymentQrStyle;
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  logoSize?: number;
  class?: string;
  ariaLabel?: string;
  themeFingerprint?: string;
}

export const StyledQrCode = (props: StyledQrCodeProps) => {
  let container: HTMLDivElement | undefined;

  createEffect(() => {
    const host = container;
    const payload = props.payload;
    const themeFingerprint = props.themeFingerprint;

    if (!host) {
      return;
    }

    if (!payload) {
      host.textContent = "";
      return;
    }

    void themeFingerprint;

    const { backgroundColor, foregroundColor } = resolveQrThemeColors({
      foregroundColor: props.foregroundColor,
      backgroundColor: props.backgroundColor,
    });

    const cleanup = mountStyledQrCode(host, {
      payload,
      size: props.size,
      style: props.style,
      foregroundColor,
      backgroundColor,
      logoUrl: props.logoUrl,
      logoSize: props.logoSize,
    });

    return cleanup;
  });

  return (
    <div ref={container} class={props.class} role="img" aria-label={props.ariaLabel ?? "QR code"} />
  );
};

export default StyledQrCode;
