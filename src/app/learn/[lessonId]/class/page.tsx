"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Card from "@/components/ui/Card";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import Mascot from "@/components/learn/Mascot";
import { getLesson } from "@/lib/lessons";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { getFoodEventsForProfile } from "@/lib/foodEvents";
import { buildFactsPacket } from "@/lib/learnContentPool";
import { profileLanguage } from "@/types/profile";
import type { Profile } from "@/types/profile";
import type { LiveLessonPhase, LiveLessonResponse, LiveLessonSuccess, LiveLessonTurn, LiveLessonVerdict } from "@/types/liveLesson";

// What the UI should let the person do right after the turn currently on
// screen. Computed client-side from (phase just completed, verdict,
// whether we've already retried once) — the server never decides this,
// same "don't trust the model for control flow" split as the rest of the
// generative content in this app.
type NextAction =
  | { type: "continue"; next: LiveLessonPhase }
  | { type: "answer" }
  | { type: "finish" };

const MAX_RETRIES = 1; // one re-teach-and-check-again cycle before moving to recap regardless

export default function LiveClassPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lesson = getLesson(params.lessonId);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [turns, setTurns] = useState<LiveLessonTurn[]>([]);
  const [usedFoodEventIds, setUsedFoodEventIds] = useState<string[]>([]);
  const [retries, setRetries] = useState(0);
  const [action, setAction] = useState<NextAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The exact args of whatever call is currently in flight or last
  // failed — lets Retry replay it precisely instead of re-deriving
  // "what phase were we even trying to reach" from turns/action state,
  // which is exactly the kind of inference that's easy to get subtly
  // wrong (see the walkthrough below).
  const lastAttemptRef = useRef<{ phase: LiveLessonPhase; turns: LiveLessonTurn[]; usedIds: string[] } | null>(null);

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfiles();
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const events = activeProfileId ? getFoodEventsForProfile(activeProfileId) : [];
  const facts = useMemo(
    () => (activeProfile && lesson ? buildFactsPacket(activeProfile, events, lesson.nutrientFocus) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProfile?.id, lesson?.id, events.length],
  );
  const language = activeProfile ? profileLanguage(activeProfile) : "en";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, error]);

  // One API call for whichever phase is requested. Pure content-fetch —
  // all the "what happens after" logic lives in the two handlers below,
  // not here, so this stays a dumb, retryable network call.
  async function callTurn(
    phase: LiveLessonPhase,
    turnsForCall: LiveLessonTurn[],
    usedIdsForCall: string[],
  ): Promise<LiveLessonSuccess | null> {
    if (!facts || !lesson) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/live-lesson", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nutrient: lesson.nutrientFocus,
          facts,
          language,
          phase,
          turns: turnsForCall,
          usedFoodEventIds: usedIdsForCall,
        }),
      });
      const data = (await res.json()) as LiveLessonResponse;
      if (!data.ok) {
        setError(data.error);
        return null;
      }
      return data;
    } catch {
      setError("Couldn't reach the tutor — check your connection.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function decideNextAction(phase: LiveLessonPhase, verdict: LiveLessonVerdict | null, retriesSoFar: number): NextAction {
    if (phase === "teach") return { type: "continue", next: "check" };
    if (phase === "check") return { type: "answer" };
    if (phase === "recap") return { type: "finish" };
    // phase === "evaluate"
    if (verdict === "got-it" || retriesSoFar > MAX_RETRIES) return { type: "continue", next: "recap" };
    return { type: "continue", next: "check" };
  }

  // requestPhase is what advances the session forward, whatever the
  // current action was — starting, tapping Continue, or (for "check")
  // submitting a typed answer, which is why it takes the turns/usedIds
  // to send explicitly rather than reading component state (state
  // updates from pushing the user's answer haven't necessarily
  // committed yet when this runs in the same handler).
  async function requestPhase(phase: LiveLessonPhase, turnsForCall: LiveLessonTurn[], usedIdsForCall: string[]) {
    lastAttemptRef.current = { phase, turns: turnsForCall, usedIds: usedIdsForCall };
    const result = await callTurn(phase, turnsForCall, usedIdsForCall);
    if (!result) return; // error state already set by callTurn
    const nextTurns = [...turnsForCall, { role: "mascot" as const, text: result.message }];
    setTurns(nextTurns);
    const nextUsedIds = result.exampleFoodEventId
      ? Array.from(new Set([...usedIdsForCall, result.exampleFoodEventId]))
      : usedIdsForCall;
    setUsedFoodEventIds(nextUsedIds);
    const nextRetries = phase === "evaluate" && result.verdict !== "got-it" ? retries + 1 : retries;
    if (phase === "evaluate") setRetries(nextRetries);
    setAction(decideNextAction(phase, result.verdict, phase === "evaluate" ? nextRetries : retries));
  }

  useEffect(() => {
    if (!facts || !lesson || started) return;
    setStarted(true);
    requestPhase("teach", [], []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts, lesson, started]);

  function handleContinue() {
    if (!action || action.type !== "continue") return;
    requestPhase(action.next, turns, usedFoodEventIds);
  }

  function handleSubmitAnswer() {
    const text = answerText.trim();
    if (!text) return;
    const nextTurns = [...turns, { role: "user" as const, text }];
    setTurns(nextTurns);
    setAnswerText("");
    requestPhase("evaluate", nextTurns, usedFoodEventIds);
  }

  const exampleProductNames = new Map((facts?.scanFoods ?? []).map((f) => [f.foodEventId, f.productName]));

  if (!lesson) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
        <p className="text-sm text-[var(--color-on-surface-variant)]">That lesson doesn&apos;t exist.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-md flex-col gap-3 p-4">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push(`/learn/${lesson.id}`)}
          className="flex items-center gap-1 text-sm text-[var(--color-on-surface-variant)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {lesson.title}
        </button>
        {profiles.length > 0 && (
          <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} onChange={refreshProfiles} />
        )}
      </header>

      {!activeProfile && (
        <Card className="p-4">
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Add a family profile from the home screen first.
          </p>
        </Card>
      )}

      {activeProfile && (
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {turns.map((turn, i) =>
            turn.role === "mascot" ? (
              <Mascot key={i} line={turn.text} pose={i === 0 ? "sit_cross_legged" : "neutral_walk"} size="md" />
            ) : (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-[var(--radius-md)] bg-[var(--color-surface-variant)] px-3 py-2 text-sm text-[var(--color-on-surface)]">
                  {turn.text}
                </p>
              </div>
            ),
          )}

          {loading && (
            <Mascot line="…" pose="run_dash" size="md" />
          )}

          {error && (
            <Card className="flex flex-col gap-2 border-[var(--color-error)] p-3">
              <p className="text-sm text-[var(--color-on-surface)]">{error}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/learn")}
                  className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--color-on-surface-variant)]"
                >
                  Back to Learn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const last = lastAttemptRef.current;
                    if (last) requestPhase(last.phase, last.turns, last.usedIds);
                  }}
                  className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white"
                >
                  Retry
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeProfile && !loading && !error && action?.type === "continue" && (
        <button
          type="button"
          onClick={handleContinue}
          className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {action.next === "recap" ? "See recap" : "Continue"}
        </button>
      )}

      {activeProfile && !loading && !error && action?.type === "finish" && (
        <button
          type="button"
          onClick={() => router.push("/learn")}
          className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Done
        </button>
      )}

      {activeProfile && !loading && !error && action?.type === "answer" && (
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="text"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
            placeholder="Type your answer…"
            className="flex-1 rounded-[var(--radius-pill)] border border-[var(--color-outline)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--color-on-surface)]"
          />
          <button
            type="button"
            onClick={handleSubmitAnswer}
            disabled={!answerText.trim()}
            aria-label="Send answer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}

      {exampleProductNames.size > 0 && usedFoodEventIds.length > 0 && (
        <p className="shrink-0 text-center text-xs text-[var(--color-on-surface-variant)]">
          Using: {usedFoodEventIds.map((id) => exampleProductNames.get(id)).filter(Boolean).join(" · ")}
        </p>
      )}
    </main>
  );
}