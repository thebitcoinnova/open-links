import { cn } from "@/lib/utils";
import * as AlertDialog from "@kobalte/core/alert-dialog";
import { Button, buttonClassName } from "./button";

export interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  open: boolean;
  title: string;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={props.open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          props.onCancel?.();
        }
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay class="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <AlertDialog.Content class="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-slate-100 shadow-2xl focus:outline-none">
            <AlertDialog.Title class="font-display text-xl font-bold text-white">
              {props.title}
            </AlertDialog.Title>
            <AlertDialog.Description class="mt-3 text-sm text-slate-300">
              {props.description}
            </AlertDialog.Description>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AlertDialog.CloseButton
                class={cn(buttonClassName({ size: "md", variant: "ghost" }), "sm:min-w-28")}
                type="button"
              >
                {props.cancelLabel ?? "Cancel"}
              </AlertDialog.CloseButton>
              <Button
                class="sm:min-w-28"
                onClick={() => {
                  void props.onConfirm();
                }}
                variant="primary"
              >
                {props.confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
