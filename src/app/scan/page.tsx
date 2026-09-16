"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, RotateCcw, ChevronDown, UtensilsCrossed, Volume2, Square } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LogConsumptionPanel from "@/components/profile/LogConsumptionPanel";
import Mascot, { type MascotPose } from "@/components/learn/Mascot";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import type { ScanApiResponse } from "@/types/scanResult";
import type { FoodItem } from "@/types/foodItem";
import { isSourced, itemHasFlag, itemHeadline, itemTitle } from "@/types/foodItem";
import { currentAgeBand, profileLanguage, type Profile } from "@/types/profile";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { evaluateNutrientForConsumption, type NutrientEvaluation } from "@/types/learnMode";
import { FSSAI_LABEL_BASIS, TRACKED_NUTRIENT_KEYS, type NutrientKey } from "@/types/nutrientLimits";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { SEED_LABELS } from "@/lib/seedLabels";
import type { FoodEvent } from "@/types/foodEvent";
import { updateFoodEvent } from "@/lib/foodEvents";
import { createMeal, addFoodEventToMeal, type Meal } from "@/types/meal";
import { saveMeal, updateMeal, getMeal, getActiveMealId, setActiveMealId } from "@/lib/meals";
import { speak, stopSpeaking, isSpeechSupported, getVoicesForLang, pickBestVoice } from "@/lib/speech";
import { getVoicePref } from "@/lib/voicePref";

// FSSAI's %RDA on a label is always computed against one fixed adult
// reference (see FSSAI_LABEL_BASIS), regardless of who's actually eating
// it — so "15% RDA" printed on a snack means something different for a
// 4-year-old than for an adult. This is the reference each tracked
// nutrient's printed %RDA is silently assuming.
const FSSAI_REFERENCE_FOR: Record<NutrientKey, number> = {
  sugar: FSSAI_LABEL_BASIS.addedSugarG,
  sodium: FSSAI_LABEL_BASIS.sodiumMg,
  saturatedFat: FSSAI_LABEL_BASIS.saturatedFatG,
};
const TRACKED_NUTRIENTS: NutrientKey[] = TRACKED_NUTRIENT_KEYS;

type Status = "idle" | "loading" | "error";
// Single vs Meal is a choice about how logging behaves — "will this scan
// and whatever comes after it be grouped as one sitting" — not about
// whether a label exists. Whether a label exists is now something Gemini
// determines per-photo (see FoodItem.kind), never something the person
// has to predict up front.
type ScanMode = "single" | "meal";
type Comparison = { nutrient: NutrientKey; evaluation: NutrientEvaluation; fssaiReference: number };

const WATCH_TONE: Record<string, "good" | "caution" | "high"> = {
  low: "good",
  moderate: "caution",
  high: "high",
};

// Post-scan takeaway placement — the mascot's highest-visibility spot.
// Static per-tone copy for now; TutorTip->Mascot unification will replace
// this with the generated line once that rewiring happens.
const VERDICT_POSE: Record<"good" | "caution" | "high", MascotPose> = {
  good: "celebrate_jump",
  caution: "heart_hug",
  high: "shy_nervous",
};
// Hindi lines added alongside the existing English ones (same small,
// self-contained microcopy this mascot placement already owned) — not a
// wider static-UI-chrome translation pass.
const VERDICT_LINE: Record<"en" | "hi", Record<"good" | "caution" | "high", string>> = {
  en: {
    good: "Nice pick — this one's easy on the label.",
    caution: "Worth a second look before you dig in.",
    high: "Heads up, this one runs high — check what for below.",
  },
  hi: {
    good: "अच्छी पसंद — यह लेबल पर हल्का है।",
    caution: "खाने से पहले एक बार और देख लें।",
    high: "ध्यान दें, यह ज़्यादा है — नीचे देखें किसमें।",
  },
};

function verdictTone(comparisons: Comparison[], flagged: boolean): "good" | "caution" | "high" {
  if (comparisons.length > 0) {
    const worst = Math.max(...comparisons.map((c) => c.evaluation.percentOfLimit));
    if (worst >= 100) return "high";
    if (worst >= 60) return "caution";
    return "good";
  }
  return flagged ? "high" : "good";
}

// Composes the same information the visual result card shows into plain
// sentences, for the "Read aloud" button — this is the actual
// accessibility feature, not the button itself. Deliberately doesn't
// read everything the full breakdown shows (every nutrient line, every
// claim) — that's a wall of numbers even visually; it reads the verdict,
// what it means for the logged profile's limits, and anything flagged as
// misleading or worth watching, same priority order a sighted user's eye
// would actually land on.
//
// lang only changes the app's own scaffolding sentences below. headline
// .verdict/.drivingFact, item title, and claim text/notes all come from
// Gemini's label extraction, which isn't itself localized (out of scope
// per the multilingual decision) — so a Hindi read-aloud is genuinely
// bilingual: Hindi connective sentences around English extracted facts,
// not a fully Hindi narration.
function buildScanNarration(
  item: FoodItem,
  comparisons: Comparison[],
  activeProfile: Profile | null,
  lang: "en" | "hi",
): string {
  const sentences: string[] = [];
  const headline = itemHeadline(item);
  sentences.push(`${headline.verdict}. ${headline.drivingFact}`);

  const title = itemTitle(item);
  if (title) sentences.push(lang === "hi" ? `यह ${title} है।` : `This is ${title}.`);

  if (isSourced(item)) {
    if (comparisons.length > 0 && activeProfile) {
      for (const { nutrient, evaluation } of comparisons) {
        const label = nutrientLabel(nutrient, lang);
        if (lang === "hi") {
          const overLimit = evaluation.percentOfLimit >= 100 ? " यह रोज़ की सीमा से ज़्यादा है।" : "";
          sentences.push(
            `${label}, ${activeProfile.name} की रोज़ की सीमा का ${evaluation.percentOfLimit} प्रतिशत है।${overLimit}`,
          );
        } else {
          const overLimit = evaluation.percentOfLimit >= 100 ? " That's over the daily limit." : "";
          sentences.push(
            `${label} is ${evaluation.percentOfLimit} percent of ${activeProfile.name}'s daily limit.${overLimit}`,
          );
        }
      }
    } else if (activeProfile) {
      sentences.push(
        lang === "hi"
          ? `${activeProfile.name} के लिए इसे लॉग करें ताकि पता चले कि यह उनकी रोज़ की सीमा के लिए क्या मायने रखता है।`
          : `Log this for ${activeProfile.name} to hear what it means for their daily limits.`,
      );
    }

    const misleadingClaims = item.extraction.claims.filter((c) => c.isMisleading);
    for (const claim of misleadingClaims) {
      sentences.push(
        lang === "hi"
          ? `ध्यान दें — दावा "${claim.text}" भ्रामक हो सकता है। ${claim.note}`
          : `Heads up — the claim "${claim.text}" may be misleading. ${claim.note}`,
      );
    }
  } else {
    sentences.push(
      lang === "hi"
        ? "यहाँ कोई छपा हुआ लेबल नहीं है, इसलिए यह फ़ोटो से एक सामान्य अंदाज़ा है, सटीक आंकड़े नहीं।"
        : "There's no printed label here, so this is a general read from the photo, not exact numbers.",
    );
    const highWatchItems = item.extraction.watchItems.filter((w) => w.level === "high");
    for (const w of highWatchItems) {
      sentences.push(
        lang === "hi" ? `ध्यान देने लायक: ${w.nutrient}. ${w.note}` : `Worth watching: ${w.nutrient}. ${w.note}`,
      );
    }
  }

  return sentences.join(" ");
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, base64] = result.split(",");
      const mediaType = prefix.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
      resolve({ base64, mediaType });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("single");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [item, setItem] = useState<FoodItem | null>(null);
  const [multipleItemsNote, setMultipleItemsNote] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [loggedEvent, setLoggedEvent] = useState<FoodEvent | null>(null);
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // No picker UI anymore — pickBestVoice() in lib/speech.ts auto-selects
  // the best available voice (preferring a "Google <language>" voice
  // over older per-language ones, confirmed better at pronouncing
  // numbers). This just remembers which one that resolved to, so
  // handleReadAloud doesn't have to re-resolve it on every click.
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  // The one in-progress meal, if any. Restored from persisted storage on
  // mount (see lib/meals.ts) rather than starting at null every time, so
  // navigating to History and back mid-meal doesn't silently orphan it —
  // that was the actual bug in the previous version of this flow.
  const [mealId, setMealId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshProfiles();
    const active = getActiveMealId();
    if (active) {
      setMealId(active);
      setMode("meal");
    }
    // Stop any in-progress narration if the person navigates away —
    // otherwise it keeps talking over whatever screen they land on next.
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    stopSpeaking();
    setSpeaking(false);
    setStatus("loading");
    setErrorMessage(null);
    setItem(null);
    setMultipleItemsNote(null);
    setIsSample(false);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType,
          userDescription: description.trim() || null,
          language: activeLanguage,
        }),
      });
      const data: ScanApiResponse = await res.json();
      if (!data.ok) {
        setStatus("error");
        setErrorMessage(data.error);
        return;
      }
      setItem(data.item);
      setMultipleItemsNote(data.multipleItemsNote);
      setLoggedEvent(null);
      setShowFullBreakdown(false);
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }

  // Clears everything about the current scan, but deliberately leaves
  // `mode` and `mealId` alone — mode is a sticky choice while a meal is
  // in progress, and mealId needs to survive so the next scan keeps
  // adding to the same meal instead of starting a new one.
  function resetScan() {
    stopSpeaking();
    setSpeaking(false);
    setPreviewUrl(null);
    setItem(null);
    setMultipleItemsNote(null);
    setErrorMessage(null);
    setIsSample(false);
    setLoggedEvent(null);
    setShowFullBreakdown(false);
    setDescription("");
    setStatus("idle");
  }

  function loadSample(id: string) {
    const sample = SEED_LABELS.find((s) => s.id === id);
    if (!sample) return;
    stopSpeaking();
    setSpeaking(false);
    setPreviewUrl(null);
    setMultipleItemsNote(null);
    setErrorMessage(null);
    setItem(sample.item);
    setIsSample(true);
    setLoggedEvent(null);
    setShowFullBreakdown(false);
    setStatus("idle");
  }

  // Groups a just-logged FoodEvent into the in-progress meal, creating one
  // on the first item of a Meal-mode scan. Persists both the Meal record
  // and the "which meal is active" pointer, so this survives navigation.
  function attachToMeal(event: FoodEvent): string {
    let meal: Meal;
    const existing = mealId ? getMeal(mealId) : null;
    if (existing) {
      meal = addFoodEventToMeal(existing, event.id);
      updateMeal(meal);
    } else {
      meal = createMeal(null, event.id);
      saveMeal(meal);
    }
    updateFoodEvent({ ...event, mealId: meal.id });
    setActiveMealId(meal.id);
    return meal.id;
  }

  function handleLogged(event: FoodEvent) {
    setLoggedEvent(event);
    if (mode === "meal") {
      setMealId(attachToMeal(event));
    }
  }

  function finishMeal() {
    setMealId(null);
    setActiveMealId(null);
    setMode("single");
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const activeLanguage = activeProfile ? profileLanguage(activeProfile) : "en";
  const activeConsumption =
    loggedEvent?.consumptions.find((c) => c.profileId === activeProfileId) ?? null;
  const activeMeal = mealId ? getMeal(mealId) : null;

  useEffect(() => {
    if (!isSpeechSupported()) return;
    let cancelled = false;
    getVoicesForLang(activeLanguage === "hi" ? "hi" : "en").then((voices) => {
      if (cancelled) return;
      // If the person's device has a stored voice preference from
      // before the picker was removed, still honor it — otherwise
      // default to the best-known voice (see pickBestVoice).
      setSelectedVoiceURI(getVoicePref(activeLanguage) ?? pickBestVoice(voices)?.voiceURI ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeLanguage]);

  const comparisons: Comparison[] = (() => {
    if (!item || !isSourced(item) || !activeProfile || !activeConsumption) return [];
    const ageBand = currentAgeBand(activeProfile.dob);
    return TRACKED_NUTRIENTS.map((nutrient) => {
      const evaluation = evaluateNutrientForConsumption(
        item.extraction,
        nutrient,
        ageBand,
        activeConsumption.portionMultiplier,
        activeProfile.sex,
      );
      if (!evaluation) return null;
      return { nutrient, evaluation, fssaiReference: FSSAI_REFERENCE_FOR[nutrient] };
    }).filter((c): c is Comparison => c !== null);
  })();

  const flagged = item ? itemHasFlag(item) : false;
  const tone = verdictTone(comparisons, flagged);

  function handleReadAloud() {
    if (!item) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const lang = activeLanguage;
    const text = buildScanNarration(item, comparisons, activeProfile, lang);
    // Temporary debug aid — logs the exact string handed to the speech
    // engine, so a mismatch between what's spoken and what's displayed
    // can be diagnosed by comparing this against the on-screen text,
    // rather than guessing from how it sounds. Safe to remove once the
    // Hindi read-aloud investigation is done.
    console.log("[read-aloud text]", text);
    setSpeaking(true);
    speak(text, () => setSpeaking(false), lang === "hi" ? "hi-IN" : "en-IN", selectedVoiceURI ?? undefined);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-on-surface)]">
            {activeMeal ? "Add to your meal" : "Scan food"}
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            {activeMeal
              ? "Scan the next item, or tap Done above when you're finished."
              : "Label or no label — we'll figure out which."}
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

      {/* One meal at a time, on purpose (see attachToMeal/finishMeal) —
          this banner is the only place the meal is finished. Nothing else
          in the app implicitly closes it, including navigating away. */}
      {activeMeal && (
        <Card className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-on-surface)]">
              Building a meal · {activeMeal.foodEventIds.length} item
              {activeMeal.foodEventIds.length === 1 ? "" : "s"} so far
            </p>
          </div>
          <button
            type="button"
            onClick={finishMeal}
            className="shrink-0 text-xs font-semibold text-[var(--color-primary)]"
          >
            Done
          </button>
        </Card>
      )}

      {!previewUrl && !item && (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          {/* Only shown when nothing's in progress — once a meal is being
              built, every scan already belongs to it, so there's nothing
              to choose here (see the banner above instead). */}
          {!activeMeal && (
            <div className="flex w-full rounded-[var(--radius-pill)] bg-[var(--color-surface-variant)] p-1">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 rounded-[var(--radius-pill)] py-2 text-xs font-semibold transition-colors ${
                  mode === "single"
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "text-[var(--color-on-surface-variant)]"
                }`}
              >
                Single item
              </button>
              <button
                type="button"
                onClick={() => setMode("meal")}
                className={`flex-1 rounded-[var(--radius-pill)] py-2 text-xs font-semibold transition-colors ${
                  mode === "meal"
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "text-[var(--color-on-surface-variant)]"
                }`}
              >
                Meal (multiple items)
              </button>
            </div>
          )}

          <div className="rounded-full bg-[var(--color-primary-container)] p-4">
            <Camera className="h-8 w-8 text-[var(--color-primary-dark)]" />
          </div>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            {mode === "meal" && !activeMeal
              ? "Scan the first item — a label or a home-cooked dish both work."
              : "Take a photo, or upload one from your gallery. A label isn't required."}
          </p>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={'Add context (optional) — e.g. "pasta with extra cheese and butter"'}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]"
          />

          <div className="flex w-full flex-col gap-2">
            {/* capture="environment" opens the rear camera directly on mobile;
                falls back to a normal file picker on desktop. */}
            <label className="w-full">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-on-primary)] hover:opacity-90">
                <Camera className="h-4 w-4" />
                Take a photo
              </span>
            </label>
            <label className="w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-outline)] px-4 py-3 text-sm font-semibold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
                <Upload className="h-4 w-4" />
                Upload from gallery
              </span>
            </label>
          </div>

          <div className="w-full border-t border-[var(--color-outline)] pt-4">
            <p className="mb-2 text-xs text-[var(--color-on-surface-variant)]">
              Don&apos;t have one handy? Try a sample:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SEED_LABELS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => loadSample(sample.id)}
                  className="rounded-[var(--radius-pill)] border border-[var(--color-outline)] px-3 py-1.5 text-xs text-[var(--color-on-surface)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {previewUrl && (
        <Card className="overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-72 w-full object-contain bg-[var(--color-surface-variant)]"
          />
        </Card>
      )}

      {status === "loading" && (
        <Card className="flex items-center justify-center gap-3 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            Reading the photo...
          </span>
        </Card>
      )}

      {status === "error" && errorMessage && (
        <Card className="border-[var(--color-error)]/40 bg-[var(--color-error-container)] p-4">
          <p className="text-sm text-[var(--color-error)]">{errorMessage}</p>
          <p className="mt-3 mb-2 text-xs text-[var(--color-error)]">
            Or continue with a sample instead:
          </p>
          <div className="flex flex-wrap gap-2">
            {SEED_LABELS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => loadSample(sample.id)}
                className="rounded-[var(--radius-pill)] border border-[var(--color-error)]/40 bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-error)] hover:opacity-80"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {multipleItemsNote && (
        <Card className="border-[var(--color-caution)]/40 bg-[var(--color-caution-container)] p-3">
          <p className="text-xs text-[var(--color-on-surface)]">
            <span className="font-semibold">Looks like more than one item: </span>
            {multipleItemsNote}
          </p>
        </Card>
      )}

      {item && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {isSample && (
            <Badge tone="neutral" className="w-fit">
              Sample · not a live scan
            </Badge>
          )}

          {/* Instant Check — the headline verdict + the one number behind
              it, always visible, never hidden behind a tap. The verdict
              badge reflects the actual good/caution/high read once a
              profile's logged their portion (see the analysis card below);
              until then it falls back to the model's own flag. */}
          <Card variant="elevated" className="p-5">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={tone}>{itemHeadline(item).verdict}</Badge>
              {isSpeechSupported() && (
                <button
                  type="button"
                  onClick={handleReadAloud}
                  aria-label={speaking ? "Stop reading result aloud" : "Read result aloud"}
                  className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-outline)] px-3 py-1.5 text-xs font-semibold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                >
                  {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {speaking ? "Stop" : "Read aloud"}
                </button>
              )}
            </div>
            <p
              className="mt-2 text-lg font-semibold leading-snug text-[var(--color-on-surface)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {itemHeadline(item).drivingFact}
            </p>
            {itemTitle(item) && (
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                {itemTitle(item)}
                {isSourced(item) && item.extraction.servingSize
                  ? ` · per ${item.extraction.servingSize}`
                  : ""}
              </p>
            )}
            {!isSourced(item) && item.extraction.userDescription && (
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                You said: &ldquo;{item.extraction.userDescription}&rdquo;
              </p>
            )}
            <div className="mt-3">
              <Mascot
                line={VERDICT_LINE[activeLanguage][tone]}
                pose={VERDICT_POSE[tone]}
                size="sm"
              />
            </div>
          </Card>

          {/* Logging is right under the headline — the one thing every
              visit needs to end with. Inline collapsible panel, not a
              modal — see LogConsumptionPanel for why. */}
          <LogConsumptionPanel
            item={item}
            profiles={profiles}
            event={loggedEvent}
            onLogged={handleLogged}
          />

          {isSourced(item) && activeProfile && comparisons.length === 0 && (
            <Card className="p-4">
              <p className="text-sm text-[var(--color-on-surface-variant)]">
                Log this scan for {activeProfile.name} to see what it
                actually means for their daily limits — we won&apos;t guess
                a portion for you.
              </p>
            </Card>
          )}

          {isSourced(item) && comparisons.length > 0 && activeProfile && activeConsumption && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
                What that means for {activeProfile.name}
                {activeConsumption.portionMultiplier !== 1
                  ? ` (${activeConsumption.portionMultiplier} serving${activeConsumption.portionMultiplier === 1 ? "" : "s"})`
                  : ""}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                A label&apos;s %RDA is always calculated against one fixed
                adult reference (FSSAI, 2000 kcal/day) — not against{" "}
                {activeProfile.name}&apos;s own age, and it&apos;s
                per-serving. This adjusts for both.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {comparisons.map(({ nutrient, evaluation, fssaiReference }) => (
                  <li key={nutrient} className="text-sm">
                    <div className="flex items-center justify-between text-[var(--color-on-surface)]">
                      <span className="capitalize">{nutrientLabel(nutrient)}</span>
                      <span
                        className="font-semibold"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {evaluation.percentOfLimit}% of {activeProfile.name}&apos;s limit
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                      Label&apos;s reference: {fssaiReference}
                      {evaluation.unit}/day for an adult · {activeProfile.name}&apos;s actual
                      limit: {evaluation.limit}
                      {evaluation.unit}/day
                    </p>
                    <Badge
                      className="mt-1"
                      tone={evaluation.confidence === "verified" ? "info" : "neutral"}
                    >
                      {evaluation.confidence === "estimated" ? "Estimated · " : ""}
                      {evaluation.source}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!isSourced(item) && (
            <Card className="p-4">
              <p className="text-xs text-[var(--color-on-surface-variant)]">
                There&apos;s no printed label here, so this is a
                qualitative read from the photo — not a measurement.
                Numbers like %RDA don&apos;t apply.
              </p>
            </Card>
          )}

          {/* Everything below here is detail, not the verdict — collapsed
              by default so the screen isn't a wall of visually-repetitive
              cards every single time. */}
          <button
            type="button"
            onClick={() => setShowFullBreakdown((v) => !v)}
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-on-surface)]"
          >
            {isSourced(item) ? "Full label breakdown" : "What we noticed"}
            <ChevronDown
              className={`h-4 w-4 text-[var(--color-on-surface-variant)] transition-transform ${showFullBreakdown ? "rotate-180" : ""}`}
            />
          </button>

          {showFullBreakdown && isSourced(item) && (
            <div className="flex flex-col gap-3">
              {item.extraction.claims.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
                    What the label claims
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {item.extraction.claims.map((claim, i) => (
                      <li key={i} className="text-sm">
                        <Badge tone={claim.isMisleading ? "high" : "good"}>
                          {claim.text}
                        </Badge>
                        <p className="mt-1 text-[var(--color-on-surface-variant)]">
                          {claim.note}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
                  What&apos;s actually in it
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {item.extraction.nutrients.map((n, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-sm text-[var(--color-on-surface)]"
                    >
                      <span>{n.name}</span>
                      <span className="text-[var(--color-on-surface-variant)]">
                        {n.amount}
                        {n.percentDailyValue !== null ? ` · ${n.percentDailyValue}% RDA` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {showFullBreakdown && !isSourced(item) && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
                What we&apos;re watching
              </h2>
              {item.extraction.watchItems.length === 0 ? (
                <p className="text-sm text-[var(--color-on-surface-variant)]">
                  Nothing stood out from the photo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {item.extraction.watchItems.map((w, i) => (
                    <li key={i} className="text-sm">
                      <Badge tone={WATCH_TONE[w.level] ?? "neutral"}>{w.nutrient}</Badge>
                      <p className="mt-1 text-[var(--color-on-surface-variant)]">{w.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Button
            variant="outline"
            onClick={resetScan}
            className="flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {activeMeal ? "Scan the next item" : "Scan another item"}
          </Button>
        </div>
      )}
    </main>
  );
}