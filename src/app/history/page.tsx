"use client";

import { useEffect, useState } from "react";
import { History as HistoryIcon, ChevronDown } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import type { FoodEvent } from "@/types/foodEvent";
import type { Profile } from "@/types/profile";

const DAY_MS = 24 * 60 * 60 * 1000;

type BucketKey = "today" | "yesterday" | "last7" | "last30" | "older";
const BUCKET_LABELS: Record<BucketKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  older: "Older",
};
// Collapsed by default once history gets long enough to need bucketing at
// all — Today/Yesterday stay open since that's what someone opening this
// screen almost always wants to see first.
const COLLAPSED_BY_DEFAULT: BucketKey[] = ["last30", "older"];

function bucketKeyFor(iso: string, now: Date): BucketKey {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / DAY_MS);
  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff <= 7) return "last7";
  if (dayDiff <= 30) return "last30";
  return "older";
}

function bucketEvents(events: FoodEvent[]): { key: BucketKey; events: FoodEvent[] }[] {
  const now = new Date();
  const sorted = [...events].sort(
    (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
  );
  const order: BucketKey[] = ["today", "yesterday", "last7", "last30", "older"];
  const grouped = new Map<BucketKey, FoodEvent[]>();
  for (const event of sorted) {
    const key = bucketKeyFor(event.scannedAt, now);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return order
    .filter((key) => grouped.has(key))
    .map((key) => ({ key, events: grouped.get(key)! }));
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function HistoryPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<BucketKey>>(new Set(COLLAPSED_BY_DEFAULT));

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfiles();
  }, []);

  function toggleBucket(key: BucketKey) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const events = activeProfileId ? getFoodEventsForProfile(activeProfileId) : [];
  const buckets = bucketEvents(events);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-on-surface)]">
            History
          </h1>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Everything {activeProfile ? activeProfile.name : "you"}&apos;s scanned and logged.
          </p>
        </div>
        {profiles.length > 0 && (
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
            onChange={refreshProfiles}
          />
        )}
      </header>

      {!activeProfile && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <HistoryIcon className="h-6 w-6 text-[var(--color-on-surface-variant)]" />
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Set up a profile to start tracking history.
          </p>
        </Card>
      )}

      {activeProfile && events.length === 0 && (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <HistoryIcon className="h-6 w-6 text-[var(--color-on-surface-variant)]" />
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Nothing logged for {activeProfile.name} yet — scan a label to
            start building history.
          </p>
        </Card>
      )}

      {activeProfile &&
        buckets.map(({ key, events: bucketEvts }) => {
          const isOpen = !collapsed.has(key);
          return (
            <div key={key} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleBucket(key)}
                className="flex items-center justify-between gap-2 py-1 text-left"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-on-surface-variant)]">
                  {BUCKET_LABELS[key]} · {bucketEvts.length}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--color-on-surface-variant)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2">
                  {bucketEvts.map((event) => {
                    const consumption = event.consumptions.find(
                      (c) => c.profileId === activeProfile.id,
                    );
                    const hasMisleadingClaim = event.extraction.claims.some((c) => c.isMisleading);
                    return (
                      <Card key={event.id} className="flex flex-col gap-2 p-4">
                        {/* Name/time on one row, badge on its own row below —
                            kept apart deliberately so a longer-than-expected
                            verdict (the model doesn't always keep it as
                            short as asked) wraps in its own space instead of
                            squeezing the timestamp into a sliver. */}
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-semibold text-[var(--color-on-surface)]">
                            {event.extraction.productName ?? "Scanned label"}
                          </p>
                          <p className="shrink-0 text-xs text-[var(--color-on-surface-variant)]">
                            {timeLabel(event.scannedAt)}
                            {consumption ? ` · ${consumption.portionMultiplier} svg` : ""}
                          </p>
                        </div>
                        <Badge tone={hasMisleadingClaim ? "high" : "good"} className="w-fit">
                          {event.extraction.headline.verdict}
                        </Badge>
                        <p className="text-sm text-[var(--color-on-surface-variant)]">
                          {event.extraction.headline.drivingFact}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
    </main>
  );
}