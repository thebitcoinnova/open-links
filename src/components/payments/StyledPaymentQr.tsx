import StyledQrCode, { type StyledQrCodeProps } from "../qr/StyledQrCode";

export interface StyledPaymentQrProps extends StyledQrCodeProps {}

export const StyledPaymentQr = (props: StyledPaymentQrProps) => (
  <StyledQrCode {...props} ariaLabel={props.ariaLabel ?? "Payment QR code"} />
);

export default StyledPaymentQr;
