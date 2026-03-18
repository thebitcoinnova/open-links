import { createSignal, onCleanup, onMount } from "solid-js";
import type { PaymentQrStyle } from "../../lib/payments/types";
import AppDialog from "../dialog/AppDialog";
import StyledQrCode from "./StyledQrCode";

export interface QrCodeDialogProps {
  open: boolean;
  title: string;
  payload: string;
  onClose: () => void;
  ariaLabel?: string;
  qrAriaLabel?: string;
  style?: PaymentQrStyle;
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  logoSize?: number;
}

export const resolveQrCodeDialogAriaLabel = (title?: string): string => {
  if (typeof title !== "string" || title.trim().length === 0) {
    return "QR code";
  }

  return `${title} QR code`;
};

export const QrCodeDialog = (props: QrCodeDialogProps) => {
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
      ariaLabel={props.ariaLabel ?? resolveQrCodeDialogAriaLabel(props.title)}
      contentClass="qr-code-dialog"
      onClose={props.onClose}
      open={props.open}
      overlayClass="qr-code-dialog-backdrop"
      positionerClass="qr-code-dialog-positioner"
    >
      <div class="qr-code-dialog-header">
        <strong>{props.title}</strong>
        <button type="button" class="qr-code-dialog-close-button" onClick={props.onClose}>
          Close
        </button>
      </div>

      <StyledQrCode
        payload={props.payload}
        size={qrSize()}
        style={props.style}
        foregroundColor={props.foregroundColor}
        backgroundColor={props.backgroundColor}
        logoUrl={props.logoUrl}
        logoSize={props.logoSize}
        class="qr-code-dialog-canvas"
        ariaLabel={props.qrAriaLabel ?? resolveQrCodeDialogAriaLabel(props.title)}
      />
    </AppDialog>
  );
};

export default QrCodeDialog;
