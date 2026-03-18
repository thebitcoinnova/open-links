import type { PaymentQrStyle } from "../../lib/payments/types";
import QrCodeDialog from "../qr/QrCodeDialog";

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

export const PaymentQrFullscreen = (props: PaymentQrFullscreenProps) => (
  <QrCodeDialog
    open={props.open}
    title={props.railLabel}
    payload={props.payload}
    onClose={props.onClose}
    ariaLabel={`${props.railLabel} QR code`}
    qrAriaLabel={`${props.railLabel} payment QR code`}
    style={props.style}
    foregroundColor={props.foregroundColor}
    backgroundColor={props.backgroundColor}
    logoUrl={props.logoUrl}
    logoSize={props.logoSize}
  />
);

export default PaymentQrFullscreen;
