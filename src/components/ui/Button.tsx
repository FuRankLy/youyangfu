import { cn } from "@/lib/cn";

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[2px] border px-5 text-small font-medium " +
  "transition-[background-color,border-color,color,transform] duration-[160ms] ease-settle " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

const variants = {
  solid: "border-ink bg-ink text-paper hover:border-cinnabar hover:bg-cinnabar",
  outline: "border-line bg-transparent text-ink hover:border-ink",
} as const;

export type ButtonVariant = keyof typeof variants;

/** Class names for anything that should look like a button (links included). */
export function buttonClass(variant: ButtonVariant = "solid", className?: string) {
  return cn(base, variants[variant], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({ variant = "solid", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

/** Shared look for text inputs and textareas. */
export const fieldClass =
  "w-full rounded-[2px] border border-line bg-surface px-3.5 py-2.5 text-body text-ink " +
  "placeholder:text-ink-soft/70 transition-[border-color] duration-[160ms] ease-settle " +
  "hover:border-ink-soft focus:border-ink focus:outline-none focus-visible:outline-[1.5px] " +
  "aria-[invalid=true]:border-cinnabar";

/** Shared look for small toggles such as topic chips. Pair with aria-pressed or a checked radio. */
export const chipClass =
  "inline-flex h-9 items-center rounded-[2px] border border-line px-3.5 text-small font-medium " +
  "transition-[background-color,border-color,color] duration-[160ms] ease-settle hover:border-ink " +
  "aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper";
