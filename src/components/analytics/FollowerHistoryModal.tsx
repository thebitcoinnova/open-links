import { For, Show, createEffect, onCleanup } from "solid-js";
import type {
  FollowerHistoryIndexEntry,
  FollowerHistoryMode,
  FollowerHistoryRange,
  FollowerHistoryRow,
} from "../../lib/analytics/follower-history";
import FollowerHistoryChart from "./FollowerHistoryChart";

export interface FollowerHistoryModalProps {
  entry?: FollowerHistoryIndexEntry;
  mode: FollowerHistoryMode;
  onClose: () => void;
  onModeChange: (mode: FollowerHistoryMode) => void;
  onRangeChange: (range: FollowerHistoryRange) => void;
  open: boolean;
  range: FollowerHistoryRange;
  rows: FollowerHistoryRow[];
  themeFingerprint: string;
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const RANGE_OPTIONS: Array<{ label: string; value: FollowerHistoryRange }> = [
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "180D", value: "180d" },
  { label: "All", value: "all" },
];

const MODE_OPTIONS: Array<{ label: string; value: FollowerHistoryMode }> = [
  { label: "Raw", value: "raw" },
  { label: "Growth", value: "growth" },
];

export const FollowerHistoryModal = (props: FollowerHistoryModalProps) => {
  let dialogRef: HTMLDialogElement | undefined;
  let closeButtonRef: HTMLButtonElement | undefined;

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

      const focusable = Array.from(
        dialogRef.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
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

  const handleBackdropPointerDown = (event: PointerEvent) => {
    if (event.target === event.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.open && props.entry}>
      <div class="analytics-modal-backdrop" onPointerDown={handleBackdropPointerDown}>
        <dialog
          class="analytics-modal"
          aria-modal="true"
          aria-label={`${props.entry?.label ?? "Platform"} follower history`}
          ref={dialogRef}
          open
        >
          <div class="analytics-modal-header">
            <div>
              <strong>{props.entry?.label}</strong>
              <p class="analytics-modal-subtitle">{props.entry?.latestAudienceCountRaw}</p>
            </div>
            <button
              type="button"
              class="analytics-modal-close-button"
              onClick={props.onClose}
              ref={closeButtonRef}
            >
              Close
            </button>
          </div>

          <div class="analytics-controls">
            <div class="analytics-control-group" aria-label="History time range">
              <For each={RANGE_OPTIONS}>
                {(option) => (
                  <button
                    type="button"
                    class="analytics-chip"
                    data-active={props.range === option.value ? "true" : "false"}
                    onClick={() => props.onRangeChange(option.value)}
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </div>

            <div class="analytics-control-group" aria-label="History display mode">
              <For each={MODE_OPTIONS}>
                {(option) => (
                  <button
                    type="button"
                    class="analytics-chip"
                    data-active={props.mode === option.value ? "true" : "false"}
                    onClick={() => props.onModeChange(option.value)}
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <FollowerHistoryChart
            audienceKind={props.entry?.audienceKind ?? "followers"}
            mode={props.mode}
            range={props.range}
            rows={props.rows}
            themeFingerprint={props.themeFingerprint}
          />
        </dialog>
      </div>
    </Show>
  );
};

export default FollowerHistoryModal;
