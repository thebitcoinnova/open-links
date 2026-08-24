import { IconCopy, IconOpen, IconQrCode } from "../../lib/icons/custom-icons";
import type { PaymentRailActionDescriptor } from "./payment-link-card-actions";

interface PaymentRailActionControlProps {
  action: PaymentRailActionDescriptor;
  className: string;
  panelId: string;
  qrVisible: boolean;
}

const PaymentRailActionIcon = (props: { kind: PaymentRailActionDescriptor["kind"] }) => {
  if (props.kind === "copy") {
    return <IconCopy class="payment-rail-button-icon" aria-hidden="true" />;
  }

  if (props.kind === "open") {
    return <IconOpen class="payment-rail-button-icon" aria-hidden="true" />;
  }

  return <IconQrCode class="payment-rail-button-icon" aria-hidden="true" />;
};

export const PaymentRailActionControl = (props: PaymentRailActionControlProps) => {
  if (props.action.kind === "open" && props.action.href) {
    return (
      <a
        class={props.className}
        href={props.action.href}
        target={props.action.target}
        rel={props.action.rel}
        aria-label={props.action.ariaLabel}
      >
        <PaymentRailActionIcon kind={props.action.kind} />
        <span class="payment-rail-button-label">{props.action.label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      class={props.className}
      data-active={props.action.kind === "qr" && props.qrVisible ? "true" : "false"}
      onClick={() => props.action.onSelect?.()}
      aria-label={props.action.ariaLabel}
      aria-expanded={props.action.kind === "qr" ? props.qrVisible : undefined}
      aria-controls={props.action.kind === "qr" ? props.panelId : undefined}
    >
      <PaymentRailActionIcon kind={props.action.kind} />
      <span class="payment-rail-button-label">{props.action.label}</span>
    </button>
  );
};
