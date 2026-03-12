import { createSignal, onCleanup, onMount } from "solid-js";
import type { PaymentQrStyle } from "../../lib/payments/types";
import AppDialog from "../dialog/AppDialog";
import StyledPaymentQr from "./StyledPaymentQr";

export interface PaymentQrFullscreenProps {
  open: boolean;
  railLabel: string;
  payload: string;
  style?: PaymentQrStyle;
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  logoSize?: number;
  onClose: () => void;
}

export const PaymentQrFullscreen = (props: PaymentQrFullscreenProps) => {
  const [qrSize, setQrSize] = createSignal(420);

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateSize = () => {
      setQrSize(Math.min(420, Math.max(220, window.innerWidth - 88)));
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    onCleanup(() => {
      window.removeEventListener("resize", updateSize);
    });
  });

  return (
    <AppDialog
      ariaLabel={`${props.railLabel} QR code`}
      contentClass="payment-qr-fullscreen-dialog"
      onClose={props.onClose}
      open={props.open}
      overlayClass="payment-qr-fullscreen-backdrop"
      positionerClass="payment-qr-fullscreen-positioner"
    >
      <div class="payment-qr-fullscreen-header">
        <strong>{props.railLabel}</strong>
        <button type="button" class="payment-qr-close-button" onClick={props.onClose}>
          Close
        </button>
      </div>

      <StyledPaymentQr
        payload={props.payload}
        size={qrSize()}
        style={props.style}
        foregroundColor={props.foregroundColor}
        backgroundColor={props.backgroundColor}
        logoUrl={props.logoUrl}
        logoSize={props.logoSize}
        class="payment-qr-fullscreen-canvas"
        ariaLabel={`${props.railLabel} payment QR code`}
      />
    </AppDialog>
  );
};

export default PaymentQrFullscreen;
