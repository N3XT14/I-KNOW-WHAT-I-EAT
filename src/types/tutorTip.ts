// The wire shape for /api/tutor-tip — one AI-generated coaching line for
// a profile's weakest nutrient. See lib/tutorTip.ts for how the weak
// nutrient and its supporting real-food evidence are picked client-side
// before this type is what comes back over the wire.

export type TutorTipApiResponse = { ok: true; tip: string } | { ok: false; error: string };