"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Mascot from "@/components/learn/Mascot";
import { createProfile, type Sex } from "@/types/profile";
import { saveProfile } from "@/lib/profiles";

// Shown once on first launch (no profiles yet), and again any time someone
// taps "Add family member" from the profile switcher. Name + DOB is the
// entire required signup flow, on purpose (see the earlier decision: fast
// profile creation instead of a separate guest mode). Sex is asked last
// and is optional — skipping it just means this profile's nutrient limits
// stay sex-averaged (exactly what every profile got before this field
// existed) instead of the real ICMR-NIN figure for their sex.
export default function ProfileOnboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter a name.");
      return;
    }
    if (!dob) {
      setError("Enter a date of birth.");
      return;
    }
    if (dob > today) {
      setError("That date is in the future.");
      return;
    }

    saveProfile(createProfile(trimmedName, dob, sex ?? undefined));
    onDone();
  }

  return (
    <Card variant="elevated" className="flex flex-col gap-4 p-6">
      <Mascot pose="heart_hug" size="md" line="Hi! Let's get your family set up." />
      <div>
        <h1 className="text-lg font-semibold text-[var(--color-on-surface)]">
          Who&apos;s this for?
        </h1>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Just a name and date of birth — no account, no email. Add the rest
          of the family later from the profile switcher.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-on-surface-variant)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aarav"
            autoFocus
            className="rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-on-surface-variant)]">
            Date of birth
          </span>
          <input
            type="date"
            value={dob}
            max={today}
            onChange={(e) => setDob(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)]"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-on-surface-variant)]">
            Sex (optional — sharpens their daily limits)
          </span>
          <div className="flex gap-2">
            {(["female", "male"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSex((prev) => (prev === option ? null : option))}
                className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm capitalize transition-colors ${
                  sex === option
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}

        <Button type="submit" className="mt-1">
          Get started
        </Button>
      </form>
    </Card>
  );
}