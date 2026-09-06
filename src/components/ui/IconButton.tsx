"use client";

import type { ReactNode, Ref } from "react";

const VARIANT_CLASSES = {
  default: "hover:bg-[var(--color-surface-variant)]",
  danger: "hover:bg-[var(--color-surface-variant)] hover:text-[var(--color-error)]",
} as const;

export default function IconButton({
  icon,
  label,
  onClick,
  size = 36,
  disabled = false,
  variant = "default",
  className = "",
  ref,
  ...rest
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  size?: number;
  disabled?: boolean;
  variant?: keyof typeof VARIANT_CLASSES;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-[var(--color-on-surface-variant)] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}