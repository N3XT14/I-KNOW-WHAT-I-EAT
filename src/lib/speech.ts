// Thin wrapper over the browser's built-in speechSynthesis — no API call,
// no cost, works offline. This is deliberately not a full TTS pipeline:
// it's scoped to "read this one block of text aloud, with a way to stop
// it," which is what the scan-result read-aloud button needs.

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

// getVoices() returns an empty array until the browser has actually
// loaded its voice list, which (per spec, and confirmed flaky in
// practice on Chrome/Android especially) can still be empty on the very
// first call after page load — the list only populates once, some tens
// of ms later, when 'voiceschanged' fires. Without waiting for that, an
// early speak() call falls back to a default voice regardless of `lang`
// while a later call on the same page might get the right one — which
// looks exactly like "worked in Hindi the first time, English-only the
// second" even though the same text and lang were passed both times.
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const handle = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handle);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handle);
    // Some browsers never fire voiceschanged if the list is genuinely
    // empty (no voices installed at all) — don't hang forever.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

// Exposed so a caller can offer a voice picker when a device happens to
// have more than one installed voice for a language (varies wildly by
// device/OS — commonly 0 or 1 for Hindi on a given phone, occasionally
// more). Returns [] if none match; the caller decides what to do with
// that (e.g. hide the picker rather than show a useless 1-option list).
export async function getVoicesForLang(lang: string): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return [];
  const voices = await loadVoices();
  const prefix = lang.split("-")[0].toLowerCase();
  return voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

// When a device has more than one voice for a language, quality varies a
// lot more than the name suggests — on Android specifically, the older
// per-language voices (e.g. "Lekha" for Hindi) are noticeably worse at
// numbers and technical/loanword pronunciation than the newer "Google
// <language>" neural voices. Preferring a Google-named voice as the
// default (when one exists) fixes that for everyone without requiring
// them to know to open the picker and switch it themselves — confirmed
// against real device testing where "Lekha" skipped/mangled numbers and
// "Google हिन्दी" read the same text correctly.
export function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((v) => v.name.toLowerCase().includes("google")) ?? voices[0];
}

// lang lets a caller ask for a specific voice locale (e.g. "hi-IN") once
// multilingual narration exists; omitted, it uses the browser's default
// voice. voiceURI, if given, picks that exact voice (from
// getVoicesForLang) instead of the default-quality one — this is how a
// voice picker overrides the default choice. If no installed voice
// matches (common on devices without a Hindi voice pack — a real device
// limitation this code can't work around, not a bug), this falls back to
// whatever the browser's default is rather than throwing; setting `.lang`
// on the utterance at least gives engines that DO support the locale a
// chance to still use it.
export async function speak(text: string, onEnd?: () => void, lang?: string, voiceURI?: string): Promise<void> {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel(); // only one utterance in flight at a time
  const utterance = new SpeechSynthesisUtterance(text);
  // Slightly slower than default so label numbers aren't easy to miss;
  // a touch slower again for Hindi, since some of the vocabulary here
  // (transliterated technical terms especially) is less familiar to
  // parse quickly by ear than plain conversational speech.
  utterance.rate = lang?.startsWith("hi") ? 0.85 : 0.95;
  if (lang) {
    utterance.lang = lang;
    const voices = await loadVoices();
    const prefix = lang.split("-")[0]; // "hi-IN" -> "hi", matches "hi", "hi-IN", "hi-Deva-IN" etc.
    const langMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase()));
    const byURI = voiceURI ? langMatches.find((v) => v.voiceURI === voiceURI) : undefined;
    const match = byURI ?? pickBestVoice(langMatches);
    if (match) utterance.voice = match;
  }
  utterance.onend = () => {
    currentUtterance = null;
    onEnd?.();
  };
  utterance.onerror = () => {
    currentUtterance = null;
    onEnd?.();
  };
  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}