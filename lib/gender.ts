/**
 * Gender, as the product asks for it and stores it.
 *
 * Collected because schools and the boards they report to count learners by
 * gender, and because a platform that cannot say who it is reaching cannot say
 * who it is missing. Asked of teachers as well as students — the staff side of
 * the same reporting.
 *
 * ## Null is not an answer
 *
 * The column is nullable and NULL means **nobody has asked yet**. Declining is
 * a different fact and is stored: `prefer_not_to_say`. Collapsing the two would
 * make the sign-in prompt reappear every session for exactly the people who
 * already declined, which turns a question into harassment. `needsGenderPrompt`
 * is the one place that distinction is read.
 *
 * ## Why the value is narrowed here
 *
 * It arrives over HTTP and ends up in a database column and, eventually, in a
 * reported figure. A typo written straight through becomes a category nobody
 * can query and nobody notices. Anything outside the set is refused rather than
 * stored.
 */

export type Gender = 'female' | 'male' | 'other' | 'prefer_not_to_say'

export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const BY_VALUE = new Map<string, Gender>(GENDER_OPTIONS.map((o) => [o.value, o.value]))
const LABELS = new Map<string, string>(GENDER_OPTIONS.map((o) => [o.value, o.label]))

/** The stored value, or null if this is not one of the answers on offer. */
export function normalizeGender(value: unknown): Gender | null {
  if (typeof value !== 'string') return null
  return BY_VALUE.get(value.trim().toLowerCase()) ?? null
}

/** What to show for a stored value; empty for unanswered or unrecognised. */
export function genderLabel(value: unknown): string {
  const gender = normalizeGender(value)
  return gender ? LABELS.get(gender) ?? '' : ''
}

/**
 * Whether this person still has to be asked.
 *
 * True only when nothing usable is stored. A value the normaliser would refuse
 * counts as nothing stored — better to ask once more than to leave a row with a
 * value no report can read.
 *
 * No user at all is not someone to ask, so a signed-out visitor gets nothing.
 */
export function needsGenderPrompt(user: { gender?: unknown } | null | undefined): boolean {
  if (!user) return false
  return normalizeGender(user.gender) === null
}
