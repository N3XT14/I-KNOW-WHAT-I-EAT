"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { LabelExtraction } from "@/types/labelExtraction";
import type { Profile } from "@/types/profile";
import { createFoodEvent, addConsumption, type FoodEvent } from "@/types/foodEvent";
import { saveFoodEvent } from "@/lib/foodEvents";

const PORTION_STEPS = [0.5, 1, 1.5, 2];

export default function LogConsumption({
  extraction,
  profiles,
  activeProfileId,
}: {
  extraction: LabelExtraction;
  profiles: Profile[];
  activeProfileId: string | null;
}) {
  // profileId -> portion multiplier. Active profile pre-selected at 1
  // serving so the common single-person case is a single tap.
  const [portions, setPortions] = useState<Record<string, number>>(() =>
    activeProfileId ? { [activeProfileId]: 1 } : {},
  );
  const [logged, setLogged] = useState<FoodEvent | null>(null);

  function toggleProfile(id: string) {
    setPortions((prev) => {
      if (id in prev) {
        return Object.fromEntries(
          Object.entries(prev).filter(([profileId]) => profileId !== id),
        );
      }
      return { ...prev, [id]: 1 };
    });
  }

  function setPortion(id: string, value: number) {
    setPortions((prev) => ({ ...prev, [id]: value }));
  }

  function handleLog() {
    const selectedIds = Object.keys(portions);
    if (selectedIds.length === 0) return;

    const [firstId, ...restIds] = selectedIds;
    let event = createFoodEvent(extraction, {
      profileId: firstId,
      portionMultiplier: portions[firstId],
    });
    for (const id of restIds) {
      event = addConsumption(event, { profileId: id, portionMultiplier: portions[id] });
    }

    saveFoodEvent(event);
    setLogged(event);
  }

  if (profiles.length === 0) return null;

  if (logged) {
    const names = logged.consumptions
      .map((c) => profiles.find((p) => p.id === c.profileId)?.name)
      .filter(Boolean)
      .join(", ");
    return (
      <Card className="flex items-center gap-2 p-4">
        <Check className="h-4 w-4 text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-on-surface)]">
          Logged for {names}.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
        Who had this?
      </h2>

      <div className="flex flex-col gap-2">
        {profiles.map((p) => {
          const selected = p.id in portions;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleProfile(p.id)}
                className={`flex flex-1 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
                }`}
              >
                {selected && <Check className="h-4 w-4 shrink-0" />}
                {p.name}
              </button>

              {selected && (
                <select
                  value={portions[p.id]}
                  onChange={(e) => setPortion(p.id, Number(e.target.value))}
                  className="rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-on-surface)]"
                >
                  {PORTION_STEPS.map((step) => (
                    <option key={step} value={step}>
                      {step} serving{step === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleLog}
        disabled={Object.keys(portions).length === 0}
        className="mt-1"
      >
        Log it
      </Button>
    </Card>
  );
}