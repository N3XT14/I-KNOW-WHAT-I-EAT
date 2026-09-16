// Which installed TTS voice to use for a given language, if the person
// picked one from a voice picker (only shown when a device happens to
// have more than one voice for that language — see getVoicesForLang in
// lib/speech.ts). This is a device/browser setting, not a fact about the
// profile, so it lives in plain localStorage rather than on the Profile
// object — it wouldn't mean anything on a different device anyway.

const KEY_PREFIX = "iky-voice-pref:";

export function getVoicePref(lang: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_PREFIX + lang);
}

export function setVoicePref(lang: string, voiceURI: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + lang, voiceURI);
}