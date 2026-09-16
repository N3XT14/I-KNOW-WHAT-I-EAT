import { type Profile } from "@/types/profile";

const PROFILES_KEY = "iky-profiles";
const ACTIVE_PROFILE_KEY = "iky-active-profile";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getProfiles(): Profile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    return [];
  }
}

export function saveProfile(profile: Profile): void {
  if (!isBrowser()) return;
  const profiles = getProfiles();
  profiles.push(profile);
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  
  if (!getActiveProfileId()) {
    setActiveProfileId(profile.id);
  }
}

// Generic patch — used for anything editable after signup (currently just
// language). Rewrites the whole profiles array since that's how the rest
// of this file already persists (no per-profile storage key).
export function updateProfile(profileId: string, patch: Partial<Profile>): void {
  if (!isBrowser()) return;
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === profileId);
  if (idx === -1) return;
  profiles[idx] = { ...profiles[idx], ...patch };
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function deleteProfile(profileId: string): void {
  if (!isBrowser()) return;
  const remaining = getProfiles().filter((p) => p.id !== profileId);
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(remaining));
  if (getActiveProfileId() === profileId) {
    window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
    if (remaining[0]) setActiveProfileId(remaining[0].id);
  }
}

export function getActiveProfileId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(profileId: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}

export function getActiveProfile(): Profile | null {
  const id = getActiveProfileId();
  if (!id) return null;
  return getProfiles().find((p) => p.id === id) ?? null;
}