import type { JSX } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
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

export function Button(props: ButtonProps) {
  const className = () => buttonVariants({ variant: props.variant, size: props.size });

  return (
    <button {...props} class={cn(className(), props.class)} type={props.type ?? "button"}>
      {props.children}
    </button>
  );
}
