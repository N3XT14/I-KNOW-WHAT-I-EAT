"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { LabelExtraction } from "@/types/labelExtraction";
import type { Profile } from "@/types/profile";
import { createFoodEvent, addConsumption, type FoodEvent } from "@/types/foodEvent";
import { saveFoodEvent, updateFoodEvent } from "@/lib/foodEvents";

const PORTION_PRESETS = [0.5, 1, 1.5, 2];
const PORTION_MIN = 0.25;
const PORTION_MAX = 4;
const PORTION_STEP = 0.25;

function formatPortion(value: number): string {
  const whole = Math.floor(value);
  const frac = Math.round((value - whole) * 100);
  const fracGlyph = frac === 25 ? "¼" : frac === 50 ? "½" : frac === 75 ? "¾" : "";
  if (fracGlyph) return `${whole > 0 ? whole : ""}${fracGlyph}`;
  return `${value}`;
}

export default function LogConsumptionPanel({
  extraction,
  profiles,
  event,
  onLogged,
}: {
  extraction: LabelExtraction;
  profiles: Profile[];
  // The FoodEvent this scan has produced so far, or null if nothing's been
  // logged yet. Appending only: a profile already present here can't be
  // re-selected — there's no edit path, only "log for someone who hasn't
  // been logged yet".
  event: FoodEvent | null;
  onLogged: (event: FoodEvent) => void;
}) {
  // Collapsed by default; expands into normal page flow (pushing
  // everything below it down) rather than overlaying anything — there's
  // no absolute/fixed positioning here at all, so there's no frame or
  // viewport boundary for this to ever overflow.
  const [open, setOpen] = useState(false);
  const [portions, setPortions] = useState<Record<string, number>>({});

  const alreadyLoggedIds = new Set(event?.consumptions.map((c) => c.profileId) ?? []);
  const availableProfiles = profiles.filter((p) => !alreadyLoggedIds.has(p.id));

  function toggleProfile(id: string) {
    setPortions((prev) => {
      if (id in prev) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: 1 };
    });
  }

  function setPortion(id: string, value: number) {
    setPortions((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    const selectedIds = Object.keys(portions);
    if (selectedIds.length === 0) return;

    let updated: FoodEvent;
    if (event) {
      updated = event;
      for (const id of selectedIds) {
        updated = addConsumption(updated, { profileId: id, portionMultiplier: portions[id] });
      }
      updateFoodEvent(updated);
    } else {
      const [firstId, ...restIds] = selectedIds;
      updated = createFoodEvent(extraction, {
        profileId: firstId,
        portionMultiplier: portions[firstId],
      });
      for (const id of restIds) {
        updated = addConsumption(updated, { profileId: id, portionMultiplier: portions[id] });
      }
      saveFoodEvent(updated);
    }

    onLogged(updated);
    setPortions({});
    setOpen(false);
  }

  if (profiles.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {availableProfiles.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-on-primary)]"
        >
          {event ? "Log for someone else" : "Log this scan"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}

      {open && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
            Who had this?
          </h2>

          <div className="flex flex-col gap-3">
            {availableProfiles.map((p) => {
              const selected = p.id in portions;
              const value = portions[p.id] ?? 1;
              return (
                <div key={p.id} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleProfile(p.id)}
                    className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                        : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
                    }`}
                  >
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                    {p.name}
                  </button>

                  {selected && (
                    <>
                      <div className="flex items-center gap-3 pl-1">
                        <input
                          type="range"
                          min={PORTION_MIN}
                          max={PORTION_MAX}
                          step={PORTION_STEP}
                          value={value}
                          onChange={(e) => setPortion(p.id, Number(e.target.value))}
                          className="h-1.5 flex-1 accent-[var(--color-primary)]"
                          aria-label={`${p.name}'s portion, in servings`}
                        />
                        <span
                          className="w-14 shrink-0 text-right text-sm font-semibold text-[var(--color-on-surface)]"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {formatPortion(value)} svg
                        </span>
                      </div>
                      <div className="flex gap-1.5 pl-1">
                        {PORTION_PRESETS.map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => setPortion(p.id, step)}
                            className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium transition-colors ${
                              value === step
                                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                                : "bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)]"
                            }`}
                          >
                            {formatPortion(step)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <Button onClick={handleSubmit} disabled={Object.keys(portions).length === 0}>
            Log it
          </Button>
        </Card>
      )}

      {event && event.consumptions.length > 0 && (
        <Card variant="elevated" className="flex items-center gap-2 p-4">
          <Check className="h-4 w-4 shrink-0 text-[var(--color-good)]" />
          <p className="text-sm text-[var(--color-on-surface)]">
            Logged for{" "}
            {event.consumptions
              .map((c) => profiles.find((p) => p.id === c.profileId)?.name)
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        </Card>
      )}
    </div>
  );
}