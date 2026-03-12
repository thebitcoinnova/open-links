import { For, Show } from "solid-js";
import type {
  FollowerHistoryIndexEntry,
  FollowerHistoryMode,
  FollowerHistoryRange,
  FollowerHistoryRow,
} from "../../lib/analytics/follower-history";
import AppDialog from "../dialog/AppDialog";
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

export const RANGE_OPTIONS: Array<{ label: string; value: FollowerHistoryRange }> = [
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "180D", value: "180d" },
  { label: "All", value: "all" },
];

export const MODE_OPTIONS: Array<{ label: string; value: FollowerHistoryMode }> = [
  { label: "Raw", value: "raw" },
  { label: "Growth", value: "growth" },
];

export const resolveFollowerHistoryModalAriaLabel = (entry?: FollowerHistoryIndexEntry): string =>
  `${entry?.label ?? "Platform"} follower history`;

export const FollowerHistoryModal = (props: FollowerHistoryModalProps) => (
  <AppDialog
    ariaLabel={resolveFollowerHistoryModalAriaLabel(props.entry)}
    contentClass="analytics-modal"
    onClose={props.onClose}
    open={props.open && Boolean(props.entry)}
    overlayClass="analytics-modal-backdrop"
    positionerClass="analytics-modal-positioner"
  >
    <Show when={props.entry}>
      {(entry) => (
        <>
          <div class="analytics-modal-header">
            <div>
              <strong>{entry().label}</strong>
              <p class="analytics-modal-subtitle">{entry().latestAudienceCountRaw}</p>
            </div>
            <button type="button" class="analytics-modal-close-button" onClick={props.onClose}>
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
            audienceKind={entry().audienceKind ?? "followers"}
            mode={props.mode}
            range={props.range}
            rows={props.rows}
            themeFingerprint={props.themeFingerprint}
          />
        </>
      )}
    </Show>
  </AppDialog>
);

export default FollowerHistoryModal;
