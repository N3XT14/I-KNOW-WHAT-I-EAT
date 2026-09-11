"use client";

import { Check, X } from "lucide-react";

export type OptionState = "idle" | "correct" | "incorrect" | "muted";

const CONTAINER_STYLES: Record<OptionState, string> = {
  idle: "border-[var(--color-outline)] text-[var(--color-on-surface)]",
  correct: "border-[var(--color-good)] bg-[var(--color-good-container)] text-[var(--color-good)]",
  incorrect: "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]",
  muted: "border-[var(--color-outline)] text-[var(--color-on-surface-variant)] opacity-60",
};

const BADGE_STYLES: Record<OptionState, string> = {
  idle: "border-[var(--color-outline)] text-[var(--color-on-surface-variant)]",
  correct: "border-[var(--color-good)] bg-[var(--color-good)] text-white",
  incorrect: "border-[var(--color-error)] bg-[var(--color-error)] text-white",
  muted: "border-[var(--color-outline)] text-[var(--color-on-surface-variant)]",
};

// Used by every single-select challenge kind (quiz-mc, comparison, decoy,
// spot-the-trick, bar-vs-limit) so a "which one's right" moment always
// looks and behaves the same way, whatever the underlying block shape.
// Replaces color-only right/wrong (border+bg alone) with a badge that
// also carries a checkmark/X — color alone isn't a reliable signal.
export default function OptionButton({
  letter,
  label,
  sublabel,
  state,
  disabled,
  onClick,
}: {
  letter: string;
  label: string;
  sublabel?: string;
  state: OptionState;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors ${CONTAINER_STYLES[state]}`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${BADGE_STYLES[state]}`}
      >
        {state === "correct" ? (
          <Check className="h-3 w-3" />
        ) : state === "incorrect" ? (
          <X className="h-3 w-3" />
        ) : (
          letter
        )}
      </span>
      <span className="flex-1">
        {label}
        {sublabel && <span className="block text-xs opacity-80">{sublabel}</span>}
      </span>
    </button>
  );
}