// Collision-resistant ID generation.
//
// `crypto.randomUUID()` is available in every modern browser (Chrome 92+,
// Firefox 95+, Safari 15.4+). We fall back to a Math.random-based string only
// in ancient environments — never in production — so that IDs stay globally
// unique across features (projects, beats, cast, breakdown items, files,
// messages, etc.).
//
// Why this matters: we previously scattered
//   Math.random().toString(36).slice(2, 10)
// throughout the codebase. That yields only ~41 bits of entropy, which starts
// colliding around ~200k items. Supabase/idb rows that share an ID get
// silently overwritten. Using UUID everywhere makes the ID space large enough
// that the app can ignore collision concerns.

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without the Web Crypto API. Still stronger than
  // the old 8-char slug because we include Date.now() for monotonicity.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
