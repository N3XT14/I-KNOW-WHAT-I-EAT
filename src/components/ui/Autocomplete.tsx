// src/components/ui/Autocomplete.tsx
"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-[var(--radius-md)] bg-[var(--color-surface-variant)] px-3 py-2.5 text-sm text-[var(--color-on-surface)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]/50";
const labelClass = "mb-1 block text-xs font-semibold text-[var(--color-on-surface)]";

/**
 * Web equivalent of Flutter's `AppAutocompleteField<T>` — a text input that
 * shows a filtered dropdown of `items` while typing, lets the doctor pick
 * one (`onSelect`, full item so callers can pull secondary fields like
 * code/composition), and always falls back to whatever was typed if nothing
 * is picked (`onChangeText`, mirrors `onSaved` in the Dart widget — free
 * text is never blocked).
 *
 * Matches by substring on `labelBuilder` (and `subtitleBuilder` if given),
 * case-insensitive, capped at 8 results so the dropdown never floods.
 */
export default function Autocomplete<T>({
  label,
  placeholder,
  items,
  labelBuilder,
  subtitleBuilder,
  value,
  onSelect,
  onChangeText,
}: {
  label: string;
  placeholder?: string;
  items: T[];
  labelBuilder: (item: T) => string;
  subtitleBuilder?: (item: T) => string;
  value: string | null;
  onSelect: (item: T) => void;
  onChangeText: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const query = (value ?? "").trim().toLowerCase();

  const matches =
    focused && query.length > 0
      ? items
          .filter((item) => {
            const l = labelBuilder(item).toLowerCase();
            const s = subtitleBuilder?.(item).toLowerCase() ?? "";
            return l.includes(query) || s.includes(query);
          })
          .slice(0, 8)
      : [];

  return (
    <div className="relative">
      {label && <label className={labelClass}>{label}</label>}
      <input
        className={inputClass}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChangeText(e.target.value)}
        onFocus={() => setFocused(true)}
        // Delay so a click on a suggestion registers before the list unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
      />
      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] shadow-card">
          {matches.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelect(item);
                setFocused(false);
              }}
              className="block w-full truncate px-3 py-2 text-left text-[12.5px] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]"
            >
              <span className="font-medium">{labelBuilder(item)}</span>
              {subtitleBuilder && (
                <span className="ml-1.5 text-[var(--color-on-surface-variant)]">
                  {subtitleBuilder(item)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
