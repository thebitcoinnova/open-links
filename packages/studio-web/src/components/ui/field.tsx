import { cn } from "@/lib/utils";
import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";
import { Input, Textarea } from "./input";

interface FieldShellProps {
  children: JSX.Element;
  class?: string;
  description?: string;
  id: string;
  label: string;
}

function FieldShell(props: FieldShellProps) {
  const descriptionId = () => (props.description ? `${props.id}-description` : undefined);

  return (
    <div class={cn("space-y-2", props.class)}>
      <label class="block text-sm font-medium text-slate-100" for={props.id}>
        {props.label}
      </label>
      <Show when={props.description}>
        {(description) => (
          <p class="text-xs text-slate-400" id={descriptionId()}>
            {description()}
          </p>
        )}
      </Show>
      {props.children}
    </div>
  );
}

export interface LabeledInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  fieldClass?: string;
  label: string;
  maybeDescription?: string;
}

export function LabeledInput(props: LabeledInputProps) {
  const [local, inputProps] = splitProps(props, ["fieldClass", "id", "label", "maybeDescription"]);
  const ariaDescribedBy =
    inputProps["aria-describedby"] ??
    (local.maybeDescription ? `${local.id}-description` : undefined);

  return (
    <FieldShell
      class={local.fieldClass}
      description={local.maybeDescription}
      id={local.id ?? ""}
      label={local.label}
    >
      <Input {...inputProps} aria-describedby={ariaDescribedBy} id={local.id} />
    </FieldShell>
  );
}

export interface LabeledTextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldClass?: string;
  label: string;
  maybeDescription?: string;
}

export function LabeledTextarea(props: LabeledTextareaProps) {
  const [local, textareaProps] = splitProps(props, [
    "fieldClass",
    "id",
    "label",
    "maybeDescription",
  ]);
  const ariaDescribedBy =
    textareaProps["aria-describedby"] ??
    (local.maybeDescription ? `${local.id}-description` : undefined);

  return (
    <FieldShell
      class={local.fieldClass}
      description={local.maybeDescription}
      id={local.id ?? ""}
      label={local.label}
    >
      <Textarea {...textareaProps} aria-describedby={ariaDescribedBy} id={local.id} />
    </FieldShell>
  );
}
