import { For, Show } from "solid-js";
import type {
  FollowerHistoryIndexEntry,
  FollowerHistoryMode,
  FollowerHistoryRange,
  FollowerHistoryRow,
} from "../../lib/analytics/follower-history";
import { describeFollowerHistoryRange } from "../../lib/analytics/follower-history";
import AppDialog from "../dialog/AppDialog";
import FollowerHistoryChart from "./FollowerHistoryChart";
import FollowerHistorySegmentedControl from "./FollowerHistorySegmentedControl";
import {
  FOLLOWER_HISTORY_MODE_OPTIONS,
  FOLLOWER_HISTORY_RANGE_OPTIONS,
} from "./follower-history-controls";

export interface FollowerHistoryModalProps {
  emptyStateMessage?: string;
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
            <FollowerHistorySegmentedControl
              class="analytics-control-group"
              label="History time range"
              options={FOLLOWER_HISTORY_RANGE_OPTIONS}
              onChange={props.onRangeChange}
              value={props.range}
            />
            <FollowerHistorySegmentedControl
              class="analytics-control-group"
              label="History display mode"
              options={FOLLOWER_HISTORY_MODE_OPTIONS}
              onChange={props.onModeChange}
              value={props.mode}
            />
          </div>

          <FollowerHistoryChart
            audienceKind={entry().audienceKind ?? "followers"}
            emptyStateMessage={props.emptyStateMessage}
            mode={props.mode}
            rangeDescription={describeFollowerHistoryRange(props.range)}
            range={props.range}
            rows={props.rows}
            summaryLabel={entry().label}
            themeFingerprint={props.themeFingerprint}
          />
        </>
      )}
    </Show>
  </AppDialog>
);

export default FollowerHistoryModal;
