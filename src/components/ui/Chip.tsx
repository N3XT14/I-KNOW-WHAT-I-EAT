"use client";

import type { ReactNode } from "react";

/**
 * Small pill for list-of-tags UI (Quick-add lists' built-in/custom preset
 * chips). Distinct from Badge — Badge is for status/role labels attached to
 * a single subject (ProfileCard), Chip is for members of a flat collection,
 * optionally removable.
 */
const TONE_CLASSES = {
  neutral: "bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]",
  primary: "bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]",
} as const;

export default function Chip({
  children,
  tone = "neutral",
  onRemove,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="-mr-0.5 shrink-0 rounded-full p-0.5 transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
