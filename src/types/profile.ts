// A family profile — lightweight, localStorage-only, no auth. Created in
// ~10 seconds on first launch (name + DOB) so the app never blocks on a
// signup flow, but still gives Learn Mode something to hang age-banded
// limits, streaks, and history off of. See src/lib/profiles.ts for storage.
//
// DOB is stored instead of a raw age so we only ever capture it once — age
// (and therefore ageBand) is always derived live off the current date, so a
// profile never goes stale as a birthday passes.

// Bands follow the shape ICMR-NIN RDA tables are usually split into.
// "adult" is the catch-all for a parent profile — Learn Mode's applied
// challenges skew toward the kid bands, but a parent profile lets the same
// scanned food get logged against an adult portion too.
export type AgeBand = "1-3" | "4-6" | "7-9" | "10-12" | "13-15" | "16-18" | "adult";

export function ageBandFor(age: number): AgeBand {
  if (age <= 3) return "1-3";
  if (age <= 6) return "4-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  if (age <= 15) return "13-15";
  if (age <= 18) return "16-18";
  return "adult";
}

// Whole-years age as of `on` (defaults to now). Handles the "birthday
// hasn't happened yet this year" case properly rather than a naive
// year-subtraction.
export function calculateAge(dob: string, on: Date = new Date()): number {
  const birth = new Date(dob);
  let age = on.getFullYear() - birth.getFullYear();
  const monthDiff = on.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function currentAgeBand(dob: string): AgeBand {
  return ageBandFor(calculateAge(dob));
}

export type Sex = "male" | "female";

export type Profile = {
  id: string;
  name: string;
  dob: string; // ISO date, "YYYY-MM-DD" — the only thing captured at signup
  createdAt: string; // ISO timestamp
  sex?: Sex;
};

export function createProfile(name: string, dob: string, sex?: Sex): Profile {
  return {
    id: crypto.randomUUID(),
    name,
    dob,
    createdAt: new Date().toISOString(),
    ...(sex ? { sex } : {}),
  };
}