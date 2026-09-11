import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Mascot, { type MascotPose } from "@/components/learn/Mascot";
import { currentAgeBand, type Profile } from "@/types/profile";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import { isSourced } from "@/types/foodItem";
import { evaluateNutrientForConsumption } from "@/types/learnMode";
import { TRACKED_NUTRIENT_KEYS, type NutrientKey } from "@/types/nutrientLimits";
import { nutrientLabel } from "@/lib/nutrientLabels";

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type NoteTone = "good" | "caution" | "high";

function noteTone(avgPercentOfDailyLimit: number): NoteTone {
  return avgPercentOfDailyLimit >= 100 ? "high" : avgPercentOfDailyLimit >= 40 ? "caution" : "good";
}

// Same tone language as the post-scan takeaway (scan/page.tsx) — one
// mascot voice across the app, not a different set of reactions per screen.
const NOTE_POSE: Record<NoteTone, MascotPose> = {
  good: "celebrate_jump",
  caution: "heart_hug",
  high: "shy_nervous",
};

type NutrientAverage = { nutrient: NutrientKey; avgPercentOfDailyLimit: number };

export default function ProfileSummary({ profile }: { profile: Profile }) {
  const ageBand = currentAgeBand(profile.dob);
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
  // Consumption-pattern math only makes sense against sourced numbers — an
  // estimated (home-cooked/unlabeled) read has no %RDA to average. Those
  // scans still show up in History; they just don't factor into this
  // rollup. See types/foodItem.ts.
  const events = getFoodEventsForProfile(profile.id).filter(
    (e) => new Date(e.scannedAt) >= since && isSourced(e.item),
  );

  // Only counts scans that were actually logged for this profile — a scan
  // someone else in the family logged doesn't belong in this profile's
  // rollup even if it happened this week.
  let loggedScans = 0;
  const totals: Record<NutrientKey, number> = { sugar: 0, sodium: 0, saturatedFat: 0 };

  for (const event of events) {
    if (!isSourced(event.item)) continue;
    const consumption = event.consumptions.find((c) => c.profileId === profile.id);
    if (!consumption) continue;
    loggedScans++;
    for (const nutrient of TRACKED_NUTRIENT_KEYS) {
      const evaluation = evaluateNutrientForConsumption(
        event.item.extraction,
        nutrient,
        ageBand,
        consumption.portionMultiplier,
        profile.sex,
      );
      if (evaluation) totals[nutrient] += evaluation.amountConsumed;
    }
  }

  if (loggedScans === 0) return null;

  // Averaged over the full 7-day window (not just days with a scan) — a
  // week with one scan correctly produces a small average rather than
  // overstating a pattern from a single data point. This is "of what's
  // been logged," never total diet — stated plainly below rather than
  // implied.
  const nutrientAverages: NutrientAverage[] = TRACKED_NUTRIENT_KEYS.map((nutrient) => {
    // Any evaluation for this nutrient/ageBand/sex carries the same
    // `.limit` regardless of which event it came from — grabbing the
    // first one just reads off that shared limit, not a per-event value.
    const sampleEvaluation = events
      .map((e) => {
        if (!isSourced(e.item)) return null;
        const c = e.consumptions.find((c) => c.profileId === profile.id);
        if (!c) return null;
        return evaluateNutrientForConsumption(e.item.extraction, nutrient, ageBand, c.portionMultiplier, profile.sex);
      })
      .find((e) => e !== null);
    if (!sampleEvaluation) return null;
    const avgPercentOfDailyLimit = Math.round(
      (totals[nutrient] / WINDOW_DAYS / sampleEvaluation.limit) * 100,
    );
    return { nutrient, avgPercentOfDailyLimit };
  }).filter((n): n is NutrientAverage => n !== null);

  const nutrientOfNote = nutrientAverages.reduce<NutrientAverage | null>(
    (worst, n) => (!worst || n.avgPercentOfDailyLimit > worst.avgPercentOfDailyLimit ? n : worst),
    null,
  );

  return (
    <Card variant="elevated" className="flex flex-col gap-2 p-4 text-left">
      <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
        {profile.name}&apos;s week
      </h2>
      <p className="text-sm text-[var(--color-on-surface-variant)]">
        {loggedScans} scan{loggedScans === 1 ? "" : "s"} logged for{" "}
        {profile.name} in the last {WINDOW_DAYS} days.
      </p>
      {nutrientOfNote && (
        <>
          <Badge tone={noteTone(nutrientOfNote.avgPercentOfDailyLimit)} className="w-fit">
            {nutrientLabel(nutrientOfNote.nutrient)} ·{" "}
            {nutrientOfNote.avgPercentOfDailyLimit}% avg/day
          </Badge>
          <Mascot
            pose={NOTE_POSE[noteTone(nutrientOfNote.avgPercentOfDailyLimit)]}
            size="sm"
            line={
              nutrientOfNote.avgPercentOfDailyLimit >= 40
                ? `${nutrientLabel(nutrientOfNote.nutrient)} is the one to watch — averaging ${nutrientOfNote.avgPercentOfDailyLimit}% of the daily limit per day across what's been logged.`
                : `Steady week — nothing's stood out above ${nutrientOfNote.avgPercentOfDailyLimit}% of the daily limit yet.`
            }
          />
        </>
      )}
      <p className="text-xs text-[var(--color-on-surface-variant)]">
        Based only on what&apos;s been scanned and logged here — not{" "}
        {profile.name}&apos;s whole diet.
      </p>
    </Card>
  );
}