import type { SelectOption } from "./select";
import { SelectField } from "./select";

export interface LabeledSelectProps {
  disabled?: boolean;
  fieldClass?: string;
  id: string;
  label: string;
  maybeDescription?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
}

export function LabeledSelect(props: LabeledSelectProps) {
  const descriptionId = props.maybeDescription ? `${props.id}-description` : undefined;

  return (
    <div class={props.fieldClass ? `space-y-2 ${props.fieldClass}` : "space-y-2"}>
      <label class="block text-sm font-medium text-slate-100" for={props.id}>
        {props.label}
      </label>
      {props.maybeDescription ? (
        <p class="text-xs text-slate-400" id={descriptionId}>
          {props.maybeDescription}
        </p>
      ) : null}
      <SelectField
        id={props.id}
        ariaDescribedBy={descriptionId}
        disabled={props.disabled}
        onChange={props.onChange}
        options={props.options}
        placeholder={props.placeholder}
        value={props.value}
      />
    </div>
  );
}
