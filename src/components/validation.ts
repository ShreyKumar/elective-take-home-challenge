// Input validation for the form components. requirements.md puts validation at
// the UI boundary: the core module (src/lib) trusts its inputs and carries no
// guards of its own. These pure helpers ARE that boundary — factored out of the
// components only so they can be unit-tested without rendering. Each returns the
// parsed value, or `null` when the raw input is invalid; the components turn
// `null` into a rejection (an error message or a disabled control) and never
// pass it on to the core.

const POSITIVE_INT = /^\d+$/

/**
 * Parse a positive-integer field (cohort capacity or take count). Trims
 * surrounding whitespace, then rejects blanks, signs, decimals, exponents, and
 * any non-digit. `0` is rejected too: capacity must be >= 1 (FR1), and while the
 * core would simply no-op a take of 0, the form rejects it as empty input rather
 * than fire a useless dispatch.
 */
function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim()
  if (!POSITIVE_INT.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= 1 ? value : null
}

/** Cohort capacity: a positive integer (capacity 1 is valid). */
export function parseCapacity(raw: string): number | null {
  return parsePositiveInt(raw)
}

/**
 * Take count: a positive integer. No upper bound — the core clamps a count
 * larger than the total down to what's actually waiting (taking more than the
 * total is a success, not an error).
 */
export function parseCount(raw: string): number | null {
  return parsePositiveInt(raw)
}

/**
 * Creator name: any non-empty string once trimmed. Whitespace-only is rejected;
 * duplicates are fine — names are labels, not identifiers. Returns the trimmed
 * name so leading/trailing whitespace never reaches the ledger.
 */
export function parseName(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}
