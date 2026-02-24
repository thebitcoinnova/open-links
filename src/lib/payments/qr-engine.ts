import QRCodeStyling, { type DotType, type Options } from "qr-code-styling";
import type { PaymentQrStyle } from "./types";

export interface StyledQrCodeOptions {
  payload: string;
  size: number;
  style?: PaymentQrStyle;
  foregroundColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  logoSize?: number;
  margin?: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const styleToDotType = (style: PaymentQrStyle): DotType => {
  switch (style) {
    case "dots":
      return "dots";
    case "rounded":
      return "rounded";
    case "square":
    default:
      return "square";
  }
};

const toQrOptions = (options: StyledQrCodeOptions): Options => {
  const resolvedStyle = options.style ?? "square";
  const resolvedLogoSize = clamp(options.logoSize ?? 0.24, 0.15, 0.35);

  return {
    type: "svg",
    width: options.size,
    height: options.size,
    margin: Math.max(0, options.margin ?? 8),
    data: options.payload,
    image: options.logoUrl,
    qrOptions: {
      errorCorrectionLevel: "H"
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: resolvedLogoSize,
      margin: 2,
      crossOrigin: "anonymous"
    },
    dotsOptions: {
      type: styleToDotType(resolvedStyle),
      color: options.foregroundColor ?? "#111827"
    },
    cornersSquareOptions: {
      type: resolvedStyle === "dots" ? "extra-rounded" : "square",
      color: options.foregroundColor ?? "#111827"
    },
    cornersDotOptions: {
      type: resolvedStyle === "dots" ? "dot" : "square",
      color: options.foregroundColor ?? "#111827"
    },
    backgroundOptions: {
      color: options.backgroundColor ?? "#FFFFFF"
    }
  };
};

export const createStyledQrCode = (options: StyledQrCodeOptions): QRCodeStyling =>
  new QRCodeStyling(toQrOptions(options));

export const mountStyledQrCode = (
  container: HTMLElement,
  options: StyledQrCodeOptions
): (() => void) => {
  const qrCode = createStyledQrCode(options);
  container.textContent = "";
  qrCode.append(container);

  return () => {
    container.textContent = "";
  };
};
