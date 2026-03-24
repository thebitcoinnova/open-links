import { cn } from "@/lib/utils";
import * as Select from "@kobalte/core/select";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectFieldProps {
  ariaDescribedBy?: string;
  class?: string;
  disabled?: boolean;
  id?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
}

export const selectTriggerClassName = (className?: string): string =>
  cn(
    "inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-sm transition focus-within:border-pulse focus-within:outline-none focus-within:ring-2 focus-within:ring-pulse/35 data-[expanded]:border-pulse",
    className,
  );

export function SelectField(props: SelectFieldProps) {
  const selectedOption = () => props.options.find((option) => option.value === props.value) ?? null;

  return (
    <Select.Root<SelectOption>
      value={selectedOption()}
      onChange={(nextOption) => props.onChange?.(nextOption?.value ?? "")}
      options={props.options}
      optionValue="value"
      optionTextValue="label"
      placeholder={props.placeholder}
      itemComponent={(itemProps) => (
        <Select.Item
          class="cursor-default rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition data-[highlighted]:bg-white/10 data-[disabled]:opacity-50"
          item={itemProps.item}
        >
          <Select.ItemLabel>{itemProps.item.rawValue.label}</Select.ItemLabel>
        </Select.Item>
      )}
      disallowEmptySelection={false}
    >
      <Select.HiddenSelect />
      <Select.Trigger
        id={props.id}
        class={selectTriggerClassName(props.class)}
        disabled={props.disabled}
        aria-describedby={props.ariaDescribedBy}
      >
        <Select.Value<SelectOption>>
          {(state) => (
            <span class={cn(!state.selectedOption() && "text-slate-400")}>
              {state.selectedOption()?.label ?? props.placeholder ?? "Select an option"}
            </span>
          )}
        </Select.Value>
        <Select.Icon class="text-slate-500">v</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content class="z-50 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/95 p-1 text-slate-100 shadow-2xl">
          <Select.Listbox />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
