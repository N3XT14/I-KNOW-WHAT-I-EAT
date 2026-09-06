"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/Popover";
import { currentAgeBand, type Profile } from "@/types/profile";
import { setActiveProfileId } from "@/lib/profiles";
import ProfileOnboarding from "@/components/profile/ProfileOnboarding";

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function ProfileSwitcher({
  profiles,
  activeProfileId,
  onChange,
}: {
  profiles: Profile[];
  activeProfileId: string | null;
  onChange: () => void; // re-read profiles/active id after any change
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const active = profiles.find((p) => p.id === activeProfileId) ?? null;

  function selectProfile(id: string) {
    setActiveProfileId(id);
    onChange();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAdding(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-sm font-semibold text-[var(--color-primary-dark)]"
          aria-label="Switch profile"
        >
          {active ? initials(active.name) : "?"}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-2">
        {adding ? (
          <ProfileOnboarding
            onDone={() => {
              setAdding(false);
              onChange();
              setOpen(false);
            }}
          />
        ) : (
          <div className="flex flex-col gap-1">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProfile(p.id)}
                className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-sm hover:bg-[var(--color-surface-variant)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-container)] text-xs font-semibold text-[var(--color-primary-dark)]">
                  {initials(p.name)}
                </span>
                <span className="flex-1 text-[var(--color-on-surface)]">
                  {p.name}
                  <span className="ml-1.5 text-xs text-[var(--color-on-surface-variant)]">
                    {currentAgeBand(p.dob)}
                  </span>
                </span>
                {p.id === activeProfileId && (
                  <Check className="h-4 w-4 text-[var(--color-primary)]" />
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-1 flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-sm text-[var(--color-primary-dark)] hover:bg-[var(--color-surface-variant)]"
            >
              <Plus className="h-4 w-4" />
              Add family member
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}