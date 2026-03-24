import * as SegmentedControl from "@kobalte/core/segmented-control";
import { For } from "solid-js";

export interface FollowerHistorySegmentedOption<Value extends string> {
  label: string;
  value: Value;
}

export interface FollowerHistorySegmentedControlProps<Value extends string> {
  class?: string;
  label: string;
  onChange: (value: Value) => void;
  options: Array<FollowerHistorySegmentedOption<Value>>;
  value: Value;
}

export const FollowerHistorySegmentedControl = <Value extends string>(
  props: FollowerHistorySegmentedControlProps<Value>,
) => (
  <SegmentedControl.Root
    class={props.class}
    value={props.value}
    onChange={(nextValue) => props.onChange(nextValue as Value)}
  >
    <SegmentedControl.Label class="sr-only">{props.label}</SegmentedControl.Label>
    <div class="analytics-segmented-control" role="presentation">
      <For each={props.options}>
        {(option) => (
          <SegmentedControl.Item class="analytics-segmented-item" value={option.value}>
            <SegmentedControl.ItemInput />
            <SegmentedControl.ItemLabel class="analytics-segmented-item-label">
              {option.label}
            </SegmentedControl.ItemLabel>
          </SegmentedControl.Item>
        )}
      </For>
    </div>
  </SegmentedControl.Root>
);

export default FollowerHistorySegmentedControl;
