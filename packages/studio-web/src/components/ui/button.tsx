import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type { JSX } from "solid-js";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper hover:bg-ink/90",
        secondary: "bg-paper/95 text-ink hover:bg-paper",
        ghost: "bg-transparent text-paper hover:bg-paper/10",
        outline: "border border-ink/20 bg-white text-ink hover:bg-slate-50",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const buttonClassName = (props: Pick<ButtonProps, "class" | "size" | "variant">): string =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class);

export function Button(props: ButtonProps) {
  return (
    <button {...props} class={buttonClassName(props)} type={props.type ?? "button"}>
      {props.children}
    </button>
  );
}
