// src/components/ui/Button.tsx
"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * Base button primitive. danger/solid/outline.
 */
const VARIANT_CLASSES = {
  solid: "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90",
  outline:
    "border border-[var(--color-outline)] text-[var(--color-on-surface)] hover:border-[var(--color-error)] hover:text-[var(--color-error)]",
  danger: "bg-[var(--color-error)] text-white hover:opacity-90",
} as const;

export default function Button({
  variant = "solid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT_CLASSES;
}) {
  return (
    <button
      type="button"
      className={`rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}