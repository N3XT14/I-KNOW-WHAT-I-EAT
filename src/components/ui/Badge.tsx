import type { ReactNode } from "react";

const TONE_CLASSES = {
  primary: "bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]",
  warning: "bg-[var(--color-warning)]/15 text-[#8a6a03]",
  neutral: "bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]",
  error: "bg-[var(--color-error-container)] text-[var(--color-error)]",
  info: "bg-[var(--color-info)]/15 text-[#2d6b66]",
  attention: "bg-[var(--color-attention)]/15 text-[var(--color-attention)]",
  good: "bg-[var(--color-good-container)] text-[var(--color-good)]",
  caution: "bg-[var(--color-caution-container)] text-[var(--color-caution)]",
  high: "bg-[var(--color-high-container)] text-[var(--color-high)]",
} as const;

export default function Badge({
  children,
  icon,
  tone = "primary",
  className = "",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span
      className={`flex w-fit items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}