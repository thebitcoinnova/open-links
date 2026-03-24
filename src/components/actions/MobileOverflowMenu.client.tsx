import * as DropdownMenu from "@kobalte/core/dropdown-menu";
import { For } from "solid-js";
import type { MobileOverflowMenuProps } from "./MobileOverflowMenu";

export const MobileOverflowMenuClient = (props: MobileOverflowMenuProps) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      type="button"
      class={props.class ?? "mobile-overflow-menu-trigger"}
      aria-label={props.label ?? "More actions"}
    >
      More
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class={props.contentClass ?? "mobile-overflow-menu-content"}>
        <For each={props.actions}>
          {(action) => (
            <DropdownMenu.Item
              class={props.itemClass ?? "mobile-overflow-menu-item"}
              onSelect={() => {
                void action.onSelect();
              }}
            >
              <DropdownMenu.ItemLabel>{action.label}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          )}
        </For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

export default MobileOverflowMenuClient;
