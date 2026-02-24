import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { PaymentQrStyle } from "../../lib/payments/types";
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

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const PaymentQrFullscreen = (props: PaymentQrFullscreenProps) => {
  let dialogRef: HTMLDivElement | undefined;
  let closeButtonRef: HTMLButtonElement | undefined;
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

  createEffect(() => {
    if (!props.open || typeof document === "undefined") {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        props.onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef) {
        return;
      }

      const focusable = Array.from(dialogRef.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      closeButtonRef?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement?.focus();
    };
  });

  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.open}>
      <div class="payment-qr-fullscreen-backdrop" role="presentation" onClick={handleBackdropClick}>
        <div
          class="payment-qr-fullscreen-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={`${props.railLabel} QR code`}
          ref={dialogRef}
        >
          <div class="payment-qr-fullscreen-header">
            <strong>{props.railLabel}</strong>
            <button type="button" class="payment-qr-close-button" onClick={props.onClose} ref={closeButtonRef}>
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
        </div>
      </div>
    </Show>
  );
};

export default PaymentQrFullscreen;
